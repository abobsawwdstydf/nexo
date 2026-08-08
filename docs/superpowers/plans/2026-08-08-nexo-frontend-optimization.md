# Nexo Frontend Optimization & Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize Nexo messenger frontend for weak devices and implement Telegram-style features including performance optimization, context menus, comments, markdown support, profile redesign, and animated emojis.

**Architecture:** Refactor existing React components with performance optimizations (React.memo, will-change, hardware acceleration), add new context menu system, implement Telegram-style chat header and pinned messages, add Stories section, folder tabs, and full-screen profile modal.

**Tech Stack:** React, TypeScript, Framer Motion, Tailwind CSS, Lucide icons, custom animated SVG emojis

## Global Constraints

- All domains must work: `msg.darkheavens.ru`, `msg.hakerone.ru`, `n.darkheavens.ru`, `n.hakerone.ru`, `nexo.darkheavens.ru`, `nexo.hakerone.ru`, `нексо.hakerone.ru`, `нексо.darkheavens.ru`
- **NEVER** reference `nexo.app` — always use dynamic `window.location.hostname`
- No standard Unicode emojis — use custom animated ones (like Telegram custom emoji)
- Design must match dark glass/blur aesthetic: `#0a0a0f` bg, `liquid-glass` classes, `Onest` font
- Performance must be optimized for weak devices (disable heavy CSS blur on weak devices)

---

## Task 1: Performance Optimization for Weak Devices

**Files:**
- Modify: `frontend/src/index.css:1-50` (add performance detection)
- Modify: `frontend/src/components/MessageArea.tsx:1-100` (add performance detection hook)
- Modify: `frontend/src/components/ChatList.tsx:1-50` (add performance detection hook)

**Interfaces:**
- Consumes: None (first task)
- Produces: `usePerformanceMode()` hook, `perf-mode` CSS class on body

- [ ] **Step 1: Create performance detection hook**

```typescript
// frontend/src/hooks/usePerformanceMode.ts
import { useState, useEffect } from 'react';

export function usePerformanceMode() {
  const [isLowPerf, setIsLowPerf] = useState(false);

  useEffect(() => {
    // Detect weak device via hardware concurrency and device memory
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // If mobile with <=4 cores or <=4GB memory, enable low perf mode
    if (isMobile && (cores <= 4 || memory <= 4)) {
      setIsLowPerf(true);
      document.body.classList.add('perf-mode');
    }
  }, []);

  return isLowPerf;
}
```

- [ ] **Step 2: Add low-performance CSS overrides**

```css
/* frontend/src/index.css - add at end */
.perf-mode .liquid-glass {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  background: rgba(15, 15, 25, 0.95) !important;
}

.perf-mode .liquid-glass-strong {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  background: rgba(12, 12, 20, 0.98) !important;
}

.perf-mode * {
  will-change: auto !important;
  transform: translateZ(0) !important;
}
```

- [ ] **Step 3: Use hook in MessengerPage**

```typescript
// frontend/src/pages/MessengerPage.tsx
import { usePerformanceMode } from '../hooks/usePerformanceMode';

export function MessengerPage() {
  const isLowPerf = usePerformanceMode();
  // ... rest of component
}
```

- [ ] **Step 4: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 2: Optimistic UI for Message Sending

**Files:**
- Modify: `frontend/src/components/MessageArea.tsx:2602-2700` (handleSend function)

**Interfaces:**
- Consumes: `Message` type from `frontend/src/lib/types.ts`
- Produces: Messages appear instantly in chat with `_isSending: true` status

- [ ] **Step 1: Implement optimistic message insertion**

