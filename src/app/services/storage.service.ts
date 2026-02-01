/**
 * Storage Service
 * 
 * Handles persistence to localStorage.
 * Single responsibility: Read/write data to/from local storage.
 * This abstraction makes testing easier (can be mocked).
 */

import { Injectable } from '@angular/core';

export interface StorageService {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
}

/**
 * LocalStorageService - Concrete implementation using browser localStorage
 */
@Injectable({
  providedIn: 'root',
})
export class LocalStorageService implements StorageService {
  private readonly prefix = 'blackjack_';

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Error reading from localStorage: ${key}`, error);
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage: ${key}`, error);
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error(`Error removing from localStorage: ${key}`, error);
    }
  }

  clear(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing localStorage', error);
    }
  }
}
