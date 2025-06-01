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
const rooms = new Map();

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

  socket.on('createRoom', async (roomId) => {
    console.log(`Room created: ${roomId} by user: ${socket.id}`);
    rooms.set(roomId, new Set());
    socket.join(roomId);
    
    const timer = await createTimer(roomId, socket.id);
    if (timer) {
      io.to(roomId).emit('timer:update', timer);
    }
  });

  socket.on('joinRoom', async (roomId) => {
    console.log(`User ${socket.id} joined room: ${roomId}`);
    socket.join(roomId);
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    let timer = await Timer.findOne({ roomId });
    if (!timer) {
      timer = await createTimer(roomId, socket.id);
    }
    if (timer) {
      socket.emit('timer:update', timer);
    }
  });

  socket.on('leaveRoom', (roomId) => {
    console.log(`User ${socket.id} left room: ${roomId}`);
    socket.leave(roomId);
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      }
    }
  });

  socket.on('message', ({ roomId, message }) => {
    io.to(roomId).emit('message', {
      user: socket.id,
      message: message
    });
  });

  // Timer events
  socket.on('timer:set', async ({ roomId, totalSeconds }) => {
    console.log(`Setting timer for room: ${roomId} to ${totalSeconds} seconds`);
    const timer = await updateTimer(roomId, {
      status: 'paused',
      remainingTime: totalSeconds,
      startTime: null,
      lastUpdateBy: socket.id
    });
    
    if (timer) {
      await addTimerLog(roomId, 'set timer', socket.id);
      io.to(roomId).emit('timer:update', timer);
    }
  });

  socket.on('timer:start', async ({ roomId }) => {
    console.log(`Timer start requested for room: ${roomId} by user: ${socket.id}`);
    const timer = await updateTimer(roomId, {
      status: 'running',
      startTime: new Date(),
      lastUpdateBy: socket.id
    });
    
    if (timer) {
      await addTimerLog(roomId, 'started timer', socket.id);
      io.to(roomId).emit('timer:update', timer);
    }
  });

  socket.on('timer:pause', async ({ roomId }) => {
    console.log(`Timer pause requested for room: ${roomId} by user: ${socket.id}`);
    const timer = await Timer.findOne({ roomId });
    if (timer && timer.status === 'running') {
      const now = new Date();
      const elapsed = Math.floor((now - timer.startTime) / 1000);
      const remaining = Math.max(0, timer.remainingTime - elapsed);
      
      const updatedTimer = await updateTimer(roomId, {
        status: 'paused',
        remainingTime: remaining,
        startTime: null,
        lastUpdateBy: socket.id
      });
      
      if (updatedTimer) {
        await addTimerLog(roomId, 'paused timer', socket.id);
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
    console.log(`Timer reset requested for room: ${roomId} by user: ${socket.id}`);
    const timer = await updateTimer(roomId, {
      status: 'paused',
      remainingTime: 0,
      startTime: null,
      lastUpdateBy: socket.id
    });
    
    if (timer) {
      await addTimerLog(roomId, 'reset timer', socket.id);
      io.to(roomId).emit('timer:update', timer);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        if (users.size === 0) {
          rooms.delete(roomId);
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