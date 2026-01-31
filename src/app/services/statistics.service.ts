import { Injectable, signal, computed } from '@angular/core';
import { GameResult } from '../shared/models';

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

@Injectable({
  providedIn: 'root',
})
export class StatisticsService {
  private readonly _stats = signal<Statistics>(INITIAL_STATS);
  private readonly _gameHistory = signal<GameRecord[]>([]);

  readonly stats = this._stats.asReadonly();
  readonly gameHistory = this._gameHistory.asReadonly();

  readonly winRate = computed(() => {
    const stats = this._stats();
    if (stats.totalGames === 0) return 0;
    return (stats.wins / stats.totalGames) * 100;
  });

  readonly netProfit = computed(() => {
    const stats = this._stats();
    return stats.totalWon - stats.totalLost;
  });

  constructor() {
    this.loadFromStorage();
  }

  recordGame(record: GameRecord): void {
    this._gameHistory.update((history) => [...history, record]);

    this._stats.update((stats) => {
      const updated = { ...stats };
      updated.totalGames++;
      updated.totalWagered += record.bet;

      switch (record.result) {
        case 'win':
          updated.wins++;
          updated.totalWon += record.bet;
          break;
        case 'blackjack':
          updated.wins++;
          updated.blackjacks++;
          updated.totalWon += record.bet * 1.5;
          break;
        case 'lose':
          updated.losses++;
          updated.totalLost += record.bet;
          break;
        case 'push':
          updated.pushes++;
          break;
      }

      return updated;
    });

    this.saveToStorage();
  }

  resetStatistics(): void {
    this._stats.set(INITIAL_STATS);
    this._gameHistory.set([]);
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    // TODO: Implement localStorage loading
  }

  private saveToStorage(): void {
    // TODO: Implement localStorage saving
  }
}
