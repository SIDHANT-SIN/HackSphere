import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  roomId: String,
  uploadedBy: String,
  fileId: mongoose.Types.ObjectId,
  uploadDate: {
    type: Date,
    default: Date.now
  },
  size: Number,
  mimetype: String
});

export default mongoose.model('File', fileSchema);
