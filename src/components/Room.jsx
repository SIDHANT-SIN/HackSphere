import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../socket';

function Room() {
  const { roomId } = useParams();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [time, setTime] = useState(48 * 60 * 60); // 48 hours in seconds
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');

  useEffect(() => {
    // Join room when component mounts
    console.log('Joining room:', roomId);
    socket.emit('joinRoom', roomId);

    // Listen for messages
    socket.on('message', (msg) => {
      console.log('Received message:', msg);
      setMessages((prev) => [...prev, msg]);
    });

    // Listen for timer updates
    socket.on('timer:update', (updatedTimer) => {
      console.log('Timer update received:', updatedTimer);
      if (updatedTimer && typeof updatedTimer.remainingTime === 'number') {
        setTime(updatedTimer.remainingTime);
      }
    });

    // Add connection status logging
    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // Cleanup on unmount
    return () => {
      socket.off('message');
      socket.off('timer:update');
      socket.off('connect');
      socket.off('disconnect');
      socket.emit('leaveRoom', roomId);
    };
  }, [roomId]);

  const handleSetTime = () => {
    const totalSeconds = 
      (parseInt(hours) || 0) * 3600 + 
      (parseInt(minutes) || 0) * 60 + 
      (parseInt(seconds) || 0);
    
    if (totalSeconds <= 0) {
      alert('Please enter a valid time greater than 0');
      return;
    }
    
    console.log('Setting timer to:', totalSeconds, 'seconds');
    socket.emit('timer:set', { roomId, totalSeconds });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('message', { roomId, message });
      setMessage('');
    }
  };

  const startTimer = () => {
    console.log('Emitting timer:start event');
    socket.emit('timer:start', { roomId });
  };

  const pauseTimer = () => {
    console.log('Emitting timer:pause event');
    socket.emit('timer:pause', { roomId });
  };

  const resetTimer = () => {
    console.log('Emitting timer:reset event');
    socket.emit('timer:reset', { roomId });
    setHours('');
    setMinutes('');
    setSeconds('');
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Room: {roomId}</h1>
        
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

        {/* Messages Area */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4 h-96 overflow-y-auto">
          {messages.map((msg, index) => (
            <div key={index} className="mb-2">
              <span className="font-semibold">{msg.user}: </span>
              <span>{msg.message}</span>
            </div>
          ))}
        </div>

        {/* Message Input */}
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
    </div>
  );
}

export default Room; 