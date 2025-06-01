import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../socket';

function Room() {
  const { roomId } = useParams();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [time, setTime] = useState(48 * 60 * 60); // 48 hours in seconds

  useEffect(() => {
    // Join room when component mounts
    socket.emit('joinRoom', roomId);

    // Listen for messages
    socket.on('message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Listen for timer updates
    socket.on('timerUpdate', (remainingTime) => {
      setTime(remainingTime);
    });

    // Cleanup on unmount
    return () => {
      socket.off('message');
      socket.off('timerUpdate');
      socket.emit('leaveRoom', roomId);
    };
  }, [roomId]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('message', { roomId, message });
      setMessage('');
    }
  };

  const startTimer = () => {
    socket.emit('timerStart', roomId);
  };

  const pauseTimer = () => {
    socket.emit('timerPause', roomId);
  };

  const resetTimer = () => {
    socket.emit('timerReset', roomId);
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Room: {roomId}</h1>
        
        {/* Timer Section */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h2 className="text-xl font-semibold mb-2">Timer</h2>
          <div className="text-3xl font-mono text-center mb-2">{formatTime(time)}</div>
          <div className="flex justify-center space-x-2">
            <button onClick={startTimer} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Start</button>
            <button onClick={pauseTimer} className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">Pause</button>
            <button onClick={resetTimer} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Reset</button>
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