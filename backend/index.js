const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const mongoURI = 'mongodb://localhost:27017/hackathon-timer';
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Initialize GridFS
let gfs;
const conn = mongoose.connection;
conn.once('open', () => {
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return {
      filename: `${Date.now()}-${file.originalname}`,
      bucketName: 'uploads',
      metadata: {
        roomId: req.body.roomId,
        uploadedBy: req.body.username,
        originalName: file.originalname,
        uploadDate: new Date()
      }
    };
  }
});

const upload = multer({ storage });

// File Schema for tracking files in rooms
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

const File = mongoose.model('File', fileSchema);

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

// Helper function to get file from GridFS
const getFileFromStorage = async (fileId, roomId, username) => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new Error('Invalid file ID');
    }

    // Find file metadata
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    // Security check - verify room and permissions
    if (file.roomId !== roomId) {
      throw new Error('Unauthorized - file does not belong to this room');
    }

    // Get GridFS bucket
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });

    // Create download stream
    const downloadStream = bucket.openDownloadStream(file.fileId);

    return {
      stream: downloadStream,
      file: file
    };
  } catch (error) {
    throw error;
  }
};

// Generate temporary download URL
app.get('/file/url/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const roomId = req.headers['x-room-id'];
    const username = req.headers['x-username'];

    if (!roomId || !username) {
      return res.status(400).json({ error: 'Missing room ID or username' });
    }

    // Validate file exists and user has access
    await getFileFromStorage(fileId, roomId, username);

    // For simplicity, we'll just return the direct download URL
    // In production, you might want to generate a signed URL with expiration
    const downloadUrl = `/download/${fileId}`;
    res.json({ downloadUrl });
  } catch (error) {
    console.error('URL generation error:', error);
    const status = error.message.includes('not found') ? 404 :
                  error.message.includes('Unauthorized') ? 403 : 500;
    res.status(status).json({ error: error.message });
  }
});

// Secure file download endpoint
app.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const roomId = req.headers['x-room-id'];
    const username = req.headers['x-username'];

    if (!roomId || !username) {
      return res.status(400).json({ error: 'Missing room ID or username' });
    }

    const { stream, file } = await getFileFromStorage(fileId, roomId, username);

    // Set appropriate headers
    res.set({
      'Content-Type': file.mimetype,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`,
      'Content-Length': file.size
    });

    // Stream the file to response
    stream.pipe(res);

    // Handle errors during streaming
    stream.on('error', (error) => {
      console.error('Streaming error:', error);
      // Only send error if headers haven't been sent
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming file' });
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    const status = error.message.includes('not found') ? 404 :
                  error.message.includes('Unauthorized') ? 403 : 500;
    res.status(status).json({ error: error.message });
  }
});

// File upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const newFile = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      roomId: req.body.roomId,
      uploadedBy: req.body.username,
      fileId: req.file.id,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    await newFile.save();

    // Notify all users in the room about the new file
    io.to(req.body.roomId).emit('file:uploaded', {
      _id: newFile._id,
      filename: newFile.filename,
      originalName: newFile.originalName,
      uploadedBy: newFile.uploadedBy,
      uploadDate: newFile.uploadDate,
      size: newFile.size,
      mimetype: newFile.mimetype
    });

    res.json(newFile);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Error uploading file' });
  }
});

// Delete file endpoint
app.delete('/file/:fileId', async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Only allow deletion by the uploader
    if (file.uploadedBy !== req.query.username) {
      return res.status(403).json({ error: 'Unauthorized - only the uploader can delete this file' });
    }

    // Get GridFS bucket
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads'
    });

    try {
      // Delete file from GridFS
      await bucket.delete(file.fileId);
    } catch (gridfsError) {
      console.error('GridFS delete error:', gridfsError);
      // If file doesn't exist in GridFS, continue with metadata cleanup
      if (!gridfsError.message.includes('FileNotFound')) {
        throw gridfsError;
      }
    }

    // Delete file metadata
    await File.findByIdAndDelete(req.params.fileId);

    // Notify room about file deletion
    io.to(file.roomId).emit('file:deleted', { fileId: req.params.fileId });

    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Error deleting file' });
  }
});

// Check if room exists
app.get('/room/:roomId/exists', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Check for any room data (messages, files, timer, or notes)
    const [hasMessages, hasFiles, hasTimer, hasNotes] = await Promise.all([
      Message.exists({ roomId }),
      File.exists({ roomId }),
      Timer.exists({ roomId }),
      Note.exists({ roomId })
    ]);

    // Room exists if it has any data or if it's currently active in memory
    const roomExists = hasMessages || hasFiles || hasTimer || hasNotes || rooms.has(roomId);

    res.json({ exists: roomExists });
  } catch (err) {
    console.error('Room check error:', err);
    res.status(500).json({ error: 'Error checking room existence' });
  }
});

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

  socket.on('joinRoom', async ({ roomId, username }) => {
    try {
      // Check if user is already in the room
      const existingUsername = rooms.get(roomId)?.get(socket.id);
      if (existingUsername === username) {
        return; // User is already in the room with the same username
      }

      // For new rooms, we'll allow the first user to create it
      const isNewRoom = !rooms.has(roomId) && 
                       !(await Message.exists({ roomId })) && 
                       !(await File.exists({ roomId })) && 
                       !(await Timer.exists({ roomId })) && 
                       !(await Note.exists({ roomId }));

      if (isNewRoom) {
        // Initialize room structures for new room
        rooms.set(roomId, new Map());
        usernames.set(roomId, new Set());
        
        // Create initial timer for new room
        await createTimer(roomId, socket.id);
      }

      // Initialize room structures if they don't exist (for active rooms)
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
        usernames.set(roomId, new Set());
      }

      // Add user to room
      socket.join(roomId);
      rooms.get(roomId).set(socket.id, username);
      usernames.get(roomId).add(username);

      // Emit room status to client
      socket.emit('room:joined', { isNewRoom });

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

      // Send files list for the room
      File.find({ roomId })
        .sort({ uploadDate: -1 })
        .then(files => {
          socket.emit('files:list', files);
        })
        .catch(err => {
          console.error('Error loading files:', err);
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
    } catch (err) {
      console.error('Error in joinRoom:', err);
      socket.emit('joinRoom:error', { error: 'Failed to join room' });
    }
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