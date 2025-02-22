import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Improved ID generation with persistence
export function generateMessageId(prefix = 'msg'): string {
  // Get the counter from localStorage or initialize it
  let counter: number;

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('messageIdCounter');
    counter = stored ? Number.parseInt(stored, 10) : 0;
    counter++;
    localStorage.setItem('messageIdCounter', counter.toString());
  } else {
    // Fallback for server-side rendering
    counter = Date.now();
  }

  // Combine timestamp and counter for uniqueness
  const timestamp = Date.now();
  return `${prefix}_${timestamp}_${counter}`;
}

// Add consistent timestamp generation
export function getFormattedTime() {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
}
