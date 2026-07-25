import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import { useChatStore } from '../stores/chatStore';
import type { UserBasic, CallInfo } from '../lib/types';

interface CallHandlerReturn {
  callOpen: boolean;
  callTarget: UserBasic | null;
  callType: 'voice' | 'video';
  incomingCall: CallInfo | null;
  callSessionId: number;
  deliveryNotification: string | null;
  incomingNotif: { name: string; text: string } | null;
  showCallRestoreConfirm: boolean;
  pendingCallData: { targetUser: UserBasic; type: 'voice' | 'video' } | null;
  pendingGroupCallData: { chatId: string; chatName: string; type: 'voice' | 'video' } | null;
  groupCallOpen: boolean;
  groupCallChatId: string;
  groupCallChatName: string;
  groupCallType: 'voice' | 'video';
  groupCallSessionId: number;

  handleStartCall: (targetUser: UserBasic, type: 'voice' | 'video') => void;
  handleStartGroupCall: (chatId: string, chatName: string, type: 'voice' | 'video') => void;
  setCallOpen: (open: boolean) => void;
  setIncomingCall: (call: CallInfo | null) => void;
  setGroupCallOpen: (open: boolean) => void;
  setShowCallRestoreConfirm: (show: boolean) => void;
  handleAcceptPendingCall: () => void;
  handleDeclinePendingCall: () => void;
}

export function useCallHandler(): CallHandlerReturn {
  const [callOpen, setCallOpen] = useState(false);
  const [callTarget, setCallTarget] = useState<UserBasic | null>(null);
  const [callType, setCallType] = useState<'voice' | 'video'>('voice');
  const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);
  const [callSessionId, setCallSessionId] = useState(0);
  const [deliveryNotification, setDeliveryNotification] = useState<string | null>(null);
  const [incomingNotif, setIncomingNotif] = useState<{ name: string; text: string } | null>(null);
  const [showCallRestoreConfirm, setShowCallRestoreConfirm] = useState(false);
  const [pendingCallData, setPendingCallData] = useState<{ targetUser: UserBasic; type: 'voice' | 'video' } | null>(null);
  const [pendingGroupCallData, setPendingGroupCallData] = useState<{ chatId: string; chatName: string; type: 'voice' | 'video' } | null>(null);
  const [groupCallOpen, setGroupCallOpen] = useState(false);
  const [groupCallChatId, setGroupCallChatId] = useState('');
  const [groupCallChatName, setGroupCallChatName] = useState('');
  const [groupCallType, setGroupCallType] = useState<'voice' | 'video'>('voice');
  const [groupCallSessionId, setGroupCallSessionId] = useState(0);

  const deliveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingNotifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedCall = sessionStorage.getItem('nexo_active_call');
    if (savedCall) {
      try {
        const { targetUser, type } = JSON.parse(savedCall);
        if (targetUser && type) {
          setPendingCallData({ targetUser, type });
          setShowCallRestoreConfirm(true);
        }
      } catch (e) {
        sessionStorage.removeItem('nexo_active_call');
      }
    }

    const savedGroupCall = sessionStorage.getItem('nexo_active_group_call');
    if (savedGroupCall) {
      try {
        const { chatId, chatName, type } = JSON.parse(savedGroupCall);
        if (chatId && chatName && type) {
          setPendingGroupCallData({ chatId, chatName, type });
          setShowCallRestoreConfirm(true);
        }
      } catch (e) {
        sessionStorage.removeItem('nexo_active_group_call');
      }
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleCallDelivery = (data: { status: string; targetUserId: string }) => {
      if (data.status === 'ringing') {
        setDeliveryNotification('Звоним...');
        if (deliveryTimerRef.current) clearTimeout(deliveryTimerRef.current);
        deliveryTimerRef.current = setTimeout(() => setDeliveryNotification(null), 3000);
      }
    };

    const handleCallIncoming = (data: CallInfo) => {
      setIncomingCall(data);
      if (incomingNotifTimer.current) clearTimeout(incomingNotifTimer.current);
      setIncomingNotif({ name: data.callerInfo?.displayName || data.callerInfo?.username || 'Неизвестный', text: 'Входящий звонок' });
      incomingNotifTimer.current = setTimeout(() => setIncomingNotif(null), 5000);
    };

    const handleCallAccepted = () => {
      setCallSessionId(prev => prev + 1);
      setCallOpen(true);
      setIncomingCall(null);
    };

    const handleGroupCallStarted = (data: { chatId: string; chatName: string; startedBy: string; type: 'voice' | 'video' }) => {
      setGroupCallChatId(data.chatId);
      setGroupCallChatName(data.chatName);
      setGroupCallType(data.type);
      setGroupCallSessionId(prev => prev + 1);
      setGroupCallOpen(true);
    };

    socket.on('call_delivery', handleCallDelivery);
    socket.on('call_incoming', handleCallIncoming);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('group_call_started', handleGroupCallStarted);

    return () => {
      socket.off('call_delivery', handleCallDelivery);
      socket.off('call_incoming', handleCallIncoming);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('group_call_started', handleGroupCallStarted);
      if (deliveryTimerRef.current) clearTimeout(deliveryTimerRef.current);
      if (incomingNotifTimer.current) clearTimeout(incomingNotifTimer.current);
    };
  }, []);

  const handleStartCall = useCallback((targetUser: UserBasic, type: 'voice' | 'video') => {
    const socket = getSocket();
    if (!socket) return;
    setCallTarget(targetUser);
    setCallType(type);
    socket.emit('call_start', { targetUserId: targetUser.id, type });
    sessionStorage.setItem('nexo_active_call', JSON.stringify({ targetUser, type }));
  }, []);

  const handleStartGroupCall = useCallback((chatId: string, chatName: string, type: 'voice' | 'video') => {
    const socket = getSocket();
    if (!socket) return;
    setGroupCallChatId(chatId);
    setGroupCallChatName(chatName);
    setGroupCallType(type);
    setGroupCallSessionId(prev => prev + 1);
    setGroupCallOpen(true);
    socket.emit('group_call_join', { chatId, type });
    sessionStorage.setItem('nexo_active_group_call', JSON.stringify({ chatId, chatName, type }));
  }, []);

  const handleAcceptPendingCall = useCallback(() => {
    if (pendingCallData) {
      handleStartCall(pendingCallData.targetUser, pendingCallData.type);
    } else if (pendingGroupCallData) {
      handleStartGroupCall(pendingGroupCallData.chatId, pendingGroupCallData.chatName, pendingGroupCallData.type);
    }
    setShowCallRestoreConfirm(false);
    setPendingCallData(null);
    setPendingGroupCallData(null);
  }, [pendingCallData, pendingGroupCallData, handleStartCall, handleStartGroupCall]);

  const handleDeclinePendingCall = useCallback(() => {
    setShowCallRestoreConfirm(false);
    setPendingCallData(null);
    setPendingGroupCallData(null);
    sessionStorage.removeItem('nexo_active_call');
    sessionStorage.removeItem('nexo_active_group_call');
  }, []);

  return {
    callOpen, callTarget, callType, incomingCall, callSessionId,
    deliveryNotification, incomingNotif,
    showCallRestoreConfirm, pendingCallData, pendingGroupCallData,
    groupCallOpen, groupCallChatId, groupCallChatName, groupCallType, groupCallSessionId,
    handleStartCall, handleStartGroupCall,
    setCallOpen, setIncomingCall, setGroupCallOpen, setShowCallRestoreConfirm,
    handleAcceptPendingCall, handleDeclinePendingCall,
  };
}
