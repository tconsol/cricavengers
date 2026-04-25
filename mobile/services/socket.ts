import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@constants/index';
import { useAuthStore } from '@store/authStore';

let socket: Socket | null = null;

export const connectSocket = (): Socket => {
  const { accessToken } = useAuthStore.getState();

  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token: accessToken },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinMatch = (matchId: string) => {
  if (socket?.connected) {
    socket.emit('JOIN_MATCH', matchId);
  }
};

export const leaveMatch = (matchId: string) => {
  if (socket?.connected) {
    socket.emit('LEAVE_MATCH', matchId);
  }
};

export const onMatchEvent = (
  event: 'BALL_ADDED' | 'MATCH_UPDATED' | 'JOINED_MATCH' | 'MATCH_STATE_CHANGED',
  cb: (data: unknown) => void
) => {
  socket?.on(event, cb);
  return () => { socket?.off(event, cb); };
};

export const onEvent = (event: string, cb: (data: any) => void): (() => void) => {
  socket?.on(event, cb);
  return () => { socket?.off(event, cb); };
};

export const getSocket = () => socket;
