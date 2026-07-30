import { getApiUrl } from '../config';

let ws: WebSocket | null = null;
let connectAttempts = 0;
let isReconnecting = false;
const MAX_CONNECT_ATTEMPTS = 15;
const CONNECT_TIMEOUT = 30000;
const RECONNECT_KEY = 'nexo_ws_reconnect_state';
const RPC_TIMEOUT = 15000; // 15 seconds for RPC responses

interface ReconnectState {
  lastEventTimestamp: number;
  missedEvents: string[];
}

// ─── WebSocket RPC Layer ──────────────────────────────────────────────────────

type PendingRPC = {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
};

let rpcCounter = 0;
const pendingRPCs = new Map<string, PendingRPC>();

/**
 * Send a typed request over WebSocket and wait for the server's response.
 * Returns a promise that resolves with the response payload or rejects on error/timeout.
 */
export function wsRequest<T = any>(type: string, payload?: Record<string, any>, timeoutMs = RPC_TIMEOUT): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not connected'));
      return;
    }

    rpcCounter++;
    const id = `rpc_${Date.now()}_${rpcCounter}`;

    const timer = setTimeout(() => {
      pendingRPCs.delete(id);
      reject(new Error(`RPC timeout: ${type}`));
    }, timeoutMs);

    pendingRPCs.set(id, { resolve, reject, timer });

    const envelope: Record<string, any> = { id, type, ...(payload ? { payload } : {}) };

    try {
      ws.send(JSON.stringify(envelope));
    } catch (err) {
      clearTimeout(timer);
      pendingRPCs.delete(id);
      reject(err);
    }
  });
}

/**
 * Fire-and-forget: send a message without waiting for a response.
 */
export function wsEmit(type: string, data?: Record<string, any>) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  // Wrap data in payload to avoid "type" field collision with the event name.
  try {
    ws.send(JSON.stringify({ type, payload: data || {} }));
  } catch { /* ws send failed */ }
}

// ─── Existing socket infrastructure ───────────────────────────────────────────

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
  } catch { /* storage full or disabled */ }
}

function clearReconnectState() {
  localStorage.removeItem(RECONNECT_KEY);
}

const getSocketUrl = () => {
  const apiUrl = getApiUrl();
  if (typeof window === 'undefined') return apiUrl;
  if (apiUrl.startsWith('http')) {
    return apiUrl.replace(/\/+$/, '');
  }
  return window.location.origin;
};

// Event listener management
type EventHandler = (data: any) => void;
const eventListeners: Map<string, Set<EventHandler>> = new Map();

function addEventListener(event: string, handler: EventHandler) {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(handler);
}

function removeEventListener(event: string, handler: EventHandler) {
  const handlers = eventListeners.get(event);
  if (handlers) {
    handlers.delete(handler);
    if (handlers.size === 0) {
      eventListeners.delete(event);
    }
  }
}

function emitEvent(event: string, data: any) {
  const handlers = eventListeners.get(event);
  if (handlers) {
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error(`[Socket] Error in event handler for ${event}:`, err);
      }
    });
  }
}

// Connection status management
type ConnectionStatusType = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
let statusListeners: Array<(status: ConnectionStatusType) => void> = [];

function emitStatus(status: ConnectionStatusType) {
  statusListeners.forEach(fn => fn(status));
}

export function getConnectionStatus(): ConnectionStatusType {
  if (!ws) return 'idle';
  if (ws.readyState === WebSocket.OPEN) return 'connected';
  if (isReconnecting) return 'reconnecting';
  return 'connecting';
}

export function onConnectionStatusChange(cb: (status: ConnectionStatusType) => void): () => void {
  statusListeners.push(cb);
  return () => {
    statusListeners = statusListeners.filter(fn => fn !== cb);
  };
}

// Socket interface for compatibility
interface SocketInterface {
  on: (event: string, handler: EventHandler) => void;
  off: (event: string, handler?: EventHandler) => void;
  emit: (event: string, ...args: any[]) => void;
  connected: boolean;
  disconnect: () => void;
  connect: () => void;
}

let socket: SocketInterface | null = null;

export function connectSocket(token?: string): SocketInterface | null {
  if (!token) {
    console.warn('[Socket] No token provided, skipping connection');
    return null;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    return socket;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  const baseUrl = getSocketUrl();
  const wsUrl = baseUrl.replace(/^http/, 'ws') + `/ws/chat?token=${token}`;
  
  emitStatus('connecting');
  ws = new WebSocket(wsUrl);
  
  // Create compatibility interface
  socket = {
    on: (event: string, handler: EventHandler) => addEventListener(event, handler),
    off: (event: string, handler?: EventHandler) => {
      if (handler) {
        removeEventListener(event, handler);
        return;
      }
      eventListeners.delete(event);
    },
    emit: (event: string, ...args: any[]) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Wrap args in payload to avoid "type" field collision with the event name.
        // Backend expects: { type: "<event>", payload: { ... } }
        ws.send(JSON.stringify({ type: event, payload: args[0] || {} }));
      }
    },
    get connected() {
      return ws?.readyState === WebSocket.OPEN;
    },
    disconnect: () => {
      if (ws) {
        ws.close();
        ws = null;
      }
    },
    connect: () => {
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        // Reconnect with token
        const newUrl = getSocketUrl().replace(/^http/, 'ws') + `/ws/chat?token=${token}`;
        ws = new WebSocket(newUrl);
        setupWebSocketHandlers();
      }
    }
  };

  setupWebSocketHandlers();
  
  return socket;
}

function setupWebSocketHandlers() {
  if (!ws) return;

  ws.onopen = () => {
    const prev = connectAttempts;
    connectAttempts = 0;
    isReconnecting = false;
    emitStatus('connected');
    emitEvent('connect', {});
    
    const reconnectState = loadReconnectState();
    if (reconnectState && prev > 0) {
      // Backend doesn't have sync_events, but we track state
      clearReconnectState();
    }
  };

  ws.onclose = (event) => {
    const reconnectState = loadReconnectState() || {
      lastEventTimestamp: Date.now(),
      missedEvents: [],
    };
    reconnectState.lastEventTimestamp = Date.now();
    saveReconnectState(reconnectState);

    emitStatus('disconnected');
    emitEvent('disconnect', { reason: event.code });
    
    // Auto-reconnect unless intentional
    if (!event.wasClean) {
      scheduleReconnect();
    }
  };

  ws.onerror = (error) => {
    console.error('[Socket] WebSocket error:', error);
    emitEvent('connect_error', { message: 'Connection error' });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // ─── RPC response handling ─────────────────────────────────────
      // If message has an `id` field, it's a response to a pending RPC request
      if (data.id && pendingRPCs.has(data.id)) {
        const rpc = pendingRPCs.get(data.id)!;
        pendingRPCs.delete(data.id);
        clearTimeout(rpc.timer);
        
        if (data.ok === false || data.error) {
          rpc.reject(new Error(data.error || 'RPC error'));
        } else {
          // Resolve with the payload (all fields except id, ok, error)
          const { id: _id, ok: _ok, error: _err, ...rest } = data;
          rpc.resolve(rest);
        }
        return; // Don't emit RPC responses as events
      }

      // ─── Event handling (existing behavior) ─────────────────────────
      const state = loadReconnectState() || { lastEventTimestamp: Date.now(), missedEvents: [] };
      state.lastEventTimestamp = Date.now();
      if (data.type && !state.missedEvents.includes(data.type)) {
        state.missedEvents.push(data.type);
        if (state.missedEvents.length > 50) {
          state.missedEvents = state.missedEvents.slice(-50);
        }
      }
      saveReconnectState(state);
      
      // Emit event to listeners
      if (data.type) {
        emitEvent(data.type, data);
      }
    } catch (err) {
      console.error('[Socket] Failed to parse message:', err);
    }
  };
}

function scheduleReconnect() {
  if (connectAttempts >= MAX_CONNECT_ATTEMPTS) {
    setTimeout(() => {
      connectAttempts = 0;
      if (ws && ws.readyState === WebSocket.CLOSED) {
        const token = localStorage.getItem('nexo_access_token');
        if (token) {
          connectSocket(token);
        }
      }
    }, 60000);
    return;
  }
  
  const delay = Math.min(1000 * Math.pow(2, connectAttempts), 30000);
  connectAttempts++;
  isReconnecting = true;
  emitStatus('reconnecting');
  
  setTimeout(() => {
    if (ws && ws.readyState === WebSocket.CLOSED) {
      const token = localStorage.getItem('nexo_access_token');
      if (token) {
        connectSocket(token);
      }
    }
  }, delay);
}

export function getSocket(): SocketInterface | null {
  return socket;
}

/**
 * Wait for the WebSocket to become connected (with timeout).
 * Rejects after timeoutMs if connection doesn't happen.
 */
export function waitForSocketConnected(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, timeoutMs);

    const unsub = onConnectionStatusChange((status) => {
      if (status === 'connected') {
        clearTimeout(timeout);
        unsub();
        resolve();
      }
    });
  });
}

export function disconnectSocket() {
  if (ws) {
    clearReconnectState();
    ws.close();
    ws = null;
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
    connected: ws?.readyState === WebSocket.OPEN,
    reconnecting: isReconnecting,
    attempt: connectAttempts,
  };
}

export { socket };
