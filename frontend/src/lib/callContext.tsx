import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import type { UserBasic } from './types';

interface CallContextType {
  activeCall: boolean;
  callType: 'voice' | 'video';
  callTarget: UserBasic | null;
  callChatId: string;
  startCall: (target: UserBasic, type: 'voice' | 'video', chatId?: string) => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextType>({
  activeCall: false,
  callType: 'voice',
  callTarget: null,
  callChatId: '',
  startCall: () => {},
  endCall: () => {},
});

export function CallProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState(false);
  const [callType, setCallType] = useState<'voice' | 'video'>('voice');
  const [callTarget, setCallTarget] = useState<UserBasic | null>(null);
  const [callChatId, setCallChatId] = useState('');

  const startCall = useCallback((target: UserBasic, type: 'voice' | 'video', chatId?: string) => {
    setCallTarget(target);
    setCallType(type);
    setCallChatId(chatId || '');
    setActiveCall(true);
  }, []);

  const endCall = useCallback(() => {
    setActiveCall(false);
    setCallTarget(null);
    setCallChatId('');
  }, []);

  // Memoize so consumers only re-render when call state actually changes.
  const value = useMemo<CallContextType>(() => ({
    activeCall,
    callType,
    callTarget,
    callChatId,
    startCall,
    endCall,
  }), [activeCall, callType, callTarget, callChatId, startCall, endCall]);

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}

export const useCallContext = () => useContext(CallContext);
