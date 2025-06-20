import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  roomId: String,
  username: String,
  content: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Note', noteSchema);
