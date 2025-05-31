import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

const Timer = ({ roomId }) => {
  const { socket, isConnected } = useSocket();
  const [timer, setTimer] = useState({
    status: 'paused',
    remainingTime: 0,
    lastUpdateBy: null
  });
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleTimerUpdate = (updatedTimer) => setTimer(updatedTimer);

    socket.on('timer:update', handleTimerUpdate);
    socket.emit('joinRoom', roomId);

    return () => {
      socket.off('timer:update', handleTimerUpdate);
      socket.emit('leaveRoom', roomId);
    };
  }, [socket, isConnected, roomId]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSetTime = () => {
    if (!socket || !isConnected) return;
    const totalSeconds =
      (parseInt(hours) || 0) * 3600 +
      (parseInt(minutes) || 0) * 60 +
      (parseInt(seconds) || 0);
    if (totalSeconds <= 0) {
      alert('Please enter a valid time greater than 0');
      return;
    }
    socket.emit('timer:set', { roomId, totalSeconds });
  };

  const handleStart = () => {
    if (!socket || !isConnected) return;
    socket.emit('timer:start', { roomId });
  };

  const handlePause = () => {
    if (!socket || !isConnected) return;
    socket.emit('timer:pause', { roomId });
  };

  const handleResume = () => {
    if (!socket || !isConnected) return;
    socket.emit('timer:resume', { roomId });
  };

  const handleReset = () => {
    if (!socket || !isConnected) return;
    socket.emit('timer:reset', { roomId });
    setHours('');
    setMinutes('');
    setSeconds('');
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Hackathon Timer</h2>
          <p className="text-red-500">Connecting to server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Hackathon Timer</h2>
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Set Timer Duration</h3>
          <div className="flex justify-center space-x-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="0"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seconds</label>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="0"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <button
            onClick={handleSetTime}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Set Time
          </button>
        </div>
        <div className="text-5xl font-mono mb-6 bg-gray-100 p-4 rounded-lg">
          {formatTime(timer.remainingTime)}
        </div>
        <div className="space-x-3">
          {timer.status === 'paused' && timer.remainingTime > 0 && (
            <button
              onClick={handleStart}
              className="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              Start
            </button>
          )}
          {timer.status === 'running' && (
            <button
              onClick={handlePause}
              className="bg-yellow-500 text-white px-6 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
            >
              Pause
            </button>
          )}
          {timer.status === 'paused' && timer.remainingTime > 0 && (
            <button
              onClick={handleResume}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Resume
            </button>
          )}
          <button
            onClick={handleReset}
            className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Reset
          </button>
        </div>
        <div className="mt-6 text-sm text-gray-600">
          {timer.lastUpdateBy && (
            <p className="mb-1">
              Last updated by: {timer.lastUpdateBy}
            </p>
          )}
          <p className="mb-1">
            Status: <span className="font-medium">{timer.status}</span>
          </p>
          <p>
            Connection: <span className="font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Timer; 