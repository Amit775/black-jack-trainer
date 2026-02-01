import { Injectable, signal, computed, inject } from '@angular/core';
import { GameResult } from '../shared/models';
import { LocalStorageService } from './storage.service';
import {
  calculateStatisticsUpdate,
  calculateWinRate,
  calculateNetProfit,
} from './statistics-calculator';

export interface GameRecord {
  date: Date;
  bet: number;
  result: GameResult;
  playerFinalValue: number;
  dealerFinalValue: number;
  isBlackjack: boolean;
}

export interface Statistics {
  totalGames: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
}

const INITIAL_STATS: Statistics = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  blackjacks: 0,
  totalWagered: 0,
  totalWon: 0,
  totalLost: 0,
};

const STORAGE_KEYS = {
  STATS: 'statistics',
  HISTORY: 'game_history',
} as const;

/**
 * StatisticsService
 * 
 * Manages game statistics state.
 * Delegates persistence to LocalStorageService.
 * Delegates calculations to pure functions.
 */
@Injectable({
  providedIn: 'root',
})
export class StatisticsService {
  private readonly storage = inject(LocalStorageService);

  private readonly _stats = signal<Statistics>(INITIAL_STATS);
  private readonly _gameHistory = signal<GameRecord[]>([]);

  readonly stats = this._stats.asReadonly();
  readonly gameHistory = this._gameHistory.asReadonly();

  // Computed values using pure functions
  readonly winRate = computed(() => calculateWinRate(this._stats()));
  readonly netProfit = computed(() => calculateNetProfit(this._stats()));

  constructor() {
    this.loadFromStorage();
  }

  recordGame(record: GameRecord): void {
    // Update history
    this._gameHistory.update((history) => [...history, record]);

    // Update stats using pure function
    this._stats.update((stats) => calculateStatisticsUpdate(stats, record));

    // Persist
    this.saveToStorage();
  }

  resetStatistics(): void {
    this._stats.set(INITIAL_STATS);
    this._gameHistory.set([]);
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    const savedStats = this.storage.get<Statistics>(STORAGE_KEYS.STATS);
    if (savedStats) {
      this._stats.set(savedStats);
    }

    const savedHistory = this.storage.get<GameRecord[]>(STORAGE_KEYS.HISTORY);
    if (savedHistory) {
      // Convert date strings back to Date objects
      const history = savedHistory.map((record) => ({
        ...record,
        date: new Date(record.date),
      }));
      this._gameHistory.set(history);
    }
  }

  private saveToStorage(): void {
    this.storage.set(STORAGE_KEYS.STATS, this._stats());
    this.storage.set(STORAGE_KEYS.HISTORY, this._gameHistory());
  }
}
