import { e2eManager } from './e2eSession';
import { hasActiveSession, getSessionInfo } from './e2e';

export interface E2EChatStatus {
  isE2E: boolean;
  isReady: boolean;
  keyFingerprint: string | null;
}

export async function tryInitE2EForChat(
  userId: string,
  chatId: string,
  otherUserId: string | null,
  isSecret: boolean
): Promise<E2EChatStatus> {
  if (!isSecret || !otherUserId) {
    return { isE2E: false, isReady: false, keyFingerprint: null };
  }

  try {
    await e2eManager.initialize(userId);

    const existingInfo = getSessionInfo(chatId);
    if (existingInfo && hasActiveSession(chatId)) {
      return { isE2E: true, isReady: true, keyFingerprint: existingInfo.keyFingerprint };
    }

    const ok = await e2eManager.establishSession({ userId, chatId, otherUserId });
    if (ok) {
      const info = getSessionInfo(chatId);
      return { isE2E: true, isReady: true, keyFingerprint: info?.keyFingerprint || null };
    }

    return { isE2E: true, isReady: false, keyFingerprint: null };
  } catch {
    return { isE2E: false, isReady: false, keyFingerprint: null };
  }
}
