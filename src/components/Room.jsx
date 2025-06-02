import React, { useEffect, useState, useRef } from 'react';
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
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isNewRoom, setIsNewRoom] = useState(false);
  const [showRoomAlert, setShowRoomAlert] = useState(false);
  const fileInputRef = useRef(null);

  // Check if room exists
  const checkRoomExists = async () => {
    try {
      const response = await fetch(`http://localhost:3000/room/${roomId}/exists`);
      if (!response.ok) {
        throw new Error('Failed to check room status');
      }
      const { exists } = await response.json();
      return exists;
    } catch (error) {
      console.error('Room check error:', error);
      return false;
    }
  };

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

    // Check if room exists before joining
    const joinRoom = async () => {
      const roomExists = await checkRoomExists();
      
      if (!roomExists) {
        setShowRoomAlert(true);
        return;
      }

      setUsername(storedUsername);
      
      // Set up socket listeners
      socket.on('room:joined', ({ isNewRoom: newRoom }) => {
        setIsNewRoom(newRoom);
        if (newRoom) {
          alert('Welcome! You are the first person to join this room.');
        }
      });

      socket.on('joinRoom:error', (error) => {
        console.error('Join room error:', error);
        alert('Failed to join room. Please try again.');
        navigate('/');
      });

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

      socket.on('files:list', (filesList) => {
        setFiles(filesList);
      });

      socket.on('file:uploaded', (newFile) => {
        setFiles(prev => [newFile, ...prev]);
      });

      socket.on('file:deleted', ({ fileId }) => {
        setFiles(prev => prev.filter(file => file._id !== fileId));
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

      // Join the room
      socket.emit('joinRoom', {
        roomId,
        username: storedUsername
      });
    };

    joinRoom();

    // Cleanup function
    return () => {
      socket.off('room:joined');
      socket.off('joinRoom:error');
      socket.off('message');
      socket.off('message:history');
      socket.off('message:error');
      socket.off('timer:update');
      socket.off('notes:history');
      socket.off('note:added');
      socket.off('note:deleted');
      socket.off('note:error');
      socket.off('files:list');
      socket.off('file:uploaded');
      socket.off('file:deleted');
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileDownload = async (fileId, originalName) => {
    try {
      // First get the file download URL
      const urlResponse = await fetch(`http://localhost:3000/file/url/${fileId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Room-ID': roomId,
          'X-Username': username
        }
      });

      if (!urlResponse.ok) {
        const errorData = await urlResponse.json().catch(() => ({
          error: urlResponse.status === 404 ? 'File not found' :
                 urlResponse.status === 403 ? 'You do not have permission to download this file' :
                 'Failed to get download URL'
        }));
        throw new Error(errorData.error);
      }

      const { downloadUrl } = await urlResponse.json();
      
      // Now download the file using the URL
      const downloadResponse = await fetch(`http://localhost:3000${downloadUrl}`, {
        method: 'GET',
        headers: {
          'X-Room-ID': roomId,
          'X-Username': username
        }
      });

      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json().catch(() => ({
          error: downloadResponse.status === 404 ? 'File not found' :
                 downloadResponse.status === 403 ? 'You do not have permission to download this file' :
                 'Failed to download file'
        }));
        throw new Error(errorData.error);
      }

      // Get total file size for progress calculation
      const contentLength = downloadResponse.headers.get('Content-Length');
      const total = parseInt(contentLength, 10);
      
      // Create a ReadableStream to track download progress
      const reader = downloadResponse.body.getReader();
      const chunks = [];
      let receivedLength = 0;

      // Process the stream chunks
      while(true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Calculate and update progress
        if (total) {
          const progress = (receivedLength / total) * 100;
          setUploadProgress(progress); // Reuse upload progress state for downloads
        }
      }

      // Concatenate chunks into a single Uint8Array
      const chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      // Create blob and trigger download
      const blob = new Blob([chunksAll], { 
        type: downloadResponse.headers.get('Content-Type') || 'application/octet-stream' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = originalName;
      document.body.appendChild(link);
      link.click();
      
      // Reset progress
      setUploadProgress(null);
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

    } catch (error) {
      console.error('Download error:', error);
      setUploadProgress(null);
      alert(error.message || 'Failed to download file');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024; // 50MB limit
    if (file.size > maxSize) {
      alert('File size must be less than 50MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);
    formData.append('username', username);

    try {
      setUploadProgress(0);
      console.log('Starting upload:', { 
        fileName: file.name,
        fileSize: file.size,
        roomId,
        username 
      });

      const response = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        headers: {
          'X-Room-ID': roomId,
          'X-Username': username
        },
        body: formData
      });

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || 'Upload failed';
        } catch {
          errorMessage = 'Failed to upload file';
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Server response structure:', {
        resultType: typeof result,
        hasFileId: 'fileId' in result,
        has_id: '_id' in result,
        keys: Object.keys(result),
        fullResult: result
      });

      // Create a standardized file object using the correct ID
      const newFile = {
        _id: result.fileId || result._id, // Use fileId or _id as the primary identifier
        originalName: result.originalName || file.name,
        filename: result.filename,
        size: result.size || file.size,
        uploadedBy: result.uploadedBy || username,
        uploadDate: result.uploadDate || new Date().toISOString(),
        mimetype: result.mimetype || file.type,
        downloadUrl: result.downloadUrl // Store download URL if provided
      };

      // Update UI with the new file
      setFiles(prev => {
        // Remove any existing file with the same ID to prevent duplicates
        const filtered = prev.filter(f => f._id !== newFile._id);
        return [newFile, ...filtered];
      });

      setUploadProgress(100);
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reset progress after a delay
      setTimeout(() => setUploadProgress(null), 1000);

      // Notify success via socket
      socket.emit('file:uploaded', {
        fileId: newFile._id,
        roomId,
        username
      });

      // Show success message
      alert('File uploaded successfully!');

    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress(null);
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      alert(error.message);
    }
  };

  const handleFileDelete = async (fileId) => {
    try {
      console.log('Attempting to delete file:', fileId, 'by user:', username);
      
      const response = await fetch(`http://localhost:3000/file/${fileId}?username=${encodeURIComponent(username)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Room-ID': roomId,
          'X-Username': username
        }
      });

      // Log the response status for debugging
      console.log('Delete response status:', response.status);

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          console.log('Error response data:', errorData);
          errorMessage = errorData.error;
        } catch (jsonError) {
          console.log('Error parsing JSON response:', jsonError);
          errorMessage = response.status === 404 ? 'File not found' :
                        response.status === 403 ? 'You can only delete files you uploaded' :
                        response.status === 500 ? 'Server error while deleting file' :
                        'Failed to delete file';
        }
        throw new Error(errorMessage);
      }

      console.log('File deleted successfully');
      
      // Update the files list
      setFiles(prev => prev.filter(file => file._id !== fileId));
      
      // Notify others via socket
      socket.emit('file:deleted', {
        fileId,
        roomId,
        username
      });

    } catch (error) {
      console.error('Delete error:', error);
      alert(error.message);
    }
  };

  // Add upload progress tracking
  useEffect(() => {
    socket.on('upload:progress', (progress) => {
      setUploadProgress(progress);
    });

    return () => {
      socket.off('upload:progress');
    };
  }, []);

  // Add file list update listener
  useEffect(() => {
    socket.on('files:update', (updatedFiles) => {
      setFiles(updatedFiles);
    });

    return () => {
      socket.off('files:update');
    };
  }, []);

  // Room alert modal
  const RoomAlert = () => (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black opacity-50"></div>
      <div className="bg-white rounded-lg p-8 z-10 shadow-xl max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Room Not Found</h2>
        <p className="text-gray-700 mb-6">
          This room doesn't exist. Would you like to create a new room with this ID or go back to enter a different room ID?
        </p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Go Back
          </button>
          <button
            onClick={() => {
              setShowRoomAlert(false);
              setUsername(localStorage.getItem('username'));
              socket.emit('joinRoom', {
                roomId,
                username: localStorage.getItem('username')
              });
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Create Room
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {showRoomAlert && <RoomAlert />}
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

        <div className="grid grid-cols-3 gap-4">
          {/* Messages Section */}
          <div className="col-span-1 bg-white rounded-lg shadow-md p-4 flex flex-col h-[500px]">
            <h2 className="text-xl font-semibold mb-2">Chat</h2>
            {/* Messages container */}
            <div className="flex-1 overflow-y-auto mb-2 border rounded-lg bg-gray-50 p-2">
              {messages.map((msg, index) => (
                <div key={index} className={`mb-1 ${msg.username === 'System' ? 'text-center' : ''}`}>
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
            {/* Message input form */}
            <form onSubmit={sendMessage} className="flex gap-2 pt-1">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 p-1.5 border rounded text-sm"
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 text-sm flex-shrink-0"
              >
                Send
              </button>
            </form>
          </div>

          {/* Notes Section */}
          <div className="col-span-1 bg-white rounded-lg shadow-md p-4 flex flex-col h-[500px]">
            <h2 className="text-xl font-semibold mb-2">Notes</h2>
            <form onSubmit={handleAddNote} className="mb-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note..."
                className="w-full p-2 border rounded mb-2 h-20 resize-none text-sm"
              />
              <button
                type="submit"
                className="w-full bg-green-500 text-white px-4 py-1.5 rounded hover:bg-green-600 text-sm"
              >
                Add Note
              </button>
            </form>
            <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-50 p-2">
              {notes.map((note) => (
                <div key={note._id} className="bg-white rounded p-2 relative group mb-2">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-blue-600 text-sm">{note.username}</span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(note.timestamp)}
                    </span>
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.content}</p>
                  {note.username === username && (
                    <button
                      onClick={() => handleDeleteNote(note._id)}
                      className="absolute top-1 right-1 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Files Section */}
          <div className="col-span-1 bg-white rounded-lg shadow-md p-4 flex flex-col h-[500px]">
            <h2 className="text-xl font-semibold mb-2">Files</h2>
            <div className="mb-2">
              <label className="block w-full">
                <span className="sr-only">Choose file</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-1.5 file:px-3
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
              </label>
              {uploadProgress !== null && (
                <div className="mt-2">
                  <div className="h-1.5 bg-blue-200 rounded">
                    <div
                      className="h-1.5 bg-blue-600 rounded"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-50 p-2">
              {files.map((file) => (
                <div key={`file-${file._id}`} className="bg-white rounded p-2 relative group mb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 mr-4">
                      <div className="font-medium text-blue-600 truncate text-sm">
                        {file.originalName}
                      </div>
                      <div className="text-xs text-gray-500">
                        Uploaded by {file.uploadedBy} • {formatFileSize(file.size)} • {formatTimestamp(file.uploadDate)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {/* Primary download button */}
                      <button
                        onClick={() => handleFileDownload(file._id, file.originalName)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Download"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {/* Fallback direct download link if URL is available */}
                      {file.downloadUrl && (
                        <a
                          href={file.downloadUrl}
                          download={file.originalName}
                          className="text-green-600 hover:text-green-800 ml-2"
                          title="Direct Download"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" />
                          </svg>
                        </a>
                      )}
                      {file.uploadedBy === username && (
                        <button
                          onClick={() => handleFileDelete(file._id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
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