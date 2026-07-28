import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { UserBasic } from './types';

interface CallContextType {
  activeCall: boolean;
  callType: 'voice' | 'video';
  callTarget: UserBasic | null;
  callChatId: string;
  startCall: (target: UserBasic, type: 'voice' | 'video', chatId?: string) => void;
  endCall: () => void;
  minimizeCall: boolean;
  setMinimizeCall: (v: boolean) => void;
}

const CallContext = createContext<CallContextType>({
  activeCall: false,
  callType: 'voice',
  callTarget: null,
  callChatId: '',
  startCall: () => {},
  endCall: () => {},
  minimizeCall: false,
  setMinimizeCall: () => {},
});

export function CallProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState(false);
  const [callType, setCallType] = useState<'voice' | 'video'>('voice');
  const [callTarget, setCallTarget] = useState<UserBasic | null>(null);
  const [callChatId, setCallChatId] = useState('');
  const [minimizeCall, setMinimizeCall] = useState(false);

  const startCall = useCallback((target: UserBasic, type: 'voice' | 'video', chatId?: string) => {
    setCallTarget(target);
    setCallType(type);
    setCallChatId(chatId || '');
    setActiveCall(true);
    setMinimizeCall(false);
  }, []);

  const endCall = useCallback(() => {
    setActiveCall(false);
    setCallTarget(null);
    setCallChatId('');
    setMinimizeCall(false);
  }, []);

  return (
    <CallContext.Provider value={{
      activeCall, callType, callTarget, callChatId,
      startCall, endCall, minimizeCall, setMinimizeCall,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export const useCallContext = () => useContext(CallContext);
