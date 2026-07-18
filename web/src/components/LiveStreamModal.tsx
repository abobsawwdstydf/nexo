import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Video, Users, MessageCircle, Heart, Gift, Eye, Radio } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { getSocket } from '../lib/socket';

interface LiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId?: string;
}

interface Stream {
  id: string;
  title: string;
  description: string;
  channelId: string;
  channel: {
    id: string;
    name: string;
    avatar?: string;
  };
  streamUrl: string;
  thumbnailUrl?: string;
  viewersCount: number;
  isLive: boolean;
  startedAt: string;
  endedAt?: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  message: string;
  timestamp: string;
}

interface Donation {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  amount: number;
  message?: string;
}

export default function LiveStreamModal({ isOpen, onClose, streamId }: LiveStreamModalProps) {
  const { user } = useAuthStore();
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showDonation, setShowDonation] = useState(false);
  const [donationAmount, setDonationAmount] = useState('');
  const [donationMessage, setDonationMessage] = useState('');
  const [recentDonations, setRecentDonations] = useState<Donation[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && streamId) {
      loadStream();
    }
  }, [isOpen, streamId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !streamId) return;

    socket.emit('stream:join', { streamId });

    const handleChatMessage = (message: ChatMessage) => {
      setChatMessages((prev) => [...prev, message]);
    };

    const handleDonation = (donation: Donation) => {
      setRecentDonations((prev) => [donation, ...prev.slice(0, 4)]);
      // Анимация доната
      showDonationAnimation(donation);
    };

    const handleViewersUpdate = (data: { streamId: string; count: number }) => {
      if (data.streamId === streamId) {
        setStream((prev) => prev ? { ...prev, viewersCount: data.count } : null);
      }
    };

    socket.on('stream:chat', handleChatMessage);
    socket.on('stream:donation', handleDonation);
    socket.on('stream:viewers', handleViewersUpdate);

    return () => {
      socket.emit('stream:leave', { streamId });
      socket.off('stream:chat', handleChatMessage);
      socket.off('stream:donation', handleDonation);
      socket.off('stream:viewers', handleViewersUpdate);
    };
  }, [streamId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadStream = async () => {
    if (!streamId) return;
    setLoading(true);
    try {
      const response = await api.get(`/live-streams/${streamId}`);
      setStream(response.data);
    } catch (error) {
      console.error('Error loading stream:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !streamId) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('stream:chat', {
      streamId,
      message: newMessage.trim(),
    });
    setNewMessage('');
  };

  const handleSendDonation = async () => {
    if (!streamId || !donationAmount || parseInt(donationAmount) <= 0) return;
    try {
      await api.post(`/live-streams/${streamId}/donate`, {
        amount: parseInt(donationAmount),
        message: donationMessage,
      });
      setDonationAmount('');
      setDonationMessage('');
      setShowDonation(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка отправки доната');
    }
  };

  const showDonationAnimation = (donation: Donation) => {
    // SECURITY FIX: Safe DOM construction — no innerHTML with user data
    const animEl = document.createElement('div');
    animEl.className = 'donation-animation';

    const popup = document.createElement('div');
    popup.className = 'donation-popup';

    const userDiv = document.createElement('div');
    userDiv.className = 'donation-user';
    userDiv.textContent = donation.displayName;
    popup.appendChild(userDiv);

    const amountDiv = document.createElement('div');
    amountDiv.className = 'donation-amount';
    const img = document.createElement('img');
    img.src = '/beaver-coin.png';
    img.className = 'w-6 h-6';
    amountDiv.appendChild(img);
    amountDiv.appendChild(document.createTextNode(` ${donation.amount}`));
    popup.appendChild(amountDiv);

    if (donation.message) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'donation-message';
      msgDiv.textContent = donation.message;
      popup.appendChild(msgDiv);
    }

    animEl.appendChild(popup);
    document.body.appendChild(animEl);
    setTimeout(() => animEl.remove(), 5000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-7xl h-[90vh] bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                <Radio className="w-5 h-5 text-red-600" />
                <span className="text-red-600 font-semibold">LIVE</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Eye className="w-4 h-4" />
                <span>{stream?.viewersCount || 0}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Video Player */}
            <div className="flex-1 flex flex-col bg-black">
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
                </div>
              ) : (
                <>
                  <div className="flex-1 relative">
                    <video
                      ref={videoRef}
                      src={stream?.streamUrl}
                      poster={stream?.thumbnailUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                    {/* Donation Overlay */}
                    <div className="absolute top-4 right-4 space-y-2">
                      {recentDonations.map((donation) => (
                        <motion.div
                          key={donation.id}
                          initial={{ x: 100, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: 100, opacity: 0 }}
                          className="bg-amber-500 px-4 py-2 rounded-lg shadow-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Gift className="w-4 h-4 text-white" />
                            <span className="font-semibold text-white">{donation.displayName}</span>
                          </div>
                          <div className="flex items-center gap-1 text-white font-bold">
                           
                            {donation.amount}
                          </div>
                          {donation.message && (
                            <p className="text-sm text-white/90 mt-1">{donation.message}</p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-900">
                    <h2 className="text-xl font-semibold text-white mb-2">
                      {stream?.title}
                    </h2>
                    <div className="flex items-center gap-3">
                      {stream?.channel.avatar && (
                        <img
                          src={stream.channel.avatar}
                          alt={stream.channel.name}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div>
                        <div className="font-medium text-white">{stream?.channel.name}</div>
                        <div className="text-sm text-gray-400">{stream?.description}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Chat Sidebar */}
            <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Чат стрима
                </h3>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="flex gap-2">
                    {msg.avatar && (
                      <img
                        src={msg.avatar}
                        alt={msg.displayName}
                        className="w-8 h-8 rounded-full flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-purple-400 text-sm">
                          {msg.displayName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.timestamp).toLocaleTimeString('ru', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 break-words">{msg.message}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-800 space-y-2">
                <button
                  onClick={() => setShowDonation(true)}
                  className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all font-medium flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4" />
                  Отправить донат
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Написать в чат..."
                    className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Donation Modal */}
          <AnimatePresence>
            {showDonation && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/70 flex items-center justify-center p-4"
                onClick={() => setShowDonation(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="w-full max-w-md bg-gray-800 rounded-2xl p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-yellow-500" />
                    Отправить донат
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Сумма
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={donationAmount}
                          onChange={(e) => setDonationAmount(e.target.value)}
                          placeholder="100"
                          className="w-full pl-12 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          min="1"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                         
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        {[10, 50, 100, 500, 1000].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setDonationAmount(preset.toString())}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-yellow-600 rounded-lg text-sm transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Сообщение (необязательно)
                      </label>
                      <textarea
                        value={donationMessage}
                        onChange={(e) => setDonationMessage(e.target.value)}
                        placeholder="Спасибо за стрим!"
                        className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowDonation(false)}
                        className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={handleSendDonation}
                        disabled={!donationAmount || parseInt(donationAmount) <= 0}
                        className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all disabled:opacity-50 font-medium"
                      >
                        Отправить
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
