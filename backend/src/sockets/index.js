const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io;
let _emitMatchUpdate;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || '').split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // JWT auth middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} [user: ${socket.userId}]`);

    // Join a match room to receive live updates
    socket.on('JOIN_MATCH', async (matchId) => {
      if (!matchId) return;
      socket.join(`match:${matchId}`);
      logger.info(`Socket ${socket.id} joined match:${matchId}`);
      socket.emit('JOINED_MATCH', { matchId });
    });

    socket.on('LEAVE_MATCH', (matchId) => {
      socket.leave(`match:${matchId}`);
      logger.info(`Socket ${socket.id} left match:${matchId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} [${reason}]`);
    });

    socket.on('error', (err) => {
      logger.error(`Socket error: ${socket.id}`, err);
    });
  });

  _emitMatchUpdate = (matchId, event, data) => {
    if (!io) return;
    io.to(`match:${matchId}`).emit(event, {
      matchId,
      timestamp: new Date().toISOString(),
      ...data,
    });
  };

  logger.info('Socket.IO initialised');
  return io;
};

const emitMatchUpdate = (matchId, event, data) => {
  if (_emitMatchUpdate) _emitMatchUpdate(matchId, event, data);
};

const getIO = () => io;

module.exports = { initSocket, emitMatchUpdate, getIO };
