/**
 * Statistics Calculator
 * 
 * Pure functions for calculating statistics.
 * Single responsibility: Transform data for statistics.
 * These functions are stateless and easily testable.
 */

import { GameResult } from '../shared/models';
import { GameRecord, Statistics } from './statistics.service';

/**
 * Calculate updated statistics from a game record
 */
export function calculateStatisticsUpdate(
  currentStats: Statistics,
  record: GameRecord
): Statistics {
  const updated = { ...currentStats };
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
}

/**
 * Calculate win rate percentage
 */
export function calculateWinRate(stats: Statistics): number {
  if (stats.totalGames === 0) return 0;
  return (stats.wins / stats.totalGames) * 100;
}

/**
 * Calculate net profit
 */
export function calculateNetProfit(stats: Statistics): number {
  return stats.totalWon - stats.totalLost;
}

/**
 * Calculate blackjack rate
 */
export function calculateBlackjackRate(stats: Statistics): number {
  if (stats.totalGames === 0) return 0;
  return (stats.blackjacks / stats.totalGames) * 100;
}

/**
 * Calculate push rate
 */
export function calculatePushRate(stats: Statistics): number {
  if (stats.totalGames === 0) return 0;
  return (stats.pushes / stats.totalGames) * 100;
}

/**
 * Get statistics summary
 */
export interface StatisticsSummary {
  winRate: number;
  lossRate: number;
  pushRate: number;
  blackjackRate: number;
  netProfit: number;
  averageBet: number;
}

export function getStatisticsSummary(stats: Statistics): StatisticsSummary {
  const totalGames = stats.totalGames;
  
  return {
    winRate: totalGames > 0 ? (stats.wins / totalGames) * 100 : 0,
    lossRate: totalGames > 0 ? (stats.losses / totalGames) * 100 : 0,
    pushRate: totalGames > 0 ? (stats.pushes / totalGames) * 100 : 0,
    blackjackRate: totalGames > 0 ? (stats.blackjacks / totalGames) * 100 : 0,
    netProfit: stats.totalWon - stats.totalLost,
    averageBet: totalGames > 0 ? stats.totalWagered / totalGames : 0,
  };
}
