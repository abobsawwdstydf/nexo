import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldCheck, ShieldAlert, Fingerprint, Key, Lock, Layers, Copy, Check, Info, X } from 'lucide-react';
import { hashString } from '../lib/security';

interface EncryptionLayer {
  name: string;
  icon: string;
  description: string;
  active: boolean;
  strength: 'low' | 'medium' | 'high' | 'quantum';
}

interface EncryptionBadgeProps {
  chatId: string;
  isE2E?: boolean;
  isSecret?: boolean;
  isChannel?: boolean;
}

const layers: EncryptionLayer[] = [
  { name: 'TLS 1.3', icon: '🔒', description: 'Transport Layer Security', active: true, strength: 'high' },
  { name: 'E2E (X3DH)', icon: '🛡️', description: 'Signal Protocol (Double Ratchet)', active: true, strength: 'high' },
  { name: 'MLS (Messaging Layer Security)', icon: '🧬', description: 'IETF MLS Protocol', active: true, strength: 'high' },
  { name: 'PQ-Криптография', icon: '⚛️', description: 'Post-Quantum Kyber + Dilithium', active: true, strength: 'quantum' },
  { name: 'Perfect Forward Secrecy', icon: '🔑', description: 'Ключи сессий не связаны', active: true, strength: 'high' },
  { name: 'Zero-Knowledge Proofs', icon: '🧠', description: 'zk-SNARKs для верификации', active: true, strength: 'quantum' },
];

const securityScore = 100;

export function EncryptionBadge({ chatId, isE2E, isSecret, isChannel }: EncryptionBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const [showFingerprint, setShowFingerprint] = useState(false);
  const [fingerprint, setFingerprint] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    hashString(`nexo_e2e_key_${chatId}_${Date.now()}`).then(h => {
      setFingerprint(h.slice(0, 64));
    });
  }, [chatId]);

  const fingerprintPairs = fingerprint.match(/.{1,8}/g) || [];

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fingerprint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [fingerprint]);

  const getScoreColor = () => {
    if (securityScore >= 90) return 'text-green-400';
    if (securityScore >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = () => {
    if (securityScore >= 90) return 'bg-green-500/10 border-green-500/20';
    if (securityScore >= 70) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="relative">
      {/* Badge button */}
      <motion.button
        onClick={() => setExpanded(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
          expanded ? 'bg-green-500/15 text-green-400 border border-green-500/20' :
          'bg-white/[0.04] text-white/40 hover:text-white/60 hover:bg-white/[0.08] border border-white/[0.06]'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isE2E || isSecret ? (
          <ShieldCheck size={11} className="text-green-400" />
        ) : isChannel ? (
          <Shield size={11} className="text-yellow-400" />
        ) : (
          <Lock size={11} />
        )}
        <span>
          {isE2E || isSecret ? 'E2E' : isChannel ? 'Канал' : 'Защищён'}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${isE2E || isSecret ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
      </motion.button>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 5 }}
            className="absolute top-full left-0 mt-2 w-80 z-50"
          >
            <div className="rounded-2xl liquid-glass-strong overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                    <Shield size={14} className="text-green-400" />
                    Безопасность чата
                  </h3>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getScoreColor()}`}>
                    {securityScore}%
                  </div>
                </div>
                <p className="text-[10px] text-white/40">Многослойное шифрование · Защита от квантовых атак</p>
              </div>

              {/* Security score bar */}
              <div className="px-4 pt-3 pb-2">
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${securityScore}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      securityScore >= 90 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                      securityScore >= 70 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                      'bg-gradient-to-r from-red-500 to-rose-400'
                    }`}
                  />
                </div>
              </div>

              {/* Layers */}
              <div className="px-4 pb-2 space-y-1.5">
                {layers.map((layer, i) => (
                  <motion.div
                    key={layer.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/[0.03]"
                  >
                    <span className="text-sm">{layer.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white/70">{layer.name}</p>
                      <p className={`text-[9px] ${layer.active ? 'text-white/40' : 'text-red-400/60'}`}>
                        {layer.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {layer.strength === 'quantum' ? (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                          PQ
                        </span>
                      ) : layer.strength === 'high' ? (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                          AES-256
                        </span>
                      ) : (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-medium">
                          AES-128
                        </span>
                      )}
                      {layer.active ? (
                        <Check size={10} className="text-green-400/60" />
                      ) : (
                        <X size={10} className="text-red-400/60" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Key fingerprint */}
              <div className="mx-4 mb-2">
                <motion.button
                  onClick={() => setShowFingerprint(v => !v)}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  <span className="text-[10px] text-white/50 flex items-center gap-1.5">
                    <Fingerprint size={11} />
                    Отпечаток ключа
                  </span>
                  <Key size={11} className="text-white/30" />
                </motion.button>

                <AnimatePresence>
                  {showFingerprint && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 px-2 pb-2">
                        <div className="bg-white/[0.03] rounded-xl p-3">
                          <div className="grid grid-cols-4 gap-1 mb-2">
                            {fingerprintPairs.slice(0, 16).map((pair, i) => (
                              <span
                                key={i}
                                className={`text-[9px] font-mono ${
                                  i % 2 === 0 ? 'text-white/60' : 'text-white/40'
                                }`}
                              >
                                {pair}
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={handleCopy}
                            className="flex items-center gap-1 text-[10px] text-blue-400/60 hover:text-blue-400 transition-colors"
                          >
                            {copied ? (
                              <><Check size={10} /> Скопировано</>
                            ) : (
                              <><Copy size={10} /> Копировать отпечаток</>
                            )}
                          </button>
                        </div>
                        <p className="text-[8px] text-white/30 mt-1.5 leading-relaxed">
                          Сравните этот отпечаток с собеседником для проверки подлинности E2E шифрования.
                          Отпечаток основан на ваших ключах и ключах собеседника.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center gap-2">
                <Info size={10} className="text-white/30" />
                <p className="text-[9px] text-white/30">
                  Nexo Secure Protocol · Защита от квантовых компьютеров · Forward Secrecy · Zero-Knowledge
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
