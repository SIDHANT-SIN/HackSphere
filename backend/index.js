const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/hackathon-timer', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Notes Schema
const noteSchema = new mongoose.Schema({
  roomId: String,
  username: String,
  content: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Note = mongoose.model('Note', noteSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  roomId: String,
  username: String,
  message: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model('Message', messageSchema);

// Timer Schema
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

const Timer = mongoose.model('Timer', timerSchema);

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store active rooms and their users
const rooms = new Map(); // roomId -> Map<socketId, username>
const usernames = new Map(); // roomId -> Set<username>

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Timer helper functions
const createTimer = async (roomId, socketId) => {
  const timer = new Timer({
    roomId,
    status: 'paused',
    remainingTime: 0,
    startTime: null,
    lastUpdateBy: socketId,
    log: []
  });
  await timer.save();
  return timer;
};

const updateTimer = async (roomId, update) => {
  const timer = await Timer.findOneAndUpdate(
    { roomId },
    { $set: update },
    { new: true }
  );
  return timer;
};

const addTimerLog = async (roomId, action, user) => {
  await Timer.findOneAndUpdate(
    { roomId },
    {
      $push: {
        log: {
          action,
          user,
          timestamp: new Date()
        }
      }
    }
  );
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Test connection
  socket.on('test', (data) => {
    console.log('Received test message from client:', data);
    socket.emit('test_response', { message: 'Hello from server!' });
  });

  socket.on('username:check', ({ roomId, username }) => {
    // Initialize room structures if they don't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
      usernames.set(roomId, new Set());
    }

    // Check if username is taken in the room
    if (usernames.get(roomId).has(username)) {
      socket.emit('username:response', {
        valid: false,
        message: 'Username is already taken in this room'
      });
    } else {
      socket.emit('username:response', { valid: true });
    }
  });

  socket.on('joinRoom', ({ roomId, username }) => {
    // Check if user is already in the room
    const existingUsername = rooms.get(roomId)?.get(socket.id);
    if (existingUsername === username) {
      return; // User is already in the room with the same username
    }

    // Initialize room structures if they don't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
      usernames.set(roomId, new Set());
    }

    // Add user to room
    socket.join(roomId);
    rooms.get(roomId).set(socket.id, username);
    usernames.get(roomId).add(username);

    // Load previous messages
    Message.find({ roomId })
      .sort({ timestamp: 1 })
      .limit(100)
      .then(messages => {
        socket.emit('message:history', messages);
      })
      .catch(err => {
        console.error('Error loading message history:', err);
      });

    // Load notes for the room
    Note.find({ roomId })
      .sort({ timestamp: -1 })
      .then(notes => {
        socket.emit('notes:history', notes);
      })
      .catch(err => {
        console.error('Error loading notes:', err);
      });

    // Get or create timer for room
    Timer.findOne({ roomId }).then(timer => {
      if (!timer) {
        createTimer(roomId, socket.id).then(newTimer => {
          socket.emit('timer:update', newTimer);
        });
      } else {
        socket.emit('timer:update', timer);
      }
    });

    // Save and emit join message
    const systemMessage = new Message({
      roomId,
      username: 'System',
      message: `${username} has joined the room`,
      timestamp: new Date()
    });
    
    systemMessage.save()
      .then(() => {
        io.to(roomId).emit('message', systemMessage);
      })
      .catch(err => console.error('Error saving system message:', err));
  });

  socket.on('leaveRoom', ({ roomId, username }) => {
    if (rooms.has(roomId)) {
      // Remove user from room
      rooms.get(roomId).delete(socket.id);
      usernames.get(roomId).delete(username);

      // Clean up room if empty
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
        usernames.delete(roomId);
      } else {
        // Save and emit leave message
        const systemMessage = new Message({
          roomId,
          username: 'System',
          message: `${username} has left the room`,
          timestamp: new Date()
        });
        
        systemMessage.save()
          .then(() => {
            io.to(roomId).emit('message', systemMessage);
          })
          .catch(err => console.error('Error saving system message:', err));
      }
    }
    socket.leave(roomId);
  });

  socket.on('message', async ({ roomId, message, username }) => {
    console.log(`New message in room ${roomId} from ${username}:`, message);
    
    // Create and save the message
    const newMessage = new Message({
      roomId,
      username,
      message,
      timestamp: new Date()
    });

    try {
      await newMessage.save();
      console.log('Message saved successfully:', newMessage);
      
      // Broadcast the message to all users in the room
      io.to(roomId).emit('message', {
        username,
        message,
        timestamp: newMessage.timestamp
      });
    } catch (err) {
      console.error('Error saving message:', err);
      socket.emit('message:error', { error: 'Failed to save message' });
    }
  });

  // Timer events
  socket.on('timer:set', async ({ roomId, totalSeconds }) => {
    const username = rooms.get(roomId)?.get(socket.id);
    const timer = await updateTimer(roomId, {
      status: 'paused',
      remainingTime: totalSeconds,
      startTime: null,
      lastUpdateBy: username || socket.id
    });
    
    if (timer) {
      await addTimerLog(roomId, 'set timer', username || socket.id);
      io.to(roomId).emit('timer:update', timer);
    }
  });

  socket.on('timer:start', async ({ roomId }) => {
    const username = rooms.get(roomId)?.get(socket.id);
    const timer = await updateTimer(roomId, {
      status: 'running',
      startTime: new Date(),
      lastUpdateBy: username || socket.id
    });
    
    if (timer) {
      await addTimerLog(roomId, 'started timer', username || socket.id);
      io.to(roomId).emit('timer:update', timer);
    }
  });

  socket.on('timer:pause', async ({ roomId }) => {
    const username = rooms.get(roomId)?.get(socket.id);
    const timer = await Timer.findOne({ roomId });
    if (timer && timer.status === 'running') {
      const now = new Date();
      const elapsed = Math.floor((now - timer.startTime) / 1000);
      const remaining = Math.max(0, timer.remainingTime - elapsed);
      
      const updatedTimer = await updateTimer(roomId, {
        status: 'paused',
        remainingTime: remaining,
        startTime: null,
        lastUpdateBy: username || socket.id
      });
      
      if (updatedTimer) {
        await addTimerLog(roomId, 'paused timer', username || socket.id);
        io.to(roomId).emit('timer:update', updatedTimer);
      }
    }
  });

  socket.on('timer:resume', async ({ roomId }) => {
    console.log(`Timer resume requested for room: ${roomId} by user: ${socket.id}`);
    const timer = await updateTimer(roomId, {
      status: 'running',
      startTime: new Date(),
      lastUpdateBy: socket.id
    });
    
    if (timer) {
      await addTimerLog(roomId, 'resumed timer', socket.id);
      io.to(roomId).emit('timer:update', timer);
    }
  });

  socket.on('timer:reset', async ({ roomId }) => {
    const username = rooms.get(roomId)?.get(socket.id);
    const timer = await updateTimer(roomId, {
      status: 'paused',
      remainingTime: 0,
      startTime: null,
      lastUpdateBy: username || socket.id
    });
    
    if (timer) {
      await addTimerLog(roomId, 'reset timer', username || socket.id);
      io.to(roomId).emit('timer:update', timer);
    }
  });

  // Notes events
  socket.on('note:add', async ({ roomId, username, content }) => {
    const newNote = new Note({
      roomId,
      username,
      content,
      timestamp: new Date()
    });

    try {
      await newNote.save();
      io.to(roomId).emit('note:added', newNote);
    } catch (err) {
      console.error('Error saving note:', err);
      socket.emit('note:error', { error: 'Failed to save note' });
    }
  });

  socket.on('note:delete', async ({ roomId, noteId, username }) => {
    try {
      const note = await Note.findById(noteId);
      if (note && note.username === username) {
        await Note.findByIdAndDelete(noteId);
        io.to(roomId).emit('note:deleted', { noteId });
      }
    } catch (err) {
      console.error('Error deleting note:', err);
      socket.emit('note:error', { error: 'Failed to delete note' });
    }
  });

  socket.on('disconnect', () => {
    // Clean up user from all rooms they were in
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        const username = users.get(socket.id);
        users.delete(socket.id);
        usernames.get(roomId).delete(username);
        
        if (users.size === 0) {
          rooms.delete(roomId);
          usernames.delete(roomId);
        } else {
          // Save and emit disconnect message
          const systemMessage = new Message({
            roomId,
            username: 'System',
            message: `${username} has disconnected`,
            timestamp: new Date()
          });
          
          systemMessage.save()
            .then(() => {
              io.to(roomId).emit('message', systemMessage);
            })
            .catch(err => console.error('Error saving system message:', err));
        }
      }
    });
  });
});

// Timer update interval
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 