```typescript
// In MessageArea.tsx, modify handleSend function
const handleSend = useCallback(async (text: string, options?: { replyToId?: string; media?: any[]; isEncrypted?: boolean; encryptedContent?: string }) => {
  const optimisticId = `opt_${Date.now()}`;
  const optimisticMessage: Message = {
    id: optimisticId,
    chatId: chat.id,
    senderId: user?.id || '',
    content: text,
    type: 'text',
    replyToId: options?.replyToId || null,
    isEdited: false,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    sender: {
      id: user?.id || '',
      username: user?.username || '',
      displayName: user?.displayName || '',
      avatar: user?.avatar,
      isVerified: user?.isVerified,
      verifiedBadgeUrl: user?.verifiedBadgeUrl,
      verifiedBadgeType: user?.verifiedBadgeType,
    },
    media: [],
    reactions: [],
    readBy: [],
    _isSending: true,
  };

  // Add to messages immediately
  setMessages(prev => [...prev, optimisticMessage]);
  
  // Clear input immediately
  setReplyTo(null);
  
  // Then send to server
  try {
    const response = await api.sendMessage(chat.id, text, options);
    // Replace optimistic message with real one
    setMessages(prev => prev.map(msg => 
      msg.id === optimisticId ? { ...response, _isSending: false } : msg
    ));
  } catch (error) {
    // Mark as failed
    setMessages(prev => prev.map(msg => 
      msg.id === optimisticId ? { ...msg, _isSending: false, _isFailed: true } : msg
    ));
  }
}, [chat.id, user, api]);
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 3: Stories Section in Chat List

**Files:**
- Modify: `frontend/src/components/ChatList.tsx:418-425` (add stories section)
- Create: `frontend/src/components/StoriesBar.tsx` (new component)

**Interfaces:**
- Consumes: `Chat[]` from props
- Produces: Stories bar component with circular avatars

- [ ] **Step 1: Create StoriesBar component**

```typescript
// frontend/src/components/StoriesBar.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import type { User } from '../lib/types';

interface StoriesBarProps {
  user: User | null;
  chats: Array<{ id: string; name: string; avatar: string | null }>;
  onOpenProfile: () => void;
}

