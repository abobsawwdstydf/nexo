import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../config';

let socket: Socket | null = null;
let connectAttempts = 0;
let isReconnecting = false;
const MAX_CONNECT_ATTEMPTS = 15;
const CONNECT_TIMEOUT = 30000;
const RECONNECT_KEY = 'nexo_ws_reconnect_state';

interface ReconnectState {
  lastEventTimestamp: number;
  missedEvents: string[];
}

function loadReconnectState(): ReconnectState | null {
  try {
    const raw = localStorage.getItem(RECONNECT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveReconnectState(state: ReconnectState) {
  try {
    localStorage.setItem(RECONNECT_KEY, JSON.stringify(state));
  } catch {}
}

function clearReconnectState() {
  localStorage.removeItem(RECONNECT_KEY);
}

const getSocketUrl = () => {
  const apiUrl = getApiUrl();
  if (typeof window === 'undefined') return apiUrl;
  if (window.location.hostname === 'localhost') {
    return window.location.origin;
  }
  if (apiUrl.startsWith('http')) {
    return apiUrl.replace(/\/+$/, '');
  }
  return window.location.origin;
};

export function connectSocket(token?: string): Socket | null {
  if (!token) {
    console.warn('[Socket] No token provided, skipping connection');
    return null;
  }

  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const socketUrl = getSocketUrl();

  socket = io(socketUrl, {
    auth: { token },
    transportOptions: {
      polling: {
        extraHeaders: {
          // Cookies are sent automatically with same-origin requests
        }
      }
    },
    withCredentials: true,
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: MAX_CONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: CONNECT_TIMEOUT,
    forceNew: true,
    upgrade: true,
  });

  emitStatus('connecting');

  socket.on('connect', () => {
    const prev = connectAttempts;
    connectAttempts = 0;
    isReconnecting = false;
    emitStatus('connected');

    const reconnectState = loadReconnectState();
    if (reconnectState && prev > 0) {
      socket?.emit('sync_events', {
        since: reconnectState.lastEventTimestamp,
        missedEventTypes: reconnectState.missedEvents,
      });
      clearReconnectState();
    }
  });

  socket.on('disconnect', (reason) => {
    const reconnectState = loadReconnectState() || {
      lastEventTimestamp: Date.now(),
      missedEvents: [],
    };
    reconnectState.lastEventTimestamp = Date.now();
    saveReconnectState(reconnectState);

    if (intentionalDisconnect) {
      intentionalDisconnect = false;
      return;
    }

    emitStatus('disconnected');

    if (reason === 'io server disconnect') {
      socket?.connect();
    }
  });

  socket.on('connect_error', (err) => {
    const msg = err?.message || '';
    const isAuthError = msg.includes('авторизация') || msg.includes('токен') || msg.includes('Недействительный');

    if (isAuthError) {
      try {
        localStorage.removeItem('nexo_access_token');
        localStorage.removeItem('nexo_user');
      } catch {}
      socket?.disconnect();
      return;
    }

    connectAttempts++;

    const delay = Math.min(1000 * Math.pow(2, connectAttempts - 1), 30000);
    if (socket) (socket as any).opts.reconnectionDelay = delay;

    if (connectAttempts >= MAX_CONNECT_ATTEMPTS) {
      setTimeout(() => {
        connectAttempts = 0;
        if (socket?.disconnected) {
          socket.connect();
        }
      }, 60000);
    }
  });

  socket.on('reconnect_attempt', (attempt) => {
    connectAttempts = attempt;
    isReconnecting = true;
    emitStatus('reconnecting');
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    (socket as any).opts.reconnectionDelay = delay;
  });

  socket.on('reconnect_failed', () => {
    setTimeout(() => {
      connectAttempts = 0;
      if (socket?.disconnected) {
        socket.connect();
      }
    }, 60000);
  });

  const trackEvent = (eventName: string) => {
    socket?.on(eventName, () => {
      const state = loadReconnectState() || { lastEventTimestamp: Date.now(), missedEvents: [] };
      state.lastEventTimestamp = Date.now();
      if (!state.missedEvents.includes(eventName)) {
        state.missedEvents.push(eventName);
      }
      if (state.missedEvents.length > 50) {
        state.missedEvents = state.missedEvents.slice(-50);
      }
      saveReconnectState(state);
    });
  };

  const trackedEvents = [
    'new_message', 'edit_message', 'delete_message', 'messages_deleted', 'messages_hidden',
    'reaction_added', 'reaction_removed', 'message_pinned', 'message_unpinned',
    'typing_start', 'user_typing', 'user_stopped_typing',
    'friend_request', 'friend_accepted', 'friend_removed',
    'user_online', 'user_offline',
    'poll_updated', 'beavers_received', 'beavers_topup',
  ];
  trackedEvents.forEach(trackEvent);

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

let intentionalDisconnect = false;

export function disconnectSocket() {
  if (socket) {
    intentionalDisconnect = true;
    clearReconnectState();
    socket.disconnect();
    socket = null;
    emitStatus('idle');
  }
}

export function getConnectionState(): {
  connected: boolean;
  reconnecting: boolean;
  attempt: number;
} {
  return {
    connected: socket?.connected ?? false,
    reconnecting: isReconnecting,
    attempt: connectAttempts,
  };
}

// Connection status for ConnectionStatus component
type ConnectionStatusType = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
let statusListeners: Array<(status: ConnectionStatusType) => void> = [];

function emitStatus(status: ConnectionStatusType) {
  statusListeners.forEach(fn => fn(status));
}

export function getConnectionStatus(): ConnectionStatusType {
  if (!socket) return 'idle';
  if (socket.connected) return 'connected';
  if (isReconnecting) return 'reconnecting';
  return 'connecting';
}

export function onConnectionStatusChange(cb: (status: ConnectionStatusType) => void): () => void {
  statusListeners.push(cb);
  return () => {
    statusListeners = statusListeners.filter(fn => fn !== cb);
  };
}

export { socket };
