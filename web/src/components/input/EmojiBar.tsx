import { forwardRef } from 'react';
import { Smile } from 'lucide-react';

interface EmojiBarProps {
  showMediaPicker: boolean;
  onTogglePicker: () => void;
}

const EmojiBar = forwardRef<HTMLButtonElement, EmojiBarProps>(
  ({ showMediaPicker, onTogglePicker }, ref) => {
    return (
      <button
        ref={ref}
        onClick={onTogglePicker}
        data-mediapicker-anchor
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 flex-shrink-0 ${
          showMediaPicker
            ? 'text-[#6ab2f2] bg-[#6ab2f2]/10'
            : 'text-[#6d7f8e] hover:text-[#6ab2f2] hover:bg-white/[0.04]'
        }`}
        title="Эмодзи, стикеры и GIF"
      >
        <Smile size={20} />
      </button>
    );
  }
);

EmojiBar.displayName = 'EmojiBar';

export default EmojiBar;
