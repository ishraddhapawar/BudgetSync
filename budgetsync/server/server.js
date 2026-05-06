import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import State from './models/State.js';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = 'budgetsync-super-secret-key';
let MEMORY_USERS = [];
let DB_CONNECTED = false;

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Authentication Routes ---
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password, fullName, email, mobile, role } = req.body;

    if (!DB_CONNECTED) {
      console.log('⚡ Handling LOCAL signup for:', username);
      const year = new Date().getFullYear();
      const randomHex = Math.random().toString(16).slice(2, 6).toUpperCase();
      const prefix = role === 'Disbursing Officer' ? 'OFF' : 'STK';
      const uniqueId = `${prefix}-${year}-${randomHex}`;
      const localUser = { username, email, role, uniqueId };
      MEMORY_USERS.push(localUser);
      return res.json({ token: 'local-token', user: localUser });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) return res.status(400).json({ error: 'Username or Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const year = new Date().getFullYear();
    const randomHex = Math.random().toString(16).slice(2, 6).toUpperCase();
    const prefix = role === 'Disbursing Officer' ? 'OFF' : 'STK';
    const uniqueId = `${prefix}-${year}-${randomHex}`;

    const newUser = new User({ username, password: hashedPassword, fullName, email, mobile, role, uniqueId });
    await newUser.save();
    res.json({ token: 'atlas-token', user: { username, role, email, uniqueId } });
  } catch (err) {
    console.error('CRITICAL SIGNUP ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password, uniqueId } = req.body;

    if (!DB_CONNECTED) {
      const user = MEMORY_USERS.find(u => u.username === username);
      if (!user) return res.status(400).json({ error: 'Local user not found' });
      if (user.uniqueId !== uniqueId) return res.status(400).json({ error: 'Invalid Unique ID' });
      return res.json({ token: 'local-token', user });
    }

    const user = await User.findOne({ 
      $or: [
        { username: username },
        { email: username }
      ]
    });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    if (user.uniqueId !== uniqueId) return res.status(400).json({ error: 'Invalid Unique ID. Please check your ID and try again.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({ token, user: { username: user.username, role: user.role, email: user.email, uniqueId: user.uniqueId } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const INITIAL_STATE = {
  allocations: {
    'agri': { requested: 25000000, allocated: 22000000, status: 'approved', justification: 'Initial' },
    'edu': { requested: 20000000, allocated: 18000000, status: 'approved', justification: 'Initial' },
    'roads': { requested: 15000000, allocated: 12000000, status: 'approved', justification: 'Initial' },
    'rail': { requested: 28000000, allocated: 25000000, status: 'approved', justification: 'Initial' },
    'health': { requested: 12000000, allocated: 10000000, status: 'approved', justification: 'Initial' },
  },
  conflicts: [
    { type: 'dept', dept1: 'Product', dept2: 'Pool', desc: 'Requested $900K but encountered constraints.', deptId: 'prod', amount: 900000, priority: 2 }
  ],
  auditLog: [
    { id: 4, action: 'Product budget conflict detected', dept: 'Product', amount: 300000, type: 'warning', extra: 'Exceeds pool', time: new Date().toISOString() },
    { id: 3, action: 'Engineering budget approved', dept: 'Engineering', amount: 2200000, type: 'success', extra: 'Initial allocation', time: new Date().toISOString() },
    { id: 2, action: 'Legal budget approved', dept: 'Legal & Compliance', amount: 600000, type: 'success', extra: 'Initial allocation', time: new Date().toISOString() },
    { id: 1, action: 'Platform init', dept: 'System', amount: null, type: 'info', extra: 'System started', time: new Date().toISOString() }
  ],
  chatMessages: [
    { deptId: 'eng', time: new Date().toISOString(), msg: 'We really need that extra budget for Q3 servers.' },
    { deptId: 'prod', time: new Date().toISOString(), msg: 'Our product launch is at risk without the $900K.' },
    { deptId: 'sales', time: new Date().toISOString(), msg: 'Can we reallocate from HR?' },
    { deptId: 'hr', time: new Date().toISOString(), msg: 'Absolutely not, hiring is frozen as is.' }
  ],
  snapshots: []
};

import dns from 'dns';

// Force Node.js to use Google's DNS (8.8.8.8) to resolve the SRV record
dns.setServers(['8.8.8.8', '8.8.4.4']);

DB_CONNECTED = false;
let MEMORY_STATE = INITIAL_STATE;

const MONGO_URI = 'mongodb+srv://SQUAD-404:021106@cluster0.cnrpdtk.mongodb.net/budgetsync?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI, { tls: true, tlsInsecure: true })
  .then(() => {
    console.log('✅ MongoDB Atlas Connected Successfully!');
    DB_CONNECTED = true;
  })
  .catch(err => {
    console.warn('⚠️ Atlas connection failed. Using IN-MEMORY storage fallback.');
    console.error(err);
    DB_CONNECTED = false;
  });

app.get('/api/state', async (req, res) => {
  try {
    if (!DB_CONNECTED) {
      return res.json(MEMORY_STATE);
    }
    let state = await State.findOne();
    if (!state) {
      state = new State(INITIAL_STATE);
      await state.save();
    }
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/state', async (req, res) => {
  try {
    if (!DB_CONNECTED) {
      MEMORY_STATE = { ...req.body };
      return res.json(MEMORY_STATE);
    }
    let state = await State.findOne();
    if (state) {
      state.allocations = req.body.allocations;
      state.conflicts = req.body.conflicts;
      state.auditLog = req.body.auditLog;
      state.chatMessages = req.body.chatMessages;
      state.snapshots = req.body.snapshots;
      await state.save();
    } else {
      state = new State(req.body);
      await state.save();
    }
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reset', async (req, res) => {
  try {
    if (DB_CONNECTED) {
      await State.deleteMany({});
      const newState = new State(INITIAL_STATE);
      await newState.save();
    } else {
      MEMORY_STATE = INITIAL_STATE;
    }
    res.send("<h1>✅ State reset to defaults!</h1><p>You can now refresh your dashboard to see the new departments.</p><a href='http://localhost:5173'>Back to App</a>");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/api/auth/recover', async (req, res) => {
  try {
    const { contact } = req.body;

    if (!DB_CONNECTED) {
      return res.status(503).json({ error: "Database offline. Password recovery is unavailable in local fallback mode." });
    }

    const user = await User.findOne({ email: contact });
    if (!user) {
      return res.status(404).json({ error: "No account found with that email address." });
    }

    const { GMAIL_USER, GMAIL_PASS } = process.env;
    const resetToken = Math.random().toString(36).substring(2, 15);
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    if (!GMAIL_USER || !GMAIL_PASS) {
      console.log(`\n📧 [SIMULATED EMAIL] Password recovery requested for: ${contact}`);
      console.log(`🔗 Link: ${resetLink}`);
      console.log(`⚠️ Note: Nodemailer not configured. Please add GMAIL_USER and GMAIL_PASS to server/.env\n`);
      return res.json({ message: "Simulated recovery link logged to server console (Add .env credentials for real email)." });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"BudgetSync Recovery" <${GMAIL_USER}>`,
      to: contact,
      subject: 'BudgetSync Password Reset',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your BudgetSync account.</p>
        <p>Please click the link below to reset your password:</p>
        <a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#4F46E5;color:white;text-decoration:none;border-radius:6px;">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Recovery email sent successfully." });

  } catch (error) {
    console.error("Recovery error:", error);
    res.status(500).json({ error: "Failed to send recovery email." });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!DB_CONNECTED) {
      return res.status(503).json({ error: "Database offline. Password reset is unavailable in local fallback mode." });
    }

    const user = await User.findOne({ 
      resetPasswordToken: token, 
      resetPasswordExpires: { $gt: Date.now() } 
    });

    if (!user) {
      return res.status(400).json({ error: "Password reset token is invalid or has expired." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password has been successfully reset." });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
