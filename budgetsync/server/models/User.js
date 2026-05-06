import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Disbursing Officer', 'Stakeholder'], default: 'Stakeholder' },
  department: { type: String, default: 'Viewer' },
  uniqueId: { type: String, unique: true, sparse: true },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
