/**
 * Icon mapping from emojis to Iconsax React icons.
 * Used for UI elements where emojis were previously used as icons.
 */

import {
  // Folder icons
  Folder,
  FolderOpen,
  Cards,
  ClipboardText,
  Location,
  Star1,
  Heart,
  Briefcase,
  Target,
  Flame,
  Star,
  Brush,
  Music,
  Game,
  Mobile,
  Laptop,

  // Tag/label icons
  Lamp,
  TickCircle,
  InfoCircle,
  Link2,
  AttachSquare,
  Message,

  // Category icons
  Global,
  Microscope,
  MagicStar,
  Cup,
  Box,

  // Action icons
  Notification,
  EmojiSad,
  Danger,
  EyeSlash,
  CloseCircle,
  Edit,
  Document,
  Lock1,
  Card,

  // Report icons
  Sms,
  Warning2,
  DocumentText,
} from 'iconsax-react';

import { type ComponentType } from 'react';

/**
 * Icon component with standard props
 */
export type IconComponent = ComponentType<{
  size?: number | string;
  color?: string;
  className?: string;
  variant?: 'Linear' | 'Outline' | 'TwoTone' | 'Bulk' | 'Broken' | 'Bold';
}>;

/**
 * Mapping of emojis to Iconsax icon components.
 * Keys are the emoji strings, values are the Iconsax icon components.
 */
export const EMOJI_TO_ICON: Record<string, IconComponent> = {
  // Folder icons
  '📁': Folder,
  '📂': FolderOpen,
  '🗂️': Cards,
  '📋': ClipboardText,
  '📌': Location,
  '⭐': Star1,
  '❤️': Heart,
  '💼': Briefcase,
  '🎯': Target,
  '🔥': Flame,
  '✨': Star,
  '🎨': Brush,
  '🎵': Music,
  '🎮': Game,
  '📱': Mobile,
  '💻': Laptop,

  // Tag icons
  '💡': Lamp,
  '✅': TickCircle,
  '❓': InfoCircle,
  '🔗': Link2,
  '📎': AttachSquare,
  '💬': Message,

  // Category icons (Communities)
  '🌐': Global,
  '🔬': Microscope,
  '⚽': MagicStar,
  '🍕': Cup,

  // Marketplace icons
  '📈': Box, // Using Box as a placeholder for trending
  '✍️': Edit,
  '🎬': Mobile, // Using Mobile for video placeholder

  // Report icons
  '📢': Notification,
  '😠': EmojiSad,
  '⚠️': Danger,
  '🔞': EyeSlash,
  '🚫': CloseCircle,
  '📝': DocumentText,

  // SideMenu icons
  '📄': Document,
  '🔒': Lock1,
  '💳': Card,
};

/**
 * Get an Iconsax icon component for a given emoji.
 * Returns undefined if no mapping exists.
 */
export function getIconForEmoji(emoji: string): IconComponent | undefined {
  return EMOJI_TO_ICON[emoji];
}

/**
 * Check if an emoji has a mapped Iconsax icon.
 */
export function hasIconMapping(emoji: string): boolean {
  return emoji in EMOJI_TO_ICON;
}
