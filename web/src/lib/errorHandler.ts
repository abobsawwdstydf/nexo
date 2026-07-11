/**
 * Централизованная система обработки ошибок
 * Предотвращает баги и обеспечивает стабильную работу
 */

import { toast } from 'react-hot-toast';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Типы ошибок
export enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  AUTH = 'AUTH_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION = 'PERMISSION_ERROR',
  SERVER = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

// Обработчик ошибок
export const handleError = (error: any, context?: string): void => {
  console.error(`[${context || 'Error'}]:`, error);

  let message = 'Произошла ошибка';
  let type: ErrorType = ErrorType.UNKNOWN;

  if (error instanceof AppError) {
    message = error.message;
    type = (error.code as ErrorType) || ErrorType.UNKNOWN;
  } else if (error?.response) {
    // Axios error
    const status = error.response.status;
    if (status === 401) {
      message = 'Необходима авторизация';
      type = ErrorType.AUTH;
    } else if (status === 403) {
      message = 'Доступ запрещён';
      type = ErrorType.PERMISSION;
    } else if (status === 404) {
      message = 'Ресурс не найден';
      type = ErrorType.NOT_FOUND;
    } else if (status >= 500) {
      message = 'Ошибка сервера';
      type = ErrorType.SERVER;
    } else {
      message = error.response.data?.message || 'Ошибка запроса';
    }
  } else if (error?.message) {
    message = error.message;
    if (error.message.includes('network') || error.message.includes('fetch')) {
      type = ErrorType.NETWORK;
    }
  }

  // Показываем toast с ошибкой
  toast.error(message, {
    duration: 4000,
    position: 'top-center',
    style: {
      background: '#ef4444',
      color: '#fff',
      borderRadius: '12px',
      padding: '12px 20px',
    },
  });
};

// Wrapper для async функций с обработкой ошибок
export const withErrorHandler = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T => {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      throw error;
    }
  }) as T;
};

// Retry логика для сетевых запросов
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
};

// Debounce для предотвращения множественных вызовов
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle для ограничения частоты вызовов
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Валидация данных
export const validateRequired = (value: any, fieldName: string): void => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new AppError(
      `Поле "${fieldName}" обязательно для заполнения`,
      ErrorType.VALIDATION
    );
  }
};

export const validateEmail = (email: string): void => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new AppError('Неверный формат email', ErrorType.VALIDATION);
  }
};

export const validateMinLength = (
  value: string,
  minLength: number,
  fieldName: string
): void => {
  if (value.length < minLength) {
    throw new AppError(
      `${fieldName} должно содержать минимум ${minLength} символов`,
      ErrorType.VALIDATION
    );
  }
};

// Safe JSON parse
export const safeJsonParse = <T = any>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

// Safe localStorage
export const safeLocalStorage = {
  get: <T = any>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key: string, value: any): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('localStorage.setItem failed:', error);
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('localStorage.removeItem failed:', error);
    }
  },
};
