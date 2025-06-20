import Message from '../models/Message.js';
import File from '../models/File.js';
import Timer from '../models/Timer.js';
import Note from '../models/Note.js';
import { rooms } from '../utils/roomStore.js'; // optional, or import directly where needed

export const checkRoomExists = async (req, res) => {
  try {
    const { roomId } = req.params;

    const [hasMessages, hasFiles, hasTimer, hasNotes] = await Promise.all([
      Message.exists({ roomId }),
      File.exists({ roomId }),
      Timer.exists({ roomId }),
      Note.exists({ roomId })
    ]);

    const roomExists = hasMessages || hasFiles || hasTimer || hasNotes || rooms.has(roomId);
    res.json({ exists: roomExists });
  } catch (err) {
    console.error('Room check error:', err);
    res.status(500).json({ error: 'Error checking room existence' });
  }
};
