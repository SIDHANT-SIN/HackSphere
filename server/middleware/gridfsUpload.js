// middleware/gridfsUpload.js
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';
import dotenv from 'dotenv';

dotenv.config();

const storage = new GridFsStorage({
  url: process.env.MONGO_URI,
  options: { useNewUrlParser: true, useUnifiedTopology: true },
  file: (req, file) => ({
    filename: `${Date.now()}-${file.originalname}`,
    bucketName: 'uploads',
    metadata: {
      roomId: req.body.roomId,
      uploadedBy: req.body.username,
      originalName: file.originalname,
      uploadDate: new Date()
    }
  })
});

export const upload = multer({ storage });
