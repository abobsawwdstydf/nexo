import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Palette, Copy, Check, Loader2, Share2 } from 'lucide-react';
import QRCode from '../lib/qrcode';

interface QRCodeModalProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
  };
  onClose: () => void;
}

interface ColorScheme {
  name: string;
  fg: string;
  bg: string;
  text: string;
  ringBg: string;
}

const COLORS: ColorScheme[] = [
  { name: 'Нексо',  fg: '#6366f1', bg: '#0a0a0f', text: '#ffffff', ringBg: '#0a0a0f' },
  { name: 'Синий',  fg: '#3b82f6', bg: '#0a0a0f', text: '#ffffff', ringBg: '#0a0a0f' },
  { name: 'Зелёный',fg: '#22c55e', bg: '#0a0a0f', text: '#ffffff', ringBg: '#0a0a0f' },
  { name: 'Красный',fg: '#ef4444', bg: '#0a0a0f', text: '#ffffff', ringBg: '#0a0a0f' },
  { name: 'Фиолет', fg: '#a855f7', bg: '#0a0a0f', text: '#ffffff', ringBg: '#0a0a0f' },
  { name: 'Оранж',  fg: '#f97316', bg: '#0a0a0f', text: '#ffffff', ringBg: '#0a0a0f' },
  { name: 'Белый',  fg: '#ffffff', bg: '#0a0a0f', text: '#ffffff', ringBg: '#0a0a0f' },
  { name: 'Светлый',fg: '#6366f1', bg: '#ffffff', text: '#0a0a0f', ringBg: '#ffffff' },
];

const OUTPUT_SIZE = 720;
const PADDING = 56;
const QR_AREA = OUTPUT_SIZE - PADDING * 2;
const AVATAR_SIZE = 110;
const USERNAME_BAND = 96;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function drawFallbackAvatar(
  ctx: CanvasRenderingContext2D,
  size: number,
  x: number,
  y: number,
  letter: string
) {
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, '#6366f1');
  grad.addColorStop(1, '#a855f7');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(size * 0.46)}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x + size / 2, y + size / 2 + 2);
}

