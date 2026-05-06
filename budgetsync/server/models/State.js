import mongoose from 'mongoose';

const StateSchema = new mongoose.Schema({
  allocations: { type: Object, required: true },
  conflicts: { type: Array, default: [] },
  auditLog: { type: Array, default: [] },
  chatMessages: { type: Array, default: [] },
  snapshots: { type: Array, default: [] }
}, { minimize: false, timestamps: true });

export default mongoose.model('State', StateSchema);
