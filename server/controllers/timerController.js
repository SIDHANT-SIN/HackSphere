import Timer from '../models/Timer.js';

export const createTimer = async (roomId, socketId) => {
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

export const updateTimer = async (roomId, update) => {
  const timer = await Timer.findOneAndUpdate(
    { roomId },
    { $set: update },
    { new: true }
  );
  return timer;
};

export const addTimerLog = async (roomId, action, user) => {
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
