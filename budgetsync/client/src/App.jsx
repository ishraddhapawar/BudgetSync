import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import OfficerDashboard from './OfficerDashboard';
import InteractiveWavesBackground from './InteractiveWavesBackground';
import ForceFieldBackground from './ForceFieldBackground';
import { Eye, EyeOff } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const TOTAL_BUDGET = 100000000;
const DEPT_COLORS = ['#4F46E5','#0891B2','#059669','#D97706','#DC2626','#7C3AED'];
const DEPT_BG_COLORS = ['#EDE9FE','#E0F2FE','#D1FAE5','#FEF3C7','#FEE2E2','#F3E8FF'];
const DEPT_TEXT_COLORS = ['#4338CA','#0369A1','#047857','#B45309','#B91C1C','#6D28D9'];

const DEPT_DATA = [
  { id: 'agri', name: 'Agriculture', head: 'Department Head', priority: 1, colorIdx: 0 },
  { id: 'edu', name: 'Education', head: 'Department Head', priority: 2, colorIdx: 1 },
  { id: 'roads', name: 'Roadways', head: 'Department Head', priority: 2, colorIdx: 2 },
  { id: 'rail', name: 'Railways', head: 'Department Head', priority: 1, colorIdx: 3 },
  { id: 'health', name: 'Healthcare', head: 'Department Head', priority: 1, colorIdx: 4 },
];

