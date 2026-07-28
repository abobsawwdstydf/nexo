/**
 * Security utilities for input sanitization and protection
 */

// HTML entity map for escaping
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`/]/g, char => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Sanitize user input by removing potentially dangerous characters
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocol
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username format (alphanumeric, underscores, 3-32 chars)
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,32}$/;
  return usernameRegex.test(username);
}

/**
 * Generate a secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a string using SHA-256 (for client-side hashing)
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a URL is safe (same origin or whitelisted)
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    // Allow same origin
    if (parsed.origin === window.location.origin) return true;
    // Allow common CDNs
    const allowedDomains = [
      'cdn.jsdelivr.net',
      'unpkg.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
    ];
    return allowedDomains.some(domain => parsed.hostname.endsWith(domain));
  } catch {
    return false;
  }
}

/**
 * Rate limiter for client-side actions
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 60000 // 1 minute
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(t => now - t < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

/**
 * Content Security Policy nonce generator
 */
export function generateCspNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

/**
 * Sanitize URL for display (prevents javascript: protocol)
 */
export function sanitizeUrl(url: string): string {
  if (/^javascript:/i.test(url)) {
    return '#';
  }
  return url;
}

/**
 * Escape CSS selector to prevent injection
 */
export function escapeCssSelector(selector: string): string {
  return selector.replace(/([^\w-])/g, '\\$1');
}

/**
 * Validate and sanitize message content
 */
export function sanitizeMessage(content: string): string {
  return content
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Check for potentially malicious patterns
 */
export function containsMaliciousPattern(input: string): boolean {
  const patterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /expression\s*\(/gi,
    /url\s*\(["']?/gi,
  ];
  
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize rich text content (for messages with formatting)
 */
export function sanitizeRichText(html: string): string {
  // Only allow safe tags
  const allowedTags = ['b', 'i', 'u', 'em', 'strong', 'a', 'code', 'pre', 'br', 'p'];
  const allowedAttributes = ['href', 'target', 'rel'];
  
  return html.replace(/<(\w+)([^>]*)>/g, (match, tag, attrs) => {
    if (!allowedTags.includes(tag.toLowerCase())) {
      return '';
    }
    
    // Sanitize attributes
    const sanitizedAttrs = attrs.replace(/(\w+)=["']([^"']*)["']/g, (match: string, attr: string, value: string) => {
      if (!allowedAttributes.includes(attr.toLowerCase())) {
        return '';
      }
      
      // Sanitize href values
      if (attr.toLowerCase() === 'href') {
        if (/^javascript:/i.test(value)) {
          return '';
        }
        return `${attr}="${sanitizeUrl(value)}"`;
      }
      
      return `${attr}="${escapeHtml(value)}"`;
    });
    
    return `<${tag}${sanitizedAttrs}>`;
  });
}