async function renderCompositeQR(
  user: { username: string; displayName: string; avatar: string | null },
  scheme: ColorScheme
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE + USERNAME_BAND;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 56);
  ctx.fillStyle = scheme.bg;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, 1.5, 1.5, canvas.width - 3, canvas.height - 3, 56);
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, scheme.fg + '30');
  grad.addColorStop(1, 'transparent');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  const qrDataUrl = QRCode.toDataURL(
    `${window.location.origin}/?user=${user.username}`,
    {
      width: QR_AREA,
      margin: 1,
      color: { dark: scheme.fg, light: scheme.bg },
    }
  );

  const qrImg = await loadImage(qrDataUrl);
  const qrX = PADDING;
  const qrY = PADDING;

  ctx.drawImage(qrImg, qrX, qrY, QR_AREA, QR_AREA);

  const centerX = OUTPUT_SIZE / 2;
  const centerY = qrY + QR_AREA / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, AVATAR_SIZE / 2 + 10, 0, Math.PI * 2);
  ctx.fillStyle = scheme.ringBg;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = scheme.fg;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(centerX, centerY, AVATAR_SIZE / 2 + 6, 0, Math.PI * 2);
  ctx.fillStyle = scheme.ringBg;
  ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, AVATAR_SIZE / 2 + 4, 0, Math.PI * 2);
  ctx.strokeStyle = scheme.fg;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, AVATAR_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();

  if (user.avatar) {
    try {
      const avatarImg = await loadImage(user.avatar);
      ctx.drawImage(avatarImg, centerX - AVATAR_SIZE / 2, centerY - AVATAR_SIZE / 2, AVATAR_SIZE, AVATAR_SIZE);
    } catch {
      drawFallbackAvatar(ctx, AVATAR_SIZE, centerX - AVATAR_SIZE / 2, centerY - AVATAR_SIZE / 2, user.displayName[0]?.toUpperCase() || 'N');
    }
  } else {
    drawFallbackAvatar(ctx, AVATAR_SIZE, centerX - AVATAR_SIZE / 2, centerY - AVATAR_SIZE / 2, user.displayName[0]?.toUpperCase() || 'N');
  }
  ctx.restore();

  const usernameY = OUTPUT_SIZE + USERNAME_BAND / 2;
  ctx.fillStyle = scheme.text;
  ctx.font = 'bold 38px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`@${user.username}`, centerX, usernameY - 4);

  ctx.fillStyle = scheme.fg;
  ctx.font = '500 18px Inter, system-ui, sans-serif';
  ctx.fillText('Нексо', centerX, usernameY + 28);

  return canvas.toDataURL('image/png');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export default function QRCodeModal({ user, onClose }: QRCodeModalProps) {
  const [colorIdx, setColorIdx] = useState(0);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [isError, setIsError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const renderIdRef = useRef(0);

  const profileUrl = `${window.location.origin}/?user=${user.username}`;

  const regenerate = useCallback(async () => {
    const id = ++renderIdRef.current;
    setIsError(false);
    setImageDataUrl('');
    try {
      const url = await renderCompositeQR(user, COLORS[colorIdx]);
      if (id !== renderIdRef.current) return;
      setImageDataUrl(url);
    } catch (e) {
      console.error('QR render failed:', e);
      if (id === renderIdRef.current) setIsError(true);
    }
  }, [colorIdx, user]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const downloadQR = () => {
    if (!imageDataUrl) return;
    const link = document.createElement('a');
    link.download = `nexo-qr-${user.username}.png`;
    link.href = imageDataUrl;
    link.click();
  };

  const shareQR = async () => {
    if (!imageDataUrl) return;
    try {
      const blob = await (await fetch(imageDataUrl)).blob();
      const file = new File([blob], `nexo-qr-${user.username}.png`, { type: 'image/png' });
      const navAny = navigator as any;
      if (navAny.share && navAny.canShare?.({ files: [file] })) {
        await navAny.share({ files: [file], title: `@${user.username}`, text: `Профиль @${user.username} в Нексо` });
      } else {
        await navigator.clipboard.writeText(profileUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 30 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="relative w-full max-w-sm glass-strong rounded-3xl p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-zinc-400 hover:text-white z-10"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center -mt-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-nexo-500 to-purple-500" />
              <h3 className="text-base font-bold text-white tracking-wide">Мой QR-код</h3>
            </div>

            <motion.div
              layout
              className="relative rounded-2xl overflow-hidden mb-3 ring-1 ring-white/10 shadow-2xl"
              style={{ width: 280, height: 280 + 38 }}
            >
              {imageDataUrl ? (
                <motion.img
                  key={imageDataUrl}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35 }}
                  src={imageDataUrl}
                  alt="QR Code"
                  className="w-full h-full object-cover"
                />
              ) : isError ? (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900/50 text-zinc-500 text-sm">
                  Не удалось сгенерировать
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900/50">
                  <Loader2 size={32} className="text-nexo-400 animate-spin" />
                </div>
              )}
            </motion.div>

            <div className="flex items-center gap-2 w-full mb-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-zinc-200 transition-all"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copied ? (
                    <motion.span
                      key="copied"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex items-center gap-2"
                    >
                      <Check size={15} className="text-emerald-400" />
                      <span className="text-emerald-300">Скопировано</span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex items-center gap-2"
                    >
                      <Copy size={15} />
                      <span>Ссылка</span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={downloadQR}
                disabled={!imageDataUrl}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-zinc-200 transition-all disabled:opacity-50"
                title="Скачать"
              >
                <Download size={15} />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={shareQR}
                disabled={!imageDataUrl}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-zinc-200 transition-all disabled:opacity-50"
                title="Поделиться"
              >
                <Share2 size={15} />
              </motion.button>

              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowColors(!showColors)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-zinc-200 transition-all"
                  title="Цвет"
                >
                  <Palette size={15} />
                </motion.button>
                <AnimatePresence>
                  {showColors && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 glass-strong rounded-2xl shadow-2xl grid grid-cols-4 gap-2 z-20"
                    >
                      {COLORS.map((c, i) => (
                        <motion.button
                          key={i}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => { setColorIdx(i); setShowColors(false); }}
                          className={`w-8 h-8 rounded-lg border-2 transition-all ${
                            colorIdx === i ? 'border-white scale-110 shadow-lg' : 'border-white/20'
                          }`}
                          style={{ background: `linear-gradient(135deg, ${c.fg} 50%, ${c.bg} 50%)` }}
                          title={c.name}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
              Отсканируйте код или откройте ссылку,<br />чтобы перейти в профиль
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
