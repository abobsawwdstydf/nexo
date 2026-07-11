import { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Users, Check, Upload } from 'lucide-react';
import { api } from '../lib/api';
import { socket } from '../lib/socket';

interface WatchPartyModalProps {
  callId: string;
  isHost: boolean;
  onClose: () => void;
}

interface WatchParty {
  id: string;
  callId: string;
  hostId: string;
  videoUrl: string;
  videoTitle: string;
  isPlaying: boolean;
  currentTime: number;
  participants: Array<{
    id: string;
    userId: string;
    isReady: boolean;
  }>;
}

export function WatchPartyModal({ callId, isHost, onClose }: WatchPartyModalProps) {
  const [party, setParty] = useState<WatchParty | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const loadParty = async () => {
    try {
      const data = await api.get<WatchParty>(`/watch-party/${callId}`);
      setParty(data);
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl);
        setVideoTitle(data.videoTitle);
      }
    } catch (error) {
      console.error('Failed to load watch party:', error);
    }
  };

  useEffect(() => {
    const handleSync = (data: { isPlaying: boolean; currentTime: number }) => {
      if (!videoRef.current || isHost) return;

      // Синхронизируем время и состояние воспроизведения
      const timeDiff = Math.abs(videoRef.current.currentTime - data.currentTime);
      if (timeDiff > 1) {
        videoRef.current.currentTime = data.currentTime;
      }

      if (data.isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else if (!data.isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    };

    const handleParticipantReady = (data: { userId: string; isReady: boolean }) => {
      setParty(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: prev.participants.map(p =>
            p.userId === data.userId ? { ...p, isReady: data.isReady } : p
          ),
        };
      });
    };

    loadParty();

    // Socket listeners
    if (socket) {
      socket.on('watch_party_sync', handleSync);
      socket.on('watch_party_participant_ready', handleParticipantReady);

      return () => {
        if (socket) {
          socket.off('watch_party_sync', handleSync);
          socket.off('watch_party_participant_ready', handleParticipantReady);
        }
      };
    }
  }, [callId, isHost]);

  const createParty = async () => {
    if (!videoUrl.trim()) return;

    setLoading(true);
    try {
      const data = await api.post<WatchParty>('/watch-party/create', {
        callId,
        videoUrl: videoUrl.trim(),
        videoTitle: videoTitle.trim() || 'Видео',
      });
      setParty(data);
      if (socket) {
        socket.emit('watch_party_created', { callId, partyId: data.id });
      }
    } catch (error) {
      console.error('Failed to create watch party:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinParty = async () => {
    if (!party) return;

    setLoading(true);
    try {
      await api.post(`/watch-party/${party.id}/join`, {});
      await loadParty();
    } catch (error) {
      console.error('Failed to join watch party:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleReady = async () => {
    if (!party) return;

    const newReady = !isReady;
    setIsReady(newReady);

    try {
      await api.post(`/watch-party/${party.id}/ready`, { isReady: newReady });
      if (socket) {
        socket.emit('watch_party_participant_ready', {
          partyId: party.id,
          isReady: newReady,
        });
      }
    } catch (error) {
      console.error('Failed to toggle ready:', error);
      setIsReady(!newReady);
    }
  };

  const syncPlayback = async () => {
    if (!party || !isHost || !videoRef.current) return;

    // Очищаем предыдущий таймаут
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Дебаунс для избежания частых обновлений
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        await api.post(`/watch-party/${party.id}/sync`, {
          isPlaying: !videoRef.current!.paused,
          currentTime: videoRef.current!.currentTime,
        });

        if (socket) {
          socket.emit('watch_party_sync', {
            partyId: party.id,
            isPlaying: !videoRef.current!.paused,
            currentTime: videoRef.current!.currentTime,
          });
        }
      } catch (error) {
        console.error('Failed to sync playback:', error);
      }
    }, 500);
  };

  const handleVideoPlay = () => {
    if (isHost) syncPlayback();
  };

  const handleVideoPause = () => {
    if (isHost) syncPlayback();
  };

  const handleVideoSeeked = () => {
    if (isHost) syncPlayback();
  };

  const allReady = party?.participants.every(p => p.isReady) ?? false;
  const readyCount = party?.participants.filter(p => p.isReady).length ?? 0;
  const totalCount = party?.participants.length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Play className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {party ? party.videoTitle : 'Совместный просмотр'}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Users className="w-4 h-4" />
                <span>
                  {readyCount}/{totalCount} готовы
                </span>
              </div>
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
        <div className="flex-1 overflow-y-auto p-4">
          {!party ? (
            /* Create Party */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL видео
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Название (опционально)
                </label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={e => setVideoTitle(e.target.value)}
                  placeholder="Название видео"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={createParty}
                disabled={!videoUrl.trim() || loading}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Начать просмотр
              </button>

              <div className="text-sm text-gray-400 space-y-2">
                <p>💡 Поддерживаемые форматы:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Прямые ссылки на видео (.mp4, .webm, .ogg)</li>
                  <li>YouTube (будет встроен плеер)</li>
                  <li>Vimeo, Dailymotion и другие</li>
                </ul>
              </div>
            </div>
          ) : (
            /* Watch Party Active */
            <div className="space-y-4">
              {/* Video Player */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  src={party.videoUrl}
                  controls={isHost}
                  onPlay={handleVideoPlay}
                  onPause={handleVideoPause}
                  onSeeked={handleVideoSeeked}
                  className="w-full h-full"
                />
                {!isHost && (
                  <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-sm text-white">
                    Хост управляет воспроизведением
                  </div>
                )}
              </div>

              {/* Participants */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">
                  Участники ({totalCount})
                </h3>
                <div className="space-y-2">
                  {party.participants.map(participant => (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-white">
                        Участник {participant.userId.slice(0, 8)}
                      </span>
                      {participant.isReady ? (
                        <div className="flex items-center gap-1 text-green-400 text-sm">
                          <Check className="w-4 h-4" />
                          Готов
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">Не готов</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ready Button */}
              <button
                onClick={toggleReady}
                className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  isReady
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                <Check className="w-5 h-5" />
                {isReady ? 'Готов к просмотру' : 'Отметить готовность'}
              </button>

              {isHost && allReady && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 text-center text-green-400 text-sm">
                  ✓ Все участники готовы! Можете начинать просмотр
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
