/**
 * Icon mapping from emojis to Lucide React icons.
 * Used for UI elements where emojis were previously used as icons.
 */

import {
  // Folder icons
  Folder,
  FolderOpen,
  LayoutGrid,
  ClipboardList,
  MapPin,
  Star,
  Heart,
  Briefcase,
  Crosshair,
  Zap,
  Sparkles,
  Palette,
  Music,
  Gamepad2,
  Smartphone,
  Monitor,

  // Tag/label icons
  Lightbulb,
  CheckCircle2,
  Info,
  Link,
  Paperclip,
  MessageCircle,

  // Category icons
  Globe,
  Microscope,
  Wand2,
  Coffee,
  Box,

  // Action icons
  Bell,
  Frown,
  AlertTriangle,
  EyeOff,
  XCircle,
  Pencil,
  FileText,
  Lock,
  CreditCard,

  // Report icons
  Send,
  AlertOctagon,
} from 'lucide-react';

import { type ComponentType } from 'react';

/**
 * Icon component with standard props
 */
export type IconComponent = ComponentType<{
  size?: number | string;
  color?: string;
  className?: string;
}>;

/**
 * Mapping of emojis to Iconsax icon components.
 * Keys are the emoji strings, values are the Iconsax icon components.
 */
export const EMOJI_TO_ICON: Record<string, IconComponent> = {
  // Folder icons
  '📁': Folder,
  '📂': FolderOpen,
  '🗂️': LayoutGrid,
  '📋': ClipboardList,
  '📌': MapPin,
  '⭐': Star,
  '❤️': Heart,
  '💼': Briefcase,
  '🎯': Crosshair,
  '🔥': Zap,
  '✨': Sparkles,
  '🎨': Palette,
  '🎵': Music,
  '🎮': Gamepad2,
  '📱': Smartphone,
  '💻': Monitor,

  // Tag icons
  '💡': Lightbulb,
  '✅': CheckCircle2,
  '❓': Info,
  '🔗': Link,
  '📎': Paperclip,
  '💬': MessageCircle,

  // Category icons (Communities)
  '🌐': Globe,
  '🔬': Microscope,
  '⚽': Wand2,
  '🍕': Coffee,

  // Marketplace icons
  '📈': Box,
  '✍️': Pencil,
  '🎬': Smartphone,

  // Report icons
  '📢': Bell,
  '😠': Frown,
  '⚠️': AlertTriangle,
  '🔞': EyeOff,
  '🚫': XCircle,
  '📝': FileText,

  // SideMenu icons
  '📄': FileText,
  '🔒': Lock,
  '💳': CreditCard,
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
