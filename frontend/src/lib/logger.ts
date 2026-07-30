const DEBUG = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

export const logger = {
  log: (...args: unknown[]) => { if (DEBUG) console.log(...args); },
  warn: (...args: unknown[]) => { if (DEBUG) console.warn(...args); },
  error: (...args: unknown[]) => console.error(...args),
  info: (...args: unknown[]) => { if (DEBUG) console.info(...args); },
};