function getDept(id) { 
  return DEPT_DATA.find(d => d.id === id) || { id: 'legacy', name: 'Legacy Dept', head: 'Former Staff', priority: 5, colorIdx: 0 }; 
}
function formatMoney(n) { return '₹' + (n / 10000000).toFixed(2) + ' Cr'; }
function formatMoneyL(n) { return '₹' + (n / 100000).toFixed(2) + ' L'; }
function formatMoneySmart(n) { 
  if (n == null) return '-';
  if (n >= 10000000) return formatMoney(n);
  if (n >= 100000) return formatMoneyL(n);
  return '₹' + (n / 1000).toFixed(0) + ' K';
}
function getInitials(name) { 
  const titles = ['dr.', 'prof.', 'mr.', 'ms.', 'mrs.', 'sir'];
  const parts = name.split(' ').filter(p => !titles.includes(p.toLowerCase().replace('.', '')));
  return parts.map(n => n[0]).join('').substring(0, 2).toUpperCase(); 
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isSignup, setIsSignup] = useState(false);
  const [signupStep, setSignupStep] = useState(1); // 1: Role Selection, 2: Form
  const [selectedRole, setSelectedRole] = useState('Stakeholder');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');
  
  const [recoveryMethod, setRecoveryMethod] = useState('email');
  const [recoveryContact, setRecoveryContact] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');

  const hasCapital = /^[A-Z]/.test(password);
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordValid = hasCapital && hasMinLength && hasNumber && hasSpecial;

  const [appState, setAppState] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [stakeholders, setStakeholders] = useState(4);
  const [toast, setToast] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [chatInputDash, setChatInputDash] = useState('');
  const [chatInputNeg, setChatInputNeg] = useState('');

  const chatDashRef = useRef(null);
  const chatNegRef = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (window.location.pathname === '/reset-password' && token) {
      setIsResettingPassword(true);
      setResetToken(token);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      const fetchState = () => {
        axios.get(`${API_URL}/api/state`)
          .then(res => setAppState(res.data))
          .catch(e => console.error('Auto-poll error:', e));
      };
      
      fetchState(); // Initial fetch
      const iv = setInterval(fetchState, 5000); // Poll every 5s
      return () => clearInterval(iv);
    }
  }, [currentUser]);

  useEffect(() => {
    const iv = setInterval(() => setStakeholders(Math.floor(Math.random() * 3) + 3), 6000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (chatDashRef.current) chatDashRef.current.scrollTop = chatDashRef.current.scrollHeight;
    if (chatNegRef.current) chatNegRef.current.scrollTop = chatNegRef.current.scrollHeight;
  }, [appState?.chatMessages, tab]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd);
    if (isSignup) data.role = selectedRole;

    if (isSignup && data.password !== data.confirmPassword) {
      setAuthError('Passwords do not match');
      setAuthLoading(false);
      return;
    }
    
    try {
      const endpoint = isSignup ? '/api/signup' : '/api/login';
      const res = await axios.post(`${API_URL}${endpoint}`, data);
      setCurrentUser(res.data.user);
      localStorage.setItem('token', res.data.token);
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('token');
  };

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const syncState = async (newState) => {
    setAppState({ ...newState });
    try {
      await axios.post(`${API_URL}/api/state`, newState);
    } catch (e) {
      console.error('Failed to sync state', e);
    }
  };

  if (!currentUser) {
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyItems: 'center', minHeight: '100vh', padding: '40px 0', background: '#ffffff', overflow: 'hidden' }}>
        <InteractiveWavesBackground 
          lineColor="rgba(0, 0, 0, 0.5)"
          backgroundColor="#ffffff"
          waveSpeedX={0.02}
          waveSpeedY={0.01}
          waveAmpX={40}
          waveAmpY={20}
          friction={0.9}
          tension={0.01}
          maxCursorMove={120}
          xGap={12}
          yGap={36}
        />
        <div className="card" style={{ 
          position: 'relative', zIndex: 10, maxWidth: 450, margin: 'auto', width: '90%', padding: 32, 
          background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(20px)', 
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)', border: '1px solid rgba(255, 255, 255, 0.8)' 
        }}>
          <div className="logo" style={{ margin: '0 auto 24px auto' }}>BS</div>
          
          {isResettingPassword ? (
            // --- RESET PASSWORD FULFILLMENT VIEW ---
            <>
              <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Set New Password</h2>
              {resetSuccessMessage ? (
                <div style={{ padding: 16, background: 'var(--color-success-bg)', color: 'var(--color-success-text)', borderRadius: 8, textAlign: 'center', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                  <strong>Password Updated!</strong>
                  <p style={{ fontSize: '0.85rem', marginTop: 8 }}>{resetSuccessMessage}</p>
                  <button className="btn" style={{ marginTop: 16 }} onClick={() => { setIsResettingPassword(false); setPassword(''); window.history.pushState({}, '', '/'); }}>Back to Login</button>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (password !== confirmPassword) {
                    setAuthError("Passwords do not match.");
                    return;
                  }
                  try {
                    setAuthLoading(true);
                    const res = await axios.post(`${API_URL}/api/auth/reset-password`, { token: resetToken, newPassword: password });
                    setResetSuccessMessage(res.data.message);
                    setAuthError('');
                  } catch (err) {
                    setAuthError(err.response?.data?.error || 'Failed to reset password.');
                  } finally {
                    setAuthLoading(false);
                  }
                }}>
                  <div className="form-group">
                    <label>New Password</label>
                    <input type="password" name="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input type="password" name="confirmPassword" className="form-control" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                  </div>

                  {password.length > 0 && (
                    <div style={{ marginBottom: 16, fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: 4, padding: 8, background: 'rgba(0,0,0,0.03)', borderRadius: 6 }}>
                      <div style={{ color: hasCapital ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>{hasCapital ? '✅' : '❌'} First letter must be capital</div>
                      <div style={{ color: hasMinLength ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>{hasMinLength ? '✅' : '❌'} Minimum 8 characters</div>
                      <div style={{ color: hasNumber ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>{hasNumber ? '✅' : '❌'} Contains a number</div>
                      <div style={{ color: hasSpecial ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>{hasSpecial ? '✅' : '❌'} Contains a special character</div>
                    </div>
                  )}

                  {authError && <div style={{ color: 'var(--color-danger-text)', fontSize: '0.8rem', marginBottom: 16 }}>{authError}</div>}
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={authLoading || !isPasswordValid}>
                    {authLoading ? 'Saving...' : 'Set Password'}
                  </button>
                </form>
              )}
            </>
          ) : isForgotPassword ? (
            // --- FORGOT PASSWORD VIEW ---
            <>
              <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Recover Password</h2>
              <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 24 }}>
                Choose how you want to receive your reset link
              </p>
              
              {recoverySuccess ? (
                <div style={{ padding: 16, background: 'var(--color-success-bg)', color: 'var(--color-success-text)', borderRadius: 8, textAlign: 'center', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                  <strong>Link Sent!</strong>
                  <p style={{ fontSize: '0.85rem', marginTop: 8 }}>{recoverySuccess}</p>
                  <button className="btn" style={{ marginTop: 16 }} onClick={() => { setIsForgotPassword(false); setRecoverySuccess(''); setRecoveryContact(''); setPassword(''); }}>Back to Login</button>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const res = await axios.post(`${API_URL}/api/auth/recover`, { contact: recoveryContact, method: recoveryMethod });
                    setRecoverySuccess(res.data.message);
                  } catch (err) {
                    setRecoverySuccess(err.response?.data?.error || 'Failed to send reset link.');
                  }
                }}>
                  <div className="form-group">
                    <label>Gmail Address</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      placeholder="e.g., yourname@gmail.com"
                      value={recoveryContact}
                      onChange={e => setRecoveryContact(e.target.value)}
                      required 
                    />
                  </div>
                  
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>Send Reset Link</button>
                  <button type="button" className="btn" style={{ width: '100%', marginTop: 12, background: 'none', border: 'none' }} onClick={() => { setIsForgotPassword(false); setPassword(''); }}>Back to Login</button>
                </form>
              )}
            </>
          ) : !isSignup ? (
            // --- LOGIN VIEW ---
            <>
              <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Welcome Back</h2>
              <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 24 }}>
                Login to manage allocations
              </p>
              <form onSubmit={handleAuth}>
                <div className="form-group">
                  <label>Username or Email</label>
                  <input type="text" name="username" className="form-control" placeholder="Enter your username or email" required />
                </div>
                <div className="form-group">
                  <label>Unique ID</label>
                  <input type="text" name="uniqueId" className="form-control" placeholder="e.g. STK-2026-A1B2" required />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      name="password" 
                      className="form-control" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      style={{ paddingRight: '40px' }}
                      required 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', padding: 0
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                {authError && <div style={{ color: 'var(--color-danger-text)', fontSize: '0.8rem', marginBottom: 16 }}>{authError}</div>}
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={authLoading}>
                  {authLoading ? 'Logging in...' : 'Login'}
                </button>
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button type="button" className="btn" style={{ border: 'none', background: 'none', color: '#4F46E5', fontSize: '0.8rem', fontWeight: 600, padding: 0 }} onClick={() => setIsForgotPassword(true)}>
                    Forgot Password?
                  </button>
                </div>
              </form>
              <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Don't have an account?</span>{' '}
                <button className="btn" style={{ border: 'none', background: 'none', color: 'var(--color-text-primary)', fontWeight: 600, padding: 0 }} onClick={() => { setIsSignup(true); setSignupStep(1); setPassword(''); setAuthError(''); }}>
                  Sign Up
                </button>
              </div>
            </>
          ) : signupStep === 1 ? (
            // --- SIGNUP STEP 1: ROLE SELECTION ---
            <>
              <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Select Your Role</h2>
              <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 32 }}>
                Choose how you will interact with BudgetSync
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div 
                  className="card"
                  style={{ 
                    cursor: 'pointer', padding: 20, border: `2px solid ${selectedRole === 'Disbursing Officer' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    transition: 'all 0.2s ease', background: selectedRole === 'Disbursing Officer' ? 'rgba(99, 102, 241, 0.05)' : 'none'
                  }}
                  onClick={() => setSelectedRole('Disbursing Officer')}
                >
                  <h4 style={{ marginBottom: 4 }}>🏦 Disbursing Officer</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Manage the central pool, approve budgets, and resolve department conflicts.
                  </p>
                </div>
                
                <div 
                  className="card"
                  style={{ 
                    cursor: 'pointer', padding: 20, border: `2px solid ${selectedRole === 'Stakeholder' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    transition: 'all 0.2s ease', background: selectedRole === 'Stakeholder' ? 'rgba(99, 102, 241, 0.05)' : 'none'
                  }}
                  onClick={() => setSelectedRole('Stakeholder')}
                >
                  <h4 style={{ marginBottom: 4 }}>👥 Stakeholder</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Request budgets for your department and participate in collaborative discussions.
                  </p>
                </div>
              </div>

              <button className="btn btn-primary" style={{ width: '100%', marginTop: 32 }} onClick={() => setSignupStep(2)}>
                Continue to Register
              </button>
              <button className="btn" style={{ width: '100%', marginTop: 8, border: 'none', background: 'none' }} onClick={() => setIsSignup(false)}>
                Back to Login
              </button>
            </>
          ) : (
            // --- SIGNUP STEP 2: REGISTRATION FORM ---
            <>
              <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Finish Creating Account</h2>
              <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 24 }}>
                Registering as a <strong>{selectedRole}</strong>
              </p>
              
              <form onSubmit={handleAuth}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Username</label>
                    <input type="text" name="username" className="form-control" required />
                  </div>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" name="fullName" className="form-control" required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" name="email" className="form-control" required />
                  </div>
                  <div className="form-group">
                    <label>Mobile Number</label>
                    <input type="tel" name="mobile" className="form-control" required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="password" 
                        className="form-control" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        style={{ paddingRight: '40px' }}
                        required 
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', padding: 0
                        }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Confirm Password</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="confirmPassword" 
                        className="form-control" 
                        style={{ paddingRight: '40px' }}
                        required 
                      />
                    </div>
                  </div>
                </div>

                {password.length > 0 && (
                  <div style={{ marginBottom: 16, fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: 4, padding: 8, background: 'rgba(0,0,0,0.03)', borderRadius: 6 }}>
                    <div style={{ color: hasCapital ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>
                      {hasCapital ? '✅' : '❌'} First letter must be capital
                    </div>
                    <div style={{ color: hasMinLength ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>
                      {hasMinLength ? '✅' : '❌'} Minimum 8 characters
                    </div>
                    <div style={{ color: hasNumber ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>
                      {hasNumber ? '✅' : '❌'} Contains a number
                    </div>
                    <div style={{ color: hasSpecial ? 'var(--color-success-text)' : 'var(--color-text-secondary)' }}>
                      {hasSpecial ? '✅' : '❌'} Contains a special character
                    </div>
                  </div>
                )}

                {authError && <div style={{ color: 'var(--color-danger-text)', fontSize: '0.8rem', marginBottom: 16 }}>{authError}</div>}
                
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={authLoading || !isPasswordValid}>
                  {authLoading ? 'Creating Account...' : 'Complete Sign Up'}
                </button>
                
                <button type="button" className="btn" style={{ width: '100%', marginTop: 8, border: 'none', background: 'none' }} onClick={() => setSignupStep(1)}>
                  Change Role
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!appState) return <div style={{padding: 40}}>Loading dashboard...</div>;

  const refreshState = () => {
    axios.get(`${API_URL}/api/state`).then(res => setAppState(res.data)).catch(e => console.error(e));
  };

  // Route Disbursing Officers to their dedicated dashboard
  if (currentUser.role === 'Disbursing Officer') {
    return <OfficerDashboard appState={appState} syncState={syncState} currentUser={currentUser} onLogout={handleLogout} onRefresh={refreshState} />;
  }

  const getDraft = () => JSON.parse(JSON.stringify(appState));

  const logAudit = (draft, action, dept, amount, type, extra) => {
    draft.auditLog.unshift({ id: Date.now(), action, dept, amount, type, extra, time: new Date().toISOString() });
  };

  const takeSnapshot = (draft, label) => {
    draft.snapshots.unshift({
      id: Date.now(), label, time: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(draft.allocations))
    });
    if(draft.snapshots.length > 20) draft.snapshots.pop();
  };
  
  const detectConflicts = (draft) => {
    draft.conflicts = [];
    let totalAlloc = Object.values(draft.allocations).reduce((sum, a) => sum + a.allocated, 0);
    for (let deptId in draft.allocations) {
      if (draft.allocations[deptId].status === 'conflict') {
        let dept = getDept(deptId);
        draft.conflicts.push({
          type: 'dept', dept1: dept.name, dept2: 'Pool',
          desc: `Requested ${formatMoneySmart(draft.allocations[deptId].requested)} but encountered constraints.`,
          deptId: deptId, amount: draft.allocations[deptId].requested, priority: dept.priority
        });
      }
    }
    if (totalAlloc > TOTAL_BUDGET) {
      draft.conflicts.push({
        type: 'pool', dept1: 'System', dept2: 'All',
        desc: `Total allocated (${formatMoneySmart(totalAlloc)}) exceeds pool (${formatMoneySmart(TOTAL_BUDGET)}) by ${formatMoneySmart(totalAlloc - TOTAL_BUDGET)}.`,
        deptId: null, amount: totalAlloc - TOTAL_BUDGET, priority: 0
      });
    }
  };

  const cascadeRecalc = (draft, changedDeptId) => {
    let totalAlloc = Object.values(draft.allocations).reduce((sum, a) => sum + a.allocated, 0);
    if (totalAlloc > TOTAL_BUDGET) {
      let approvedDepts = Object.keys(draft.allocations)
        .filter(id => draft.allocations[id].status === 'approved' && id !== changedDeptId)
        .map(id => ({ id, priority: getDept(id).priority, allocated: draft.allocations[id].allocated }))
        .sort((a, b) => b.priority - a.priority);

      for (let dept of approvedDepts) {
        if (totalAlloc <= TOTAL_BUDGET) break;
        let overage = totalAlloc - TOTAL_BUDGET;
        let cut = Math.min(dept.allocated, overage);
        draft.allocations[dept.id].allocated -= cut;
        totalAlloc -= cut;
        logAudit(draft, 'Cascade cut', getDept(dept.id).name, -cut, 'warning', `Reduced by ${formatMoneySmart(cut)} to balance pool`);
      }
    }
    detectConflicts(draft);
  };

  const handleRequest = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const deptId = fd.get('deptId');
    const amount = parseInt(fd.get('amount'));
    const justification = fd.get('justification');

    let draft = getDraft();
    takeSnapshot(draft, `Submit request ${getDept(deptId).name}`);
    
    let totalAlloc = Object.values(draft.allocations).reduce((sum, a) => sum + a.allocated, 0) - (draft.allocations[deptId]?.allocated || 0);
    let remaining = TOTAL_BUDGET - totalAlloc;

    if (!draft.allocations[deptId]) draft.allocations[deptId] = { requested: 0, allocated: 0, status: 'pending' };
    draft.allocations[deptId].requested = amount;
    draft.allocations[deptId].justification = justification;
    draft.allocations[deptId].submittedBy = currentUser.username;
    draft.allocations[deptId].submittedById = currentUser.uniqueId;

    if (amount <= remaining + (draft.allocations[deptId]?.allocated || 0)) {
      draft.allocations[deptId].status = 'pending';
      showToast('Request sent to Officer', 'info');
      logAudit(draft, 'Budget request submitted', `${getDept(deptId).name} (${currentUser.username}) [${currentUser.uniqueId}]`, amount, 'info', justification);
    } else {
      draft.allocations[deptId].status = 'conflict';
      showToast('Pool limit exceeded!', 'warning');
      logAudit(draft, 'Budget conflict', getDept(deptId).name, amount, 'warning', 'Insufficient pool');
      detectConflicts(draft);
    }
    syncState(draft);
    e.target.reset();
  };

  const resolveConflict = (deptId, action) => {
    let draft = getDraft();
    takeSnapshot(draft, `Conflict resolution: ${action}`);
    let deptInfo = getDept(deptId);
    let alloc = draft.allocations[deptId] || { requested: 0, allocated: 0, status: 'pending' };
    if (!draft.allocations[deptId]) draft.allocations[deptId] = alloc;
    
    let requested = alloc.requested;
    let totalAlloc = Object.values(draft.allocations).reduce((sum, a) => sum + a.allocated, 0) - alloc.allocated;
    let remaining = TOTAL_BUDGET - totalAlloc;

    if (action === 'priority') {
      let grant = Math.min(requested, Math.max(0, remaining));
      alloc.allocated = grant;
      alloc.status = grant === requested ? 'approved' : 'pending';
      logAudit(draft, 'Arbitrated by priority', deptInfo.name, grant, 'success', `Granted ${formatMoneySmart(grant)}`);
    } else if (action === 'split') {
      let grant = Math.max(0, remaining / 2);
      alloc.allocated = grant;
      alloc.status = 'pending';
      logAudit(draft, 'Split equally', deptInfo.name, grant, 'info', `Granted ${formatMoneySmart(grant)}`);
    } else if (action === 'reject') {
      alloc.allocated = 0;
      alloc.status = 'rejected';
      logAudit(draft, 'Rejected lower priority', deptInfo.name, 0, 'danger', 'Allocation zeroed');
    }
    
    cascadeRecalc(draft, deptId);
    syncState(draft);
  };

  const adjustAllocation = (deptId, percent) => {
    let draft = getDraft();
    takeSnapshot(draft, `Manual adjustment ${percent > 0 ? '+' : ''}${percent}% for ${getDept(deptId).name}`);
    let current = draft.allocations[deptId]?.allocated || 0;
    if (!draft.allocations[deptId]) draft.allocations[deptId] = { requested: 0, allocated: 0, status: 'approved' };
    let adjustment = current * (percent / 100);
    let newAmount = current + adjustment;
    
    if (percent > 0) {
      let totalAlloc = Object.values(draft.allocations).reduce((sum, a) => sum + a.allocated, 0);
      if (totalAlloc + adjustment > TOTAL_BUDGET) {
        showToast('Cannot increase: Exceeds pool', 'danger');
        return;
      }
    }
    
    draft.allocations[deptId].allocated = newAmount;
    draft.allocations[deptId].status = 'approved';
    logAudit(draft, `Adjusted allocation ${percent}%`, getDept(deptId).name, adjustment, 'info', `New amount: ${formatMoneySmart(newAmount)}`);
    
    if (percent > 0) cascadeRecalc(draft, deptId);
    syncState(draft);
  };

  const simulateMultiSubmit = () => {
    const requests = [
      { id: 'eng', amount: 3500000 },
      { id: 'sales', amount: 2800000 },
      { id: 'prod', amount: 2000000 }
    ];
    
    requests.forEach((req, idx) => {
      setTimeout(() => {
        setAppState(prev => {
          let draft = JSON.parse(JSON.stringify(prev));
          takeSnapshot(draft, `Auto-submit ${req.id}`);
          let totalAlloc = Object.values(draft.allocations).reduce((sum, a) => sum + a.allocated, 0) - draft.allocations[req.id].allocated;
          let remaining = TOTAL_BUDGET - totalAlloc;
          
          draft.allocations[req.id].requested = req.amount;
          if (req.amount <= remaining) {
            draft.allocations[req.id].allocated = req.amount;
            draft.allocations[req.id].status = 'approved';
            logAudit(draft, 'Budget approved', getDept(req.id).name, req.amount, 'success', 'Auto-approved');
            cascadeRecalc(draft, req.id);
          } else {
            draft.allocations[req.id].status = 'conflict';
            logAudit(draft, 'Budget conflict', getDept(req.id).name, req.amount, 'warning', 'Insufficient pool');
            showToast(`Conflict for ${getDept(req.id).name}`, 'warning');
            detectConflicts(draft);
          }
          axios.post(`${API_URL}/api/state`, draft).catch(()=>console.log('sync error'));
          return draft;
        });
      }, idx * 400);
    });
  };

  const restoreSnapshot = (i) => {
    let draft = getDraft();
    takeSnapshot(draft, "Pre-restore backup");
    draft.allocations = JSON.parse(JSON.stringify(draft.snapshots[i+1].state)); 
    logAudit(draft, 'Snapshot restored', 'System', null, 'warning', `Restored to snapshot`);
    showToast('Snapshot restored', 'warning');
    detectConflicts(draft);
    syncState(draft);
  };

  const sendChat = (target) => {
    const msg = target === 'dash' ? chatInputDash.trim() : chatInputNeg.trim();
    if (!msg) return;
    let draft = getDraft();
    let randomDept = DEPT_DATA[Math.floor(Math.random() * DEPT_DATA.length)];
    draft.chatMessages.push({ deptId: randomDept.id, time: new Date().toISOString(), msg });
    
    if (target === 'dash') setChatInputDash('');
    else setChatInputNeg('');
    
    syncState(draft);
  };

  const exportAudit = () => {
    let text = "BudgetSync Audit Log\n====================\n\n";
    appState.auditLog.forEach(l => {
      text += `[${new Date(l.time).toLocaleTimeString()}] ${l.type.toUpperCase()}: ${l.action} - ${l.dept} ${l.amount ? '('+formatMoneySmart(l.amount)+')' : ''} - ${l.extra}\n`;
    });
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'budgetsync_audit.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  let totalAlloc = Object.values(appState.allocations).reduce((sum, a) => sum + a.allocated, 0);
  let rem = TOTAL_BUDGET - totalAlloc;
  let poolPct = ((totalAlloc / TOTAL_BUDGET) * 100).toFixed(1);

  let insightText = `Pool is ${poolPct}% allocated. `;
  if (appState.conflicts.length > 0) insightText += `There are ${appState.conflicts.length} active conflicts requiring arbitration.`;
  else if (totalAlloc > TOTAL_BUDGET * 0.9) insightText += `Budget is running tight, prioritize P1 and P2 items.`;
  else insightText += `Healthy buffer remaining for upcoming requests.`;

  const chartLabels = DEPT_DATA.map(d => d.name);
  const chartAllocated = DEPT_DATA.map(d => (appState.allocations[d.id]?.allocated || 0) / 1000);
  const chartRequested = DEPT_DATA.map(d => (appState.allocations[d.id]?.requested || 0) / 1000);
  const chartColors = DEPT_DATA.map(d => DEPT_COLORS[d.colorIdx]);

  return (
    <div className="dark-theme dashboard-container" style={{ position: 'relative', minHeight: '100vh', background: 'var(--color-background-secondary)', overflow: 'hidden' }}>
      {/* Dynamic Background Animation */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.6 }}>
        <ForceFieldBackground 
          hue={196} 
          saturation={100} 
          spacing={18} 
          density={1.2}
          forceStrength={8}
          magnifierRadius={160}
          minStroke={1.5}
          maxStroke={3.5}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <header>
        <div className="logo-area">
          <div className="logo">BS</div>
          <div>
            <h1 className="app-title">BudgetSync</h1>
            <div className="app-subtitle">Collaborative Budget Allocation Platform</div>
          </div>
        </div>
        <div className="header-actions">
          <div className="live-stakeholders">
            <span className="pulse-dot"></span> <span>{stakeholders}</span> online
          </div>
          
          <div style={{ position: 'relative' }}>
            <div 
              className="user-profile-trigger" 
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 12px', 
                borderRadius: 20, background: 'rgba(255,255,255,0.05)', transition: 'all 0.2s' 
              }}
            >
              <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>{getInitials(currentUser.username)}</div>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{currentUser.username}</span>
            </div>

            {showProfileDropdown && (
              <>
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} 
                  onClick={() => setShowProfileDropdown(false)}
                />
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="avatar" style={{ width: 56, height: 56, fontSize: '1.5rem', marginBottom: 12, border: '3px solid rgba(255,255,255,0.1)' }}>
                      {getInitials(currentUser.username)}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{currentUser.username}</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{currentUser.email || 'user@budgetsync.in'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-success-text)', marginTop: 8, fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 10px', borderRadius: 10 }}>
                      ID: {currentUser.uniqueId || 'STK-2026-X0X0'}
                    </div>
                  </div>
                  
                  <div className="profile-dropdown-body">
                    <div className="dropdown-item">
                      <span style={{ fontSize: '1.2rem' }}>🔑</span>
                      <span>Passwords and security</span>
                    </div>
                    <div className="dropdown-item">
                      <span style={{ fontSize: '1.2rem' }}>⚙️</span>
                      <span>Manage Account</span>
                    </div>
                    <div className="dropdown-item">
                      <span style={{ fontSize: '1.2rem' }}>🎨</span>
                      <span>Customise profile</span>
                    </div>
                    <div className="dropdown-item">
                      <span style={{ fontSize: '1.2rem' }}>🔄</span>
                      <span>Sync is on</span>
                    </div>
                    
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '12px 0' }} />
                    
                    <div className="dropdown-item" onClick={handleLogout} style={{ color: '#ff4d4d' }}>
                      <span style={{ fontSize: '1.2rem' }}>🚪</span>
                      <span>Sign out</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="tabs-nav">
        {['dashboard', 'negotiation', 'audit', 'analytics'].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      <main className="tab-content" style={{ display: tab === 'dashboard' ? 'block' : 'none' }}>
        <div className="grid-3col">
          <div className="panel">
            <div className="card">
              <h3>Budget Pool</h3>
              <div style={{fontSize: '1.5rem', fontWeight: 600}}>{formatMoney(totalAlloc)}</div>
              <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)'}}>Remaining: {formatMoney(Math.max(0, rem))} of {formatMoney(TOTAL_BUDGET)}</div>
              <div className="pool-bar-container">
                {DEPT_DATA.map(dept => {
                  let alloc = appState.allocations[dept.id]?.allocated || 0;
                  if (alloc === 0) return null;
                  let pct = (alloc / TOTAL_BUDGET) * 100;
                  return <div key={dept.id} className="pool-segment" style={{width: `${pct}%`, background: DEPT_COLORS[dept.colorIdx]}} title={`${dept.name}: ${formatMoney(alloc)}`}></div>
                })}
              </div>
              <div className="legend-grid">
                {DEPT_DATA.map(dept => (
                  <div key={dept.id} className="legend-item">
                    <div className="legend-color" style={{background: DEPT_COLORS[dept.colorIdx]}}></div>
                    <span>{dept.name}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="card">
              <h3>Departments</h3>
              <div>
                {DEPT_DATA.map(dept => (
                  <div key={dept.id} className="dept-item">
                    <div className="avatar-area">
                      <div className="avatar" style={{background: DEPT_BG_COLORS[dept.colorIdx], color: DEPT_TEXT_COLORS[dept.colorIdx]}}>
                        {getInitials(dept.head)}
                      </div>
                      <div className="dept-info">
                        <p>{dept.name}</p>
                        <span>{dept.head}</span>
                      </div>
                    </div>
                    <span className={`badge pri-${dept.priority}`}>P{dept.priority}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3>Priority Rules</h3>
              <div style={{fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5}}>
                <span className="badge pri-1">P1</span> Highest precedence.<br/>
                <span className="badge pri-2">P2</span> High precedence.<br/>
                <span className="badge pri-3">P3</span> Standard precedence.<br/>
                <span className="badge pri-4">P4</span> Low precedence.<br/>
                <span className="badge pri-5">P5</span> Lowest precedence.<br/>
                <div style={{marginTop: 8}}>In conflicts, lower priority items are automatically reduced first during cascade recalculation.</div>
              </div>
            </div>
          </div>

          <div className="panel">
            {appState.conflicts.length > 0 && (
              <div className="card" style={{borderColor: '#fca5a5', background: '#fef2f2'}}>
                <h3 style={{color: '#b91c1c'}}>Active Conflicts</h3>
                {appState.conflicts.map((c, i) => (
                  <div key={i} style={{marginBottom: 12, padding: 12, border: '1px solid #fca5a5', borderRadius: 6, background: 'white'}}>
                    <div style={{fontWeight: 600, color: '#b91c1c'}}>{c.type === 'pool' ? `System Overflow: ${formatMoneySmart(c.amount)}` : `${c.dept1} Conflict`}</div>
                    <div style={{fontSize: '0.8rem', margin: '4px 0 8px 0'}}>{c.desc}</div>
                    <div style={{fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: c.type === 'dept' ? 12 : 0}}>Rule: Higher priority gets precedence &middot; Tie &rarr; proportional split</div>
                    {c.type === 'dept' && (
                      <div style={{display: 'flex', gap: 8}}>
                        <button className="btn" style={{fontSize: '0.7rem'}} onClick={() => resolveConflict(c.deptId, 'priority')}>Arbitrate by Priority</button>
                        <button className="btn" style={{fontSize: '0.7rem'}} onClick={() => resolveConflict(c.deptId, 'split')}>Split Equally</button>
                        <button className="btn" style={{fontSize: '0.7rem', color: '#b91c1c'}} onClick={() => resolveConflict(c.deptId, 'reject')}>Reject Lower Priority</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="card">
              <h3>Submit Budget Request</h3>
              <form onSubmit={handleRequest}>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                  <div className="form-group">
                    <label>Department</label>
                    <select className="form-control" name="deptId">
                      <option value="agri">Agriculture</option>
                      <option value="edu">Education</option>
                      <option value="roads">Roadways</option>
                      <option value="rail">Railways</option>
                      <option value="health">Healthcare</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount (₹)</label>
                    <input type="number" className="form-control" name="amount" required min="1000" step="1000" placeholder="e.g. 500000" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Justification</label>
                  <input type="text" className="form-control" name="justification" required placeholder="Reason for request..." />
                </div>
                <button type="submit" className="btn btn-primary" style={{width: '100%'}}>Submit Request</button>
              </form>
            </div>

            <div className="card">
              <h3>Current Allocations</h3>
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Requested</th>
                    <th>Allocated</th>
                    <th>Utilization</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {DEPT_DATA.map(dept => {
                    let alloc = appState.allocations[dept.id] || { requested: 0, allocated: 0, status: 'pending' };
                    let pct = (alloc.allocated / TOTAL_BUDGET) * 100;
                    return (
                      <tr key={dept.id} className={alloc.status === 'conflict' ? 'row-conflict' : ''}>
                        <td>
                          <div style={{display:'flex', alignItems:'center', gap:8}}>
                            <div className="avatar" style={{width:24, height:24, fontSize:'0.6rem', background: DEPT_BG_COLORS[dept.colorIdx], color: DEPT_TEXT_COLORS[dept.colorIdx]}}>
                              {getInitials(dept.head)}
                            </div>
                            <div>
                              <div style={{fontWeight:500}}>{dept.name} <span className={`badge pri-${dept.priority}`} style={{fontSize:'0.6rem'}}>P{dept.priority}</span></div>
                            </div>
                          </div>
                        </td>
                        <td>{formatMoneySmart(alloc.requested)}</td>
                        <td style={{fontWeight:600}}>{formatMoneySmart(alloc.allocated)}</td>
                        <td>
                          <div className="util-bar"><div className="util-fill" style={{width:`${pct}%`, background: DEPT_COLORS[dept.colorIdx]}}></div></div>
                          <span style={{fontSize:'0.75rem'}}>{pct.toFixed(1)}%</span>
                        </td>
                        <td><span className={`chip ${alloc.status}`}>{alloc.status}</span></td>
                        <td>
                          <button className="btn" style={{padding:'4px 8px', fontSize:'0.7rem'}} onClick={() => adjustAllocation(dept.id, -10)}>-10%</button>
                          <button className="btn" style={{padding:'4px 8px', fontSize:'0.7rem'}} onClick={() => adjustAllocation(dept.id, 10)}>+10%</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="insight-chip">
              <span>✨</span>
              <span>{insightText}</span>
            </div>

            <div className="card">
              <h3>Live Activity</h3>
              <div>
                {appState.auditLog.slice(0, 8).map((l, i) => (
                  <div key={i} className="feed-item">
                    <div className={`feed-dot bg-${l.type}`}></div>
                    <div className="feed-content">
                      <p className="feed-title">{l.action}</p>
                      <p className="feed-desc">{l.dept} {l.amount ? `· ${formatMoneySmart(l.amount)}` : ''}</p>
                      <p className="feed-time">{new Date(l.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(l.time).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3>Negotiation Chat</h3>
              <div className="chat-box">
                <div className="chat-messages" ref={chatDashRef}>
                  {appState.chatMessages.map((m, i) => {
                    let dept = getDept(m.deptId) || { name: 'Legacy Dept', head: 'Former Staff', colorIdx: 0 };
                    return (
                      <div key={i} className="chat-msg">
                        <div className="msg-avatar" style={{background:DEPT_BG_COLORS[dept.colorIdx] || '#e5e7eb', color:DEPT_TEXT_COLORS[dept.colorIdx] || '#6b7280'}}>{getInitials(dept.head)}</div>
                        <div>
                          <div className="msg-meta">{dept.name} · {new Date(m.time).toLocaleTimeString()}</div>
                          <div className="msg-body">{m.msg}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="chat-input-area">
                  <input type="text" className="form-control" value={chatInputDash} onChange={e => setChatInputDash(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat('dash')} placeholder="Type a message..." />
                  <button className="btn btn-primary" onClick={() => sendChat('dash')}>Send</button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Snapshots</h3>
              <ul style={{paddingLeft: 20, margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.8rem'}}>
                {appState.snapshots.slice(0, 5).map((s, i) => (
                  <li key={i} style={{marginBottom: 8}}>
                    {s.label} <span style={{fontSize:'0.7rem'}}>({new Date(s.time).toLocaleTimeString()})</span>
                    <br/><a href="#" onClick={(e) => { e.preventDefault(); restoreSnapshot(i); }} style={{color:'var(--color-info-text)', textDecoration:'none'}}>Restore</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>

      <main className="tab-content" style={{ display: tab === 'negotiation' ? 'block' : 'none' }}>
        <div className="grid-2col">
          <div className="card">
            <h3>Open Proposals & Adjustments</h3>
            <p style={{fontSize: '0.85rem', color: 'var(--color-text-secondary)'}}>Review requested allocations that differ from current allocated amounts.</p>
            <div>
              {DEPT_DATA.filter(d => (appState.allocations[d.id]?.requested || 0) !== (appState.allocations[d.id]?.allocated || 0)).length === 0 ? 
                <div style={{fontSize:'0.85rem', color:'var(--color-text-secondary)'}}>No active proposals.</div> :
                DEPT_DATA.map(dept => {
                  let alloc = appState.allocations[dept.id] || { requested: 0, allocated: 0, status: 'pending' };
                  if (alloc.requested === alloc.allocated) return null;
                  return (
                    <div key={dept.id} style={{border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', padding: 12, marginBottom: 12}}>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                        <div style={{fontWeight:600}}>{dept.name}</div>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <span className={`chip ${alloc.status}`}>{alloc.status}</span>
                            {alloc.status !== 'pending' && alloc.actedById && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}>
                                Processed by Officer: <strong>{alloc.actedBy}</strong> <span style={{fontSize: '0.6rem'}}>[{alloc.actedById}]</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </div>
                      <div style={{fontSize: '0.85rem', display:'flex', justifyContent:'space-between', marginBottom: 12}}>
                        <div><span style={{color:'var(--color-text-secondary)'}}>Requested:</span> {formatMoneySmart(alloc.requested)}</div>
                        <div><span style={{color:'var(--color-text-secondary)'}}>Current:</span> {formatMoneySmart(alloc.allocated)}</div>
                      </div>
                      <div style={{fontSize: '0.8rem', color:'var(--color-text-secondary)', marginBottom: 12}}>
                        Justification: "{alloc.justification}"
                      </div>
                      <div style={{display:'flex', gap:8}}>
                        <button className="btn btn-primary" style={{fontSize: '0.75rem'}} onClick={() => {
                          let draft = getDraft();
                          draft.allocations[dept.id].allocated = alloc.requested;
                          draft.allocations[dept.id].status = 'approved';
                          cascadeRecalc(draft, dept.id);
                          showToast('Approved', 'success');
                          syncState(draft);
                        }}>Approve Request</button>
                        <button className="btn" style={{fontSize: '0.75rem'}} onClick={() => {
                          let draft = getDraft();
                          draft.allocations[dept.id].requested = alloc.allocated;
                          draft.allocations[dept.id].status = 'approved';
                          syncState(draft);
                        }}>Reject / Clear Diff</button>
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>
          <div className="card">
            <h3>Full Negotiation Log</h3>
            <div className="chat-box" style={{height: 500}}>
              <div className="chat-messages" ref={chatNegRef}>
                {appState.chatMessages.map((m, i) => {
                  let dept = getDept(m.deptId) || { name: 'Legacy Dept', head: 'Former Staff', colorIdx: 0 };
                  return (
                    <div key={i} className="chat-msg">
                      <div className="msg-avatar" style={{background:DEPT_BG_COLORS[dept.colorIdx] || '#e5e7eb', color:DEPT_TEXT_COLORS[dept.colorIdx] || '#6b7280'}}>{getInitials(dept.head)}</div>
                      <div>
                        <div className="msg-meta">{dept.name} · {new Date(m.time).toLocaleTimeString()}</div>
                        <div className="msg-body">{m.msg}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="chat-input-area">
                <input type="text" className="form-control" value={chatInputNeg} onChange={e => setChatInputNeg(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat('neg')} placeholder="Type a message..." />
                <button className="btn btn-primary" onClick={() => sendChat('neg')}>Send</button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <main className="tab-content" style={{ display: tab === 'audit' ? 'block' : 'none' }}>
        <div className="single-col">
          <div className="card">
            <h3>Comprehensive Audit Trail</h3>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Department</th>
                  <th>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {appState.auditLog.map((l, i) => (
                  <tr key={i}>
                    <td>{new Date(l.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(l.time).toLocaleTimeString()}</td>
                    <td><span className={`chip ${l.type === 'success' ? 'approved' : (l.type === 'danger' ? 'conflict' : l.type)}`}>{l.action}</span></td>
                    <td>{l.dept}</td>
                    <td>{l.amount ? formatMoneySmart(l.amount) : '-'}</td>
                    <td>{l.extra || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <main className="tab-content" style={{ display: tab === 'analytics' ? 'block' : 'none' }}>
        <div className="single-col">
          <div className="metric-grid">
            <div className="card metric-card">
              <div className="metric-label">Total Allocated</div>
              <div className="metric-value">{formatMoneySmart(totalAlloc)}</div>
            </div>
            <div className="card metric-card">
              <div className="metric-label">Pool Utilization</div>
              <div className="metric-value">{poolPct}%</div>
            </div>
            <div className="card metric-card">
              <div className="metric-label">Active Conflicts</div>
              <div className="metric-value">{appState.conflicts.length}</div>
            </div>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24}}>
            <div className="card">
              <h3>Allocation Distribution</h3>
              <Bar 
                data={{
                  labels: chartLabels,
                  datasets: [{ label: 'Allocated ($K)', data: chartAllocated, backgroundColor: chartColors, borderRadius: 4 }]
                }} 
                options={{ responsive: true, plugins: { legend: { display: false } } }} 
              />
            </div>
            <div className="card">
              <h3>Requested vs Allocated</h3>
              <Bar 
                data={{
                  labels: chartLabels,
                  datasets: [
                    { label: 'Requested ($K)', data: chartRequested, backgroundColor: '#e4e4e7', borderRadius: 4 },
                    { label: 'Allocated ($K)', data: chartAllocated, backgroundColor: chartColors, borderRadius: 4 }
                  ]
                }} 
                options={{ responsive: true }} 
              />
            </div>
          </div>
        </div>
      </main>

      <div id="toast-container">
        {toast && (
          <div className={`toast ${toast.type}`}>
            <strong>{toast.type.toUpperCase()}:</strong> {toast.msg}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
