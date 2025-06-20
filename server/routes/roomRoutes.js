import express from 'express';
import { checkRoomExists } from '../controllers/roomController.js';

const router = express.Router();

router.get('/room/:roomId/exists', checkRoomExists);

export default router;
