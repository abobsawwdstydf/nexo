import { e2eManager } from './e2eSession';
import {
  hasActiveSession,
  getSessionInfo,
  groupKeys,
  hasActiveGroup,
  getGroupSessionInfo,
} from './e2e';

export interface E2EChatStatus {
  isE2E: boolean;
  isReady: boolean;
  keyFingerprint: string | null;
}

// Общие групповые ключи E2E: chatId → CryptoKey (общий ключ группы).
// Используется компонентами для проверки готовности шифрования в группах.
export { groupKeys };

export async function tryInitE2EForChat(
  userId: string,
  chatId: string,
  otherUserId: string | null,
  isSecret: boolean,
  memberIds?: string[]
): Promise<E2EChatStatus> {
  if (!isSecret) {
    return { isE2E: false, isReady: false, keyFingerprint: null };
  }

  try {
    await e2eManager.initialize(userId);
  } catch {
    return { isE2E: true, isReady: false, keyFingerprint: null };
  }

  // Группа — если передан список участников (>= 2) и нет собеседника «1-на-1»
  const isGroup = (memberIds?.length ?? 0) >= 2;

  if (!isGroup) {
    if (!otherUserId) {
      return { isE2E: true, isReady: false, keyFingerprint: null };
    }
    // Личный чат (существующий механизм X25519/ECDH)
    try {
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
      return { isE2E: true, isReady: false, keyFingerprint: null };
    }
  }

  // Группа: сначала пробуем развернуть существующую сессию, иначе создаём
  try {
    if (hasActiveGroup(chatId)) {
      const info = getGroupSessionInfo(chatId);
      return { isE2E: true, isReady: true, keyFingerprint: info?.keyFingerprint || null };
    }

    let ok = await e2eManager.fetchExistingGroupSession(userId, chatId);
    if (!ok) {
      ok = await e2eManager.establishGroupSession(userId, chatId, memberIds || []);
    }

    if (ok) {
      const info = getGroupSessionInfo(chatId);
      return { isE2E: true, isReady: true, keyFingerprint: info?.keyFingerprint || null };
    }
    return { isE2E: true, isReady: false, keyFingerprint: null };
  } catch {
    return { isE2E: true, isReady: false, keyFingerprint: null };
  }
}
