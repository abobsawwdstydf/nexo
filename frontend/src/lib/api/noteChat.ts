import type { Message } from '../types';

const NOTES_KEY = 'nexo_notes_messages';
const CHAT_ID = '_saved_messages_';

export const NOTES_CHANGED_EVENT = 'nexo:notes-changed';

function notifyNotesChanged() {
  try {
    window.dispatchEvent(new CustomEvent(NOTES_CHANGED_EVENT));
  } catch {}
}

export function getNotesMessages(): Message[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveNotesMessage(msg: Message) {
  const notes = getNotesMessages();
  const idx = notes.findIndex(m => m.id === msg.id);
  if (idx >= 0) {
    notes[idx] = msg;
  } else {
    notes.push(msg);
  }
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  notifyNotesChanged();
}

export function deleteNotesMessage(messageId: string) {
  const notes = getNotesMessages().filter(m => m.id !== messageId);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  notifyNotesChanged();
}

export const NOTES_CHAT_ID = CHAT_ID;
