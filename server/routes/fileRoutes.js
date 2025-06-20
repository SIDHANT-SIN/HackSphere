// routes/fileRoutes.js
import express from 'express';
import { upload } from '../middleware/upload.js';
import { uploadFile, downloadFile, getFileUrl, deleteFile } from '../controllers/fileController.js';

const router = express.Router();

router.post('/upload', upload.single('file'), uploadFile);
router.get('/file/url/:fileId', getFileUrl);
router.get('/download/:fileId', downloadFile);
router.delete('/file/:fileId', deleteFile);

export default router;
