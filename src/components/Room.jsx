import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [time, setTime] = useState(48 * 60 * 60); // 48 hours in seconds
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [showTimerEndAlert, setShowTimerEndAlert] = useState(false);
  const [username, setUsername] = useState('');

  // Function to filter out redundant system messages
  const addMessageWithFilter = (newMsg, currentMessages) => {
    // If it's not a system message, just add it
    if (newMsg.username !== 'System') {
      return [...currentMessages, newMsg];
    }

    // For system messages, check if it's a redundant join/leave message
    const lastMsg = currentMessages[currentMessages.length - 1];
    if (lastMsg && lastMsg.username === 'System') {
      const isRedundantJoin = 
        newMsg.message.includes('has joined') && 
        lastMsg.message.includes('has joined') &&
        newMsg.message.split(' ')[0] === lastMsg.message.split(' ')[0];
      
      const isRedundantLeave = 
        newMsg.message.includes('has left') && 
        lastMsg.message.includes('has left') &&
        newMsg.message.split(' ')[0] === lastMsg.message.split(' ')[0];

      if (isRedundantJoin || isRedundantLeave) {
        // Replace the last message instead of adding a new one
        return [...currentMessages.slice(0, -1), newMsg];
      }
    }

    return [...currentMessages, newMsg];
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio();
      audio.src = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';
      audio.play();
    } catch (error) {
      console.log('Audio play failed:', error);
    }
  };

  useEffect(() => {
    // Check if we have username and roomId in localStorage
    const storedUsername = localStorage.getItem('username');
    const storedRoomId = localStorage.getItem('roomId');

    if (!storedUsername || !storedRoomId || storedRoomId !== roomId) {
      // If no username or wrong room, redirect to home
      navigate('/');
      return;
    }

    setUsername(storedUsername);

    socket.on('message', (msg) => {
      setMessages(prev => addMessageWithFilter(msg, prev));
    });

    socket.on('message:history', (history) => {
      // Filter out redundant system messages from history
      const filteredHistory = history.reduce((acc, msg) => {
        return addMessageWithFilter(msg, acc);
      }, []);
      setMessages(filteredHistory);
    });

    socket.on('message:error', (error) => {
      console.error('Message error:', error);
    });

    socket.on('notes:history', (history) => {
      setNotes(history);
    });

    socket.on('note:added', (note) => {
      setNotes(prev => [note, ...prev]);
    });

    socket.on('note:deleted', ({ noteId }) => {
      setNotes(prev => prev.filter(note => note._id !== noteId));
    });

    socket.on('note:error', (error) => {
      console.error('Note error:', error);
    });

    // Join the room after setting up listeners
    socket.emit('joinRoom', {
      roomId,
      username: storedUsername
    });

    socket.on('timer:update', (updatedTimer) => {
      if (updatedTimer && typeof updatedTimer.remainingTime === 'number') {
        setTime(updatedTimer.remainingTime);
        if (updatedTimer.status === 'ended') {
          setShowTimerEndAlert(true);
          playNotificationSound();
        }
      }
    });

    // Cleanup function
    return () => {
      socket.off('message');
      socket.off('message:history');
      socket.off('message:error');
      socket.off('timer:update');
      socket.off('notes:history');
      socket.off('note:added');
      socket.off('note:deleted');
      socket.off('note:error');
      socket.emit('leaveRoom', { roomId, username: storedUsername });
    };
  }, [roomId, navigate]);

  const handleSetTime = () => {
    const totalSeconds = 
      (parseInt(hours) || 0) * 3600 + 
      (parseInt(minutes) || 0) * 60 + 
      (parseInt(seconds) || 0);
    
    if (totalSeconds <= 0) {
      alert('Please enter a valid time greater than 0');
      return;
    }
    
    socket.emit('timer:set', { roomId, totalSeconds });
    setShowTimerEndAlert(false);
  };

  const startTimer = () => {
    socket.emit('timer:start', { roomId });
  };

  const pauseTimer = () => {
    socket.emit('timer:pause', { roomId });
  };

  const resetTimer = () => {
    socket.emit('timer:reset', { roomId });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      console.log('Sending message:', {
        roomId,
        message: message.trim(),
        username
      });
      socket.emit('message', {
        roomId,
        message: message.trim(),
        username
      });
      setMessage('');
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const leaveRoom = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('roomId');
    navigate('/');
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (newNote.trim()) {
      socket.emit('note:add', {
        roomId,
        username,
        content: newNote.trim()
      });
      setNewNote('');
    }
  };

  const handleDeleteNote = (noteId) => {
    socket.emit('note:delete', {
      roomId,
      noteId,
      username
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold">Room: {roomId}</h1>
            <span className="text-gray-600">Joined as: {username}</span>
          </div>
          <button
            onClick={leaveRoom}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Leave Room
          </button>
        </div>
        
        {/* Timer End Alert */}
        {showTimerEndAlert && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black opacity-50"></div>
            <div className="bg-white rounded-lg p-8 z-10 shadow-xl">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Time's Up!</h2>
              <p className="text-gray-700 mb-4">The timer has ended.</p>
              <button
                onClick={() => setShowTimerEndAlert(false)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Close
              </button>
            </div>
          </div>
        )}
        
        {/* Timer Section */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h2 className="text-xl font-semibold mb-2">Timer</h2>
          
          {/* Time Input Fields */}
          <div className="flex justify-center space-x-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Hours</label>
              <input
                type="number"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-20 px-2 py-1 border rounded"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-20 px-2 py-1 border rounded"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Seconds</label>
              <input
                type="number"
                min="0"
                max="59"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                className="w-20 px-2 py-1 border rounded"
                placeholder="0"
              />
            </div>
          </div>
          
          <div className="text-3xl font-mono text-center mb-4">{formatTime(time)}</div>
          
          <div className="flex justify-center space-x-2">
            <button 
              onClick={handleSetTime}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Set Time
            </button>
            <button 
              onClick={startTimer} 
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Start
            </button>
            <button 
              onClick={pauseTimer} 
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
            >
              Pause
            </button>
            <button 
              onClick={resetTimer} 
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Messages Section */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-semibold mb-3">Chat</h2>
            <div className="h-[400px] overflow-y-auto mb-4">
              {messages.map((msg, index) => (
                <div key={index} className={`mb-2 ${msg.username === 'System' ? 'text-center' : ''}`}>
                  {msg.username === 'System' ? (
                    <div className="text-xs text-gray-500 italic">
                      {msg.message}
                      {msg.timestamp && (
                        <span className="ml-2">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-baseline space-x-2">
                      <span className="font-semibold text-blue-600">{msg.username}:</span>
                      <span className="text-gray-800">{msg.message}</span>
                      {msg.timestamp && (
                        <span className="text-xs text-gray-500 ml-2">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 p-2 border rounded"
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Send
              </button>
            </form>
          </div>

          {/* Notes Section */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h2 className="text-xl font-semibold mb-3">Notes</h2>
            <form onSubmit={handleAddNote} className="mb-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note..."
                className="w-full p-2 border rounded mb-2 h-24 resize-none"
              />
              <button
                type="submit"
                className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Add Note
              </button>
            </form>
            <div className="h-[280px] overflow-y-auto space-y-3">
              {notes.map((note) => (
                <div key={note._id} className="bg-gray-50 rounded p-3 relative group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-blue-600">{note.username}</span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(note.timestamp)}
                    </span>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap">{note.content}</p>
                  {note.username === username && (
                    <button
                      onClick={() => handleDeleteNote(note._id)}
                      className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Room; 