import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

function Room() {
  const { roomId } = useParams();
  const [time, setTime] = useState(48 * 60 * 60); // 48 hours in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [notes, setNotes] = useState('');

  // Timer functionality
  useEffect(() => {
    let interval;
    if (isTimerRunning && time > 0) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, time]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      setMessages([
        ...messages,
        {
          id: Date.now(),
          text: newMessage,
          sender: 'You',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setNewMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Room: {roomId}</h1>
          <p className="text-gray-600">Share this room ID with your team members to collaborate.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Timer Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Hackathon Timer</h2>
            <div className="text-4xl font-mono text-center mb-4">{formatTime(time)}</div>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`px-4 py-2 rounded-md ${
                  isTimerRunning ? 'bg-red-600' : 'bg-green-600'
                } text-white`}
              >
                {isTimerRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setTime(48 * 60 * 60);
                }}
                className="px-4 py-2 rounded-md bg-gray-600 text-white"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Chat Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Team Chat</h2>
            <div className="h-96 overflow-y-auto mb-4 p-4 border rounded-lg">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`mb-4 ${
                    message.sender === 'You' ? 'text-right' : 'text-left'
                  }`}
                >
                  <div
                    className={`inline-block rounded-lg p-3 ${
                      message.sender === 'You'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100'
                    }`}
                  >
                    <p className="font-medium text-sm">{message.sender}</p>
                    <p>{message.text}</p>
                    <p className="text-xs opacity-75">{message.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="flex space-x-4">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Send
              </button>
            </form>
          </div>

          {/* Shared Notes Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 lg:col-span-3">
            <h2 className="text-xl font-semibold mb-4">Shared Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Type your team notes here..."
              className="w-full h-64 p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Room; 