export function StoriesBar({ user, chats, onOpenProfile }: StoriesBarProps) {
  return (
    <div className="flex-shrink-0 px-3 py-2 border-b border-white/[0.06]">
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
        {/* My Story */}
        <motion.button
          onClick={onOpenProfile}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex flex-col items-center gap-1 min-w-[64px]"
        >
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center border-2 border-dashed border-white/20">
              <Plus size={20} className="text-white/70" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent border-2 border-[#0a0a0f] flex items-center justify-center">
              <Plus size={10} className="text-white" />
            </div>
          </div>
          <span className="text-[10px] text-white/50">Моя история</span>
        </motion.button>

        {/* Other stories */}
        {chats.slice(0, 8).map((chat) => (
          <motion.button
            key={chat.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-1 min-w-[64px]"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/30 to-pink-500/30 p-0.5">
              {chat.avatar ? (
                <img
                  src={chat.avatar}
                  alt={chat.name || ''}
                  className="w-full h-full rounded-full object-cover border-2 border-[#0a0a0f]"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-white/[0.08] flex items-center justify-center border-2 border-[#0a0a0f]">
                  <span className="text-sm font-medium text-white/50">
                    {(chat.name || '?').slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <span className="text-[10px] text-white/50 truncate max-w-[64px]">
              {chat.name?.split(' ')[0] || ''}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add StoriesBar to ChatList**

```typescript
// In ChatList.tsx, after the search section
<div className="flex-shrink-0 px-3 pt-3 pb-2">
  {/* ... existing search ... */}
</div>

<StoriesBar 
  user={user} 
  chats={chats.slice(0, 8)} 
  onOpenProfile={onOpenProfile} 
/>

<div className="flex-shrink-0 flex items-center gap-1.5 px-3 pb-2">
  {/* ... existing action buttons ... */}
</div>
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 4: Folder Tabs in Chat List

**Files:**
- Modify: `frontend/src/components/ChatList.tsx:418-425` (add folder tabs)
- Modify: `frontend/src/components/ChatList.tsx:32-55` (add active folder state)

**Interfaces:**
- Consumes: `CATEGORIES` array
- Produces: Active folder state, filtered chats

- [ ] **Step 1: Add active folder state**

```typescript
// In ChatList component
const [activeFolder, setActiveFolder] = useState('all');

// Add filtering logic
const filteredChats = useMemo(() => {
  if (activeFolder === 'all') return chats;
  
  return chats.filter(chat => {
    switch (activeFolder) {
      case 'news':
        return chat.type === 'channel';
      case 'personal':
        return chat.type === 'personal';
      case 'groups':
        return chat.type === 'group';
      case 'channels':
        return chat.type === 'channel';
      default:
        return true;
    }
  });
}, [chats, activeFolder]);
```

- [ ] **Step 2: Add folder tabs UI**

```typescript
// In ChatList.tsx, after StoriesBar
<div className="flex-shrink-0 px-3 py-2">
  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
    {CATEGORIES.map((cat) => (
      <motion.button
        key={cat.id}
        onClick={() => setActiveFolder(cat.id)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
          activeFolder === cat.id
            ? 'bg-accent/20 text-accent border border-accent/30'
            : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] border border-transparent'
        }`}
      >
        {cat.label}
        {cat.badge && (
          <span className="px-1.5 py-0.5 rounded-full bg-accent/30 text-[10px] text-accent">
            {cat.badge}
          </span>
        )}
      </motion.button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Update chat list to use filteredChats**

```typescript
// In ChatList.tsx, replace chats.map with filteredChats.map
{filteredChats.map((chat, index) => (
  // ... existing chat item
))}
```

- [ ] **Step 4: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 5: Context Menu for Chat Items (Pin/Mute)

**Files:**
- Modify: `frontend/src/components/ChatList.tsx:143-200` (ChatListItem)
- Create: `frontend/src/components/ChatContextMenu.tsx` (new component)

**Interfaces:**
- Consumes: `Chat` type
- Produces: Context menu with Pin/Mute/Delete actions

- [ ] **Step 1: Create ChatContextMenu component**

```typescript
// frontend/src/components/ChatContextMenu.tsx
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pin, BellOff, Bell, Trash2, X } from 'lucide-react';
import type { Chat } from '../lib/types';

interface ChatContextMenuProps {
  chat: Chat;
  position: { x: number; y: number };
  onClose: () => void;
  onPin: (chatId: string) => void;
  onMute: (chatId: string) => void;
  onDelete: (chatId: string) => void;
}

export function ChatContextMenu({
  chat,
  position,
  onClose,
  onPin,
  onMute,
  onDelete,
}: ChatContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed z-50 w-48 py-1.5 rounded-2xl liquid-glass-strong border border-white/[0.1] shadow-2xl"
      style={{ top: position.y, left: position.x }}
    >
      <button
        onClick={() => { onPin(chat.id); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <Pin size={14} />
        Закрепить чат
      </button>
      <button
        onClick={() => { onMute(chat.id); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <BellOff size={14} />
        Беззвучный
      </button>
      <div className="mx-3 my-1 h-px bg-white/[0.06]" />
      <button
        onClick={() => { onDelete(chat.id); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-white/[0.08] transition-colors"
      >
        <Trash2 size={14} />
        Удалить чат
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 2: Add context menu to ChatListItem**

```typescript
// In ChatListItem component
const [showContextMenu, setShowContextMenu] = useState(false);
const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  setContextMenuPos({ x: e.clientX, y: e.clientY });
  setShowContextMenu(true);
};

// Add to return
<>
  <motion.button
    onClick={onSelect}
    onContextMenu={onContextMenu}
    // ... existing props
  >
    {/* ... existing content */}
  </motion.button>

  {showContextMenu && (
    <ChatContextMenu
      chat={chat}
      position={contextMenuPos}
      onClose={() => setShowContextMenu(false)}
      onPin={onPin}
      onMute={onMute}
      onDelete={onDelete}
    />
  )}
</>
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 6: Quick Reactions on Long Press

**Files:**
- Modify: `frontend/src/components/MessageArea.tsx:499-712` (MessageBubble)
- Create: `frontend/src/components/QuickReactions.tsx` (new component)

**Interfaces:**
- Consumes: `Message` type, `handleReact` function
- Produces: Quick reactions popup on long press

- [ ] **Step 1: Create QuickReactions component**

```typescript
// frontend/src/components/QuickReactions.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedEmoji } from './AnimatedEmoji';

interface QuickReactionsProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '😮', '😢', '👏', '🎉'];

export function QuickReactions({ onSelect, onClose }: QuickReactionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-2xl liquid-glass-strong border border-white/[0.1] shadow-2xl z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1">
        {QUICK_REACTIONS.map((emoji) => (
          <motion.button
            key={emoji}
            whileHover={{ scale: 1.3, y: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-white/[0.1] transition-colors"
          >
            <AnimatedEmoji emoji={emoji} size={28} />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Add long press handler to MessageBubble**

```typescript
// In MessageBubble component
const [showQuickReactions, setShowQuickReactions] = useState(false);
const longPressTimer = useRef<NodeJS.Timeout>();

const handlePointerDown = () => {
  longPressTimer.current = setTimeout(() => {
    setShowQuickReactions(true);
  }, 500);
};

const handlePointerUp = () => {
  if (longPressTimer.current) {
    clearTimeout(longPressTimer.current);
  }
};

// Add to motion.div
<motion.div
  onPointerDown={handlePointerDown}
  onPointerUp={handlePointerUp}
  onPointerLeave={handlePointerUp}
  // ... existing props
>
  {/* ... existing content */}

  {showQuickReactions && (
    <QuickReactions
      onSelect={(emoji) => onReact?.(message.id)}
      onClose={() => setShowQuickReactions(false)}
    />
  )}
</motion.div>
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 7: Full Context Menu on Message Long Press

**Files:**
- Modify: `frontend/src/components/MessageArea.tsx:499-712` (MessageBubble)
- Create: `frontend/src/components/MessageContextMenu.tsx` (new component)

**Interfaces:**
- Consumes: `Message` type, action handlers
- Produces: Full context menu with all actions

- [ ] **Step 1: Create MessageContextMenu component**

```typescript
// frontend/src/components/MessageContextMenu.tsx
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Pin, Reply, Copy, Edit3, Trash2, Forward, X } from 'lucide-react';
import type { Message } from '../lib/types';

interface MessageContextMenuProps {
  message: Message;
  isOwn: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onPin: (messageId: string) => void;
  onCopy: (content: string) => void;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
}

export function MessageContextMenu({
  message,
  isOwn,
  position,
  onClose,
  onReply,
  onForward,
  onPin,
  onCopy,
  onEdit,
  onDelete,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed z-50 w-52 py-1.5 rounded-2xl liquid-glass-strong border border-white/[0.1] shadow-2xl"
      style={{ top: position.y, left: position.x }}
    >
      <button
        onClick={() => { onPin(message.id); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <Pin size={14} />
        Закрепить
      </button>
      <button
        onClick={() => { onReply(message); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <Reply size={14} />
        Ответить
      </button>
      <button
        onClick={() => { onCopy(message.content || ''); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <Copy size={14} />
        Копировать
      </button>
      <button
        onClick={() => { onForward(message); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <Forward size={14} />
        Переслать
      </button>
      {isOwn && (
        <button
          onClick={() => { onEdit(message); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
        >
          <Edit3 size={14} />
          Редактировать
        </button>
      )}
      <div className="mx-3 my-1 h-px bg-white/[0.06]" />
      <button
        onClick={() => { onDelete(message.id, false); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-white/[0.08] transition-colors"
      >
        <Trash2 size={14} />
        Удалить для меня
      </button>
      {isOwn && (
        <button
          onClick={() => { onDelete(message.id, true); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-white/[0.08] transition-colors"
        >
          <Trash2 size={14} />
          Удалить для всех
        </button>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Add context menu to MessageBubble**

```typescript
// In MessageBubble component
const [showContextMenu, setShowContextMenu] = useState(false);
const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault();
  setContextMenuPos({ x: e.clientX, y: e.clientY });
  setShowContextMenu(true);
};

// Add to motion.div
<motion.div
  onContextMenu={handleContextMenu}
  // ... existing props
>
  {/* ... existing content */}

  {showContextMenu && (
    <MessageContextMenu
      message={message}
      isOwn={isOwn}
      position={contextMenuPos}
      onClose={() => setShowContextMenu(false)}
      onReply={onReply || (() => {})}
      onForward={onForward || (() => {})}
      onPin={onPin || (() => {})}
      onCopy={(content) => navigator.clipboard.writeText(content)}
      onEdit={onEdit || (() => {})}
      onDelete={onDelete || (() => {})}
    />
  )}
</motion.div>
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 8: Telegram-Style Chat Header

**Files:**
- Modify: `frontend/src/components/MessageArea.tsx:726-925` (ChatHeader)

**Interfaces:**
- Consumes: `Chat` type, `pinnedMessages` array
- Produces: Capsule-shaped header with back button, avatar, search, menu

- [ ] **Step 1: Update ChatHeader styling**

```typescript
// In ChatHeader component, update the header container
return (
  <div className="flex-shrink-0 p-2.5 space-y-2 z-20">
    {/* ─── Top Floating Pill Header Bar (Screenshot 1 TG Style) ────── */}
    <div className="flex items-center justify-between px-3 py-2 rounded-[24px] liquid-glass-strong border border-white/[0.1] shadow-lg backdrop-blur-xl">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Back button */}
        <motion.button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] transition-colors flex-shrink-0"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft size={18} className="text-white/80" />
        </motion.button>

        {/* Profile Capsule Button */}
        <motion.button
          onClick={onOpenProfile}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2.5 px-2 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all text-left min-w-0 flex-1 max-w-fit"
        >
          {chat.avatar ? (
            <img
              src={chat.avatar}
              alt={chat.name || ''}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.05] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white/70">{initials}</span>
            </div>
          )}

          <div className="min-w-0 pr-1">
            <h2 className="flex items-center gap-1 text-xs font-bold text-white/90 truncate font-display">
              <span className="truncate">{chat.name || 'Без названия'}</span>
              {chat.isVerified && (
                <VerifiedBadge
                  isVerified
                  badgeUrl={chat.verifiedBadgeUrl}
                  badgeType={chat.verifiedBadgeType}
                  size={13}
                />
              )}
            </h2>
            <p className="text-[10px] text-white/40 truncate leading-none mt-0.5">
              {isAIChat
                ? '@nexo_ai'
                : chat.type === 'personal'
                ? 'Личный чат'
                : chat.type === 'group'
                ? `${chat.members?.length || 0} участников`
                : chat.type === 'channel'
                ? 'Канал'
                : ''}
            </p>
          </div>
        </motion.button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <motion.button
          onClick={onSearchToggle}
          className="p-2 rounded-full hover:bg-white/[0.08] transition-colors text-white/60 hover:text-white"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          title="Поиск"
        >
          <Search size={17} />
        </motion.button>

        <div className="relative" ref={menuRef}>
          <motion.button
            onClick={() => setShowMenu(v => !v)}
            className="p-2 rounded-full hover:bg-white/[0.08] transition-colors text-white/60 hover:text-white"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            <Menu size={17} />
          </motion.button>

          {/* Menu dropdown */}
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-48 py-1.5 rounded-2xl liquid-glass-strong border border-white/[0.1] shadow-2xl z-50 text-xs"
              >
                <ChatMenuItem icon={Search} label="Поиск" onClick={onSearchToggle} />
                <ChatMenuItem icon={BellOff} label="Отключить звук" />
                <ChatMenuItem icon={Image} label="Медиафайлы" />
                {chat.type === 'group' && <ChatMenuItem icon={Users} label="Участники" />}
                <div className="mx-3 my-1 h-px bg-white/[0.06]" />
                <ChatMenuItem icon={Flag} label="Пожаловаться" className="text-red-400" />
                <ChatMenuItem icon={Trash2} label="Удалить чат" className="text-red-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>

    {/* ─── Pinned Message Sub-Header Pill ───── */}
    {latestPinned && (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className="flex items-center justify-between px-3.5 py-2 rounded-[20px] liquid-glass-strong border border-white/[0.08] border-l-4 border-l-blue-400 shadow-md"
      >
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-[11px] font-bold text-blue-400 flex items-center gap-1 font-display">
            Закреплённое сообщение
          </p>
          <p className="text-xs text-white/70 truncate mt-0.5">
            {latestPinned.message.content}
          </p>
        </div>
        {onUnpinMessage && (
          <button
            onClick={() => onUnpinMessage(latestPinned.id)}
            className="p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </motion.div>
    )}
  </div>
);
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 9: Mobile Bottom Nav Fix

**Files:**
- Modify: `frontend/src/components/MobileBottomNav.tsx:1-56` (fix z-index and padding)

**Interfaces:**
- Consumes: None
- Produces: Fixed bottom nav that doesn't overlap profile

- [ ] **Step 1: Update MobileBottomNav styling**

```typescript
// In MobileBottomNav.tsx
export function MobileBottomNav({
  active,
  onChats,
  onFriends,
  onSettings,
  onSearch,
  onProfile,
}: MobileBottomNavProps) {
  const items = [
    { id: 'friends' as const, label: 'Контакты', icon: Users, onClick: onFriends },
    { id: 'chats' as const, label: 'Чаты', icon: MessageCircle, onClick: onChats },
    { id: 'settings' as const, label: 'Настройки', icon: Settings, onClick: onSettings },
    { id: 'search' as const, label: 'Поиск', icon: Search, onClick: onSearch },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 pb-safe">
      <div className="mx-3 mb-3 flex items-center justify-around px-3 py-2 rounded-[26px] liquid-glass-strong border border-white/[0.1] shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {items.map(item => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              onClick={item.onClick}
              whileTap={{ scale: 0.88 }}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'text-white bg-white/[0.1] shadow-[0_4px_12px_rgba(255,255,255,0.1)]'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className={`text-[10px] font-medium tracking-tight ${isActive ? 'text-white font-semibold' : 'text-white/50'}`}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add safe area padding to main content**

```css
/* frontend/src/index.css */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 10: Full-Screen Profile Modal on Mobile

**Files:**
- Modify: `frontend/src/components/UserProfileModal.tsx:1-100` (make full-screen on mobile)

**Interfaces:**
- Consumes: `User` type
- Produces: Full-screen profile modal on mobile devices

- [ ] **Step 1: Update UserProfileModal for mobile**

```typescript
// In UserProfileModal.tsx
export function UserProfileModal({ user, onClose }: UserProfileModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center md:p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full h-full md:h-auto md:max-h-[85vh] max-w-none md:max-w-[440px] rounded-none md:rounded-3xl liquid-glass-strong overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.06] liquid-glass-strong backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-white/90">Профиль</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.1] transition-colors"
          >
            <X size={16} className="text-white/50" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Avatar */}
          <div className="flex justify-center">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.displayName}
                className="w-24 h-24 rounded-full object-cover border-4 border-white/10"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-white/[0.08] border-4 border-white/10 flex items-center justify-center">
                <User size={40} className="text-white/30" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-white/90 flex items-center justify-center gap-2">
              {user?.displayName || user?.username}
              {user?.isVerified && (
                <VerifiedBadge
                  isVerified
                  badgeUrl={user?.verifiedBadgeUrl}
                  badgeType={user?.verifiedBadgeType}
                  size={18}
                />
              )}
            </h2>
            <p className="text-sm text-white/50">@{user?.username}</p>
            {user?.bio && (
              <p className="text-xs text-white/40 mt-2">{user.bio}</p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-sm text-white/70">
              <MessageCircle size={18} />
              Написать сообщение
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-sm text-white/70">
              <Phone size={18} />
              Позвонить
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors text-sm text-white/70">
              <Video size={18} />
              Видеозвонок
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 11: Remove Wallet from Attachments

**Files:**
- Modify: `frontend/src/components/MessageArea.tsx:85-92` (ATTACHMENT_OPTIONS)

**Interfaces:**
- Consumes: None
- Produces: Updated attachment options without wallet

- [ ] **Step 1: Remove wallet from ATTACHMENT_OPTIONS**

```typescript
// In MessageArea.tsx
const ATTACHMENT_OPTIONS = [
  { icon: Image, label: 'Галерея', color: 'text-blue-400' },
  { icon: Camera, label: 'Камера', color: 'text-green-400' },
  { icon: FileText, label: 'Файл', color: 'text-purple-400' },
  { icon: MapPin, label: 'Геопозиция', color: 'text-red-400' },
  { icon: Circle, label: 'Кружок', color: 'text-cyan-400' },
];
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Task 12: Update Onboarding Modal

**Files:**
- Modify: `frontend/src/components/OnboardingModal.tsx:10-90` (add new steps)

**Interfaces:**
- Consumes: None
- Produces: Updated onboarding with all new features

- [ ] **Step 1: Add new onboarding steps**

```typescript
// In OnboardingModal.tsx
const STEPS = [
  {
    title: 'Добро пожаловать в Нексо!',
    subtitle: 'Защищённый и молниеносный мессенджер нового поколения',
    icon: Sparkles,
    color: 'from-violet-500 to-fuchsia-600',
    content: (
      <div className="text-center py-4 space-y-3">
        <div className="flex justify-center gap-2 my-2">
          <AnimatedEmoji emoji="🚀" size={40} />
          <AnimatedEmoji emoji="🔥" size={40} />
          <AnimatedEmoji emoji="🎉" size={40} />
        </div>
        <p className="text-sm text-white/70">
          Ощутите мгновенную отправку сообщений, кастомные анимированные эмодзи, таблицы в чатах и полное отсутствие задержек даже на самых слабых устройствах.
        </p>
      </div>
    ),
  },
  {
    title: 'Папки и Истории (TG Style)',
    subtitle: 'Управляйте чатами быстро и удобно',
    icon: Layers,
    color: 'from-blue-500 to-cyan-500',
    content: (
      <div className="space-y-3 py-2 text-sm text-white/70">
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
          <span className="p-2 rounded-lg bg-blue-500/20 text-blue-400">📂</span>
          <div>
            <p className="font-semibold text-white/90">Папки и Фильтры</p>
            <p className="text-xs text-white/40">Разделяйте Новости, Личные и Каналы в один клик</p>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
          <span className="p-2 rounded-lg bg-pink-500/20 text-pink-400">📸</span>
          <div>
            <p className="font-semibold text-white/90">Истории</p>
            <p className="text-xs text-white/40">Делитесь моментами прямо над списком чатов</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Анимированные эмодзи & Реакции',
    subtitle: 'Никаких скучных стандартных значков',
    icon: Zap,
    color: 'from-amber-400 to-orange-500',
    content: (
      <div className="space-y-3 py-2 text-center">
        <p className="text-sm text-white/70 mb-2">
          Зажмите любое сообщение, чтобы вызвать панель быстрых анимированных реакций!
        </p>
        <div className="flex items-center justify-center gap-3 p-3 rounded-2xl bg-white/[0.06] border border-white/[0.1] liquid-glass-strong">
          <AnimatedEmoji emoji="👍" size={32} />
          <AnimatedEmoji emoji="❤️" size={32} />
          <AnimatedEmoji emoji="🔥" size={32} />
          <AnimatedEmoji emoji="😂" size={32} />
          <AnimatedEmoji emoji="😮" size={32} />
          <AnimatedEmoji emoji="🎉" size={32} />
        </div>
      </div>
    ),
  },
  {
    title: 'Markdown & Таблицы',
    subtitle: 'Оформляйте тексты с профессиональным дизайном',
    icon: MessageSquare,
    color: 'from-emerald-400 to-teal-600',
    content: (
      <div className="space-y-2 py-2 text-xs">
        <p className="text-white/70 text-sm mb-2">Создавайте форматированные таблицы прямо в сообщениях:</p>
        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 font-mono text-emerald-300">
          | Название | Статус |<br />
          |---|---|<br />
          | Нексо | ⚡️ 60 FPS |
        </div>
      </div>
    ),
  },
  {
    title: 'Контекстные Меню',
    subtitle: 'Быстрые действия одним касанием',
    icon: Layers,
    color: 'from-rose-400 to-pink-600',
    content: (
      <div className="space-y-3 py-2 text-sm text-white/70">
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
          <span className="p-2 rounded-lg bg-rose-500/20 text-rose-400">💬</span>
          <div>
            <p className="font-semibold text-white/90">Зажмите сообщение</p>
            <p className="text-xs text-white/40">Закрепить, ответить, копировать, удалить</p>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
          <span className="p-2 rounded-lg bg-blue-500/20 text-blue-400">📌</span>
          <div>
            <p className="font-semibold text-white/90">Закрепление чатов</p>
            <p className="text-xs text-white/40">Закрепите важные чаты вверху списка</p>
          </div>
        </div>
      </div>
    ),
  },
];
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-08-nexo-frontend-optimization.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?