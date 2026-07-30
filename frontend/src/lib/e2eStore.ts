import { e2eManager } from './e2eSession';
import { hasActiveSession, getSessionInfo } from './e2e';

export interface E2EChatStatus {
  isE2E: boolean;
  isReady: boolean;
  keyFingerprint: string | null;
}

const e2eChatStatus = new Map<string, E2EChatStatus>();

export async function tryInitE2EForChat(
  userId: string,
  chatId: string,
  otherUserId: string | null,
  isSecret: boolean
): Promise<E2EChatStatus> {
  if (!isSecret || !otherUserId) {
    const status: E2EChatStatus = { isE2E: false, isReady: false, keyFingerprint: null };
    e2eChatStatus.set(chatId, status);
    return status;
  }

  try {
    await e2eManager.initialize(userId);

    const existingInfo = getSessionInfo(chatId);
    if (existingInfo && hasActiveSession(chatId)) {
      const status: E2EChatStatus = { isE2E: true, isReady: true, keyFingerprint: existingInfo.keyFingerprint };
      e2eChatStatus.set(chatId, status);
      return status;
    }

    const ok = await e2eManager.establishSession({ userId, chatId, otherUserId });
    if (ok) {
      const info = getSessionInfo(chatId);
      const status: E2EChatStatus = { isE2E: true, isReady: true, keyFingerprint: info?.keyFingerprint || null };
      e2eChatStatus.set(chatId, status);
      return status;
    }

    const status: E2EChatStatus = { isE2E: true, isReady: false, keyFingerprint: null };
    e2eChatStatus.set(chatId, status);
    return status;
  } catch {
    const status: E2EChatStatus = { isE2E: false, isReady: false, keyFingerprint: null };
    e2eChatStatus.set(chatId, status);
    return status;
  }
}

export function getE2EStatus(chatId: string): E2EChatStatus {
  return e2eChatStatus.get(chatId) || { isE2E: false, isReady: false, keyFingerprint: null };
}

export function isE2EChat(chatId: string): boolean {
  return getE2EStatus(chatId).isE2E && getE2EStatus(chatId).isReady;
}

export function closeE2ESession(chatId: string): void {
  e2eManager.closeSession(chatId);
  e2eChatStatus.delete(chatId);
}
