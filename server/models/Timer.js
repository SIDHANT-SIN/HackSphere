import mongoose from 'mongoose';

const timerSchema = new mongoose.Schema({
  roomId: String,
  status: String,
  remainingTime: Number,
  startTime: Date,
  lastUpdateBy: String,
  log: [{
    action: String,
    user: String,
    timestamp: Date
  }]
});

export default mongoose.model('Timer', timerSchema);
