import Message from '../models/Message.js';
import Note from '../models/Note.js';
import File from '../models/File.js';
import Timer from '../models/Timer.js';
import { updateTimer, addTimerLog, createTimer } from '../controllers/timerController.js';

const rooms = new Map();
const usernames = new Map();

const initSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    socket.on('test', (data) => {
      console.log('Received test message from client:', data);
      socket.emit('test_response', { message: 'Hello from server!' });
    });

    socket.on('username:check', ({ roomId, username }) => {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
        usernames.set(roomId, new Set());
      }

      const taken = usernames.get(roomId).has(username);
      socket.emit('username:response', {
        valid: !taken,
        message: taken ? 'Username is already taken in this room' : ''
      });
    });

    socket.on('joinRoom', async ({ roomId, username }) => {
      try {
        const existing = rooms.get(roomId)?.get(socket.id);
        if (existing === username) return;

        const isNewRoom =
          !rooms.has(roomId) &&
          !(await Message.exists({ roomId })) &&
          !(await File.exists({ roomId })) &&
          !(await Timer.exists({ roomId })) &&
          !(await Note.exists({ roomId }));

        if (isNewRoom) {
          rooms.set(roomId, new Map());
          usernames.set(roomId, new Set());
          await createTimer(roomId, socket.id);
        }

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
          usernames.set(roomId, new Set());
        }

        socket.join(roomId);
        rooms.get(roomId).set(socket.id, username);
        usernames.get(roomId).add(username);

        socket.emit('room:joined', { isNewRoom });

        const messages = await Message.find({ roomId }).sort({ timestamp: 1 }).limit(100);
        socket.emit('message:history', messages);

        const notes = await Note.find({ roomId }).sort({ timestamp: -1 });
        socket.emit('notes:history', notes);

        let timer = await Timer.findOne({ roomId });
        if (!timer) {
          timer = await createTimer(roomId, socket.id);
        }
        socket.emit('timer:update', timer);

        const files = await File.find({ roomId }).sort({ uploadDate: -1 });
        socket.emit('files:list', files);

        const systemMessage = new Message({
          roomId,
          username: 'System',
          message: `${username} has joined the room`,
          timestamp: new Date()
        });

        await systemMessage.save();
        io.to(roomId).emit('message', systemMessage);

      } catch (err) {
        console.error('Error in joinRoom:', err);
        socket.emit('joinRoom:error', { error: 'Failed to join room' });
      }
    });

    socket.on('message', async ({ roomId, message, username }) => {
      const newMessage = new Message({ roomId, username, message, timestamp: new Date() });
      try {
        await newMessage.save();
        io.to(roomId).emit('message', {
          username,
          message,
          timestamp: newMessage.timestamp
        });
      } catch (err) {
        socket.emit('message:error', { error: 'Failed to save message' });
      }
    });

    // ✅ Note add
    socket.on('note:add', async ({ roomId, username, content }) => {
      try {
        const newNote = new Note({
          roomId,
          username,
          content,
          timestamp: new Date()
        });
        await newNote.save();
        io.to(roomId).emit('note:added', newNote);
      } catch (err) {
        console.error('Error adding note:', err);
        socket.emit('note:error', { error: 'Failed to add note' });
      }
    });

    // ✅ Note delete
    socket.on('note:delete', async ({ roomId, noteId, username }) => {
      try {
        await Note.deleteOne({ _id: noteId, roomId });
        io.to(roomId).emit('note:deleted', { noteId });
      } catch (err) {
        console.error('Error deleting note:', err);
        socket.emit('note:error', { error: 'Failed to delete note' });
      }
    });

    // ✅ File uploaded (triggered by API after upload)
    socket.on('file:uploaded', async ({ fileId, roomId, username }) => {
      try {
        const file = await File.findById(fileId);
        if (file) {
          io.to(roomId).emit('file:added', file);
        }
      } catch (err) {
        console.error('Error sending uploaded file:', err);
        socket.emit('file:error', { error: 'Failed to send uploaded file' });
      }
    });

    // ✅ File deleted (triggered by API after deletion)
    socket.on('file:deleted', async ({ fileId, roomId }) => {
      try {
        io.to(roomId).emit('file:removed', { fileId });
      } catch (err) {
        console.error('Error broadcasting file deletion:', err);
        socket.emit('file:error', { error: 'Failed to notify file deletion' });
      }
    });

    socket.on('leaveRoom', async ({ roomId, username }) => {
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(socket.id);
        usernames.get(roomId).delete(username);

        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
          usernames.delete(roomId);
        } else {
          const systemMessage = new Message({
            roomId,
            username: 'System',
            message: `${username} has left the room`,
            timestamp: new Date()
          });

          await systemMessage.save();
          io.to(roomId).emit('message', systemMessage);
        }
      }
      socket.leave(roomId);
    });

    socket.on('disconnect', () => {
      rooms.forEach((users, roomId) => {
        if (users.has(socket.id)) {
          const username = users.get(socket.id);
          users.delete(socket.id);
          usernames.get(roomId)?.delete(username);

          if (users.size === 0) {
            rooms.delete(roomId);
            usernames.delete(roomId);
          } else {
            const systemMessage = new Message({
              roomId,
              username: 'System',
              message: `${username} has disconnected`,
              timestamp: new Date()
            });

            systemMessage.save()
              .then(() => io.to(roomId).emit('message', systemMessage))
              .catch(err => console.error('Error saving disconnect message:', err));
          }
        }
      });
    });

    // Timer: Set duration
    socket.on('timer:set', async ({ roomId, totalSeconds }) => {
      try {
        const updatedTimer = await updateTimer(roomId, {
          remainingTime: totalSeconds,
          status: 'paused',
          startTime: null
        });
        if (updatedTimer) {
          await addTimerLog(roomId, 'set', socket.id);
          io.to(roomId).emit('timer:update', updatedTimer);
        }
      } catch (err) {
        console.error('Error setting timer:', err);
      }
    });

    // Timer: Start
    socket.on('timer:start', async ({ roomId }) => {
      try {
        const timer = await Timer.findOne({ roomId });
        if (timer && timer.status !== 'running' && timer.remainingTime > 0) {
          const updatedTimer = await updateTimer(roomId, {
            status: 'running',
            startTime: new Date()
          });
          if (updatedTimer) {
            await addTimerLog(roomId, 'start', socket.id);
            io.to(roomId).emit('timer:update', updatedTimer);
          }
        }
      } catch (err) {
        console.error('Error starting timer:', err);
      }
    });

    // Timer: Pause
    socket.on('timer:pause', async ({ roomId }) => {
      try {
        const timer = await Timer.findOne({ roomId });
        if (timer && timer.status === 'running') {
          const now = new Date();
          const elapsed = Math.floor((now - timer.startTime) / 1000);
          const remaining = Math.max(0, timer.remainingTime - elapsed);
          const updatedTimer = await updateTimer(roomId, {
            status: 'paused',
            remainingTime: remaining,
            startTime: null
          });
          if (updatedTimer) {
            await addTimerLog(roomId, 'pause', socket.id);
            io.to(roomId).emit('timer:update', updatedTimer);
          }
        }
      } catch (err) {
        console.error('Error pausing timer:', err);
      }
    });

    // Timer: Reset
    socket.on('timer:reset', async ({ roomId }) => {
      try {
        const updatedTimer = await updateTimer(roomId, {
          status: 'paused',
          remainingTime: 0,
          startTime: null
        });
        if (updatedTimer) {
          await addTimerLog(roomId, 'reset', socket.id);
          io.to(roomId).emit('timer:update', updatedTimer);
        }
      } catch (err) {
        console.error('Error resetting timer:', err);
      }
    });
  });

  // ⏲️ Timer polling loop
  setInterval(async () => {
    try {
      const runningTimers = await Timer.find({ status: 'running' });
      for (const timer of runningTimers) {
        if (timer.startTime) {
          const now = new Date();
          const elapsed = Math.floor((now - timer.startTime) / 1000);
          const remaining = Math.max(0, timer.remainingTime - elapsed);

          if (remaining === 0) {
            const updatedTimer = await updateTimer(timer.roomId, {
              status: 'ended',
              remainingTime: 0,
              startTime: null
            });
            if (updatedTimer) {
              await addTimerLog(timer.roomId, 'timer ended', 'system');
              io.to(timer.roomId).emit('timer:update', updatedTimer);
            }
          } else {
            io.to(timer.roomId).emit('timer:update', {
              ...timer.toObject(),
              remainingTime: remaining
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in timer update interval:', error);
    }
  }, 1000);
};

export default initSocketHandlers;
