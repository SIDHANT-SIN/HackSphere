// controllers/fileController.js
import path from 'path';
import fs from 'fs';
import File from '../models/File.js';

export const uploadFile = async (req, res) => {
  try {
    const { roomId, username } = req.body;

    const newFile = new File({
      roomId,
      uploadedBy: username,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      uploadDate: new Date()
    });

    await newFile.save();
    const io = req.app.get('io');
    io.to(roomId).emit('file:uploaded', newFile);

    res.status(201).json({ message: 'File uploaded', file: newFile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

export const getFileUrl = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    res.json({ downloadUrl: `/uploads/${file.filename}` });
  } catch (err) {
    res.status(500).json({ error: 'Error getting file URL' });
  }
};

export const downloadFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.resolve(file.path);
    res.download(filePath, file.originalName);
  } catch (err) {
    res.status(500).json({ error: 'Error downloading file' });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    if (file.path) {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        if (err.code !== 'ENOENT') throw err; // Only ignore "file not found" errors
      }
    } // If file.path is undefined, skip unlink

    await file.deleteOne();

    const io = req.app.get('io');
    io.to(file.roomId).emit('file:deleted', file._id);

    res.json({ message: 'File deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Error deleting file' });
  }
};