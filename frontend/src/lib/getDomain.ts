/**
 * Returns the current domain for display purposes.
 * Never returns "nexo.app" — uses the actual host.
 */
export function getDomain(): string {
  if (typeof window === 'undefined') return 'msg.darkheavens.ru';
  return window.location.hostname;
}

/**
 * Returns a full invite link like "msg.darkheavens.ru/@username"
 */
export function getInviteLink(username: string): string {
  return `${getDomain()}/@${username}`;
}
