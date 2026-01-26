/**
 * Shared models and type re-exports for the Black Jack Trainer application.
 * Types are defined in their respective services and re-exported here for convenience.
 */

// Re-export types from card.service
export type { Suit, Rank, BoxPosition, CardAnimationState, Card, Hand, Box } from '../services/card.service';

// Re-export types from game.service
export type { GamePhase, GameResult, ShoeState, GameState } from '../services/game.service';

/**
 * Available chip denominations for betting
 */
export const CHIP_DENOMINATIONS = [5, 10, 25, 50, 100] as const;
export type ChipDenomination = typeof CHIP_DENOMINATIONS[number];

/**
 * Game action types for the controls component
 */
export type GameAction = 
  | 'hit' 
  | 'stand' 
  | 'double' 
  | 'split' 
  | 'insurance-yes' 
  | 'insurance-no' 
  | 'deal' 
  | 'new-game';

/**
 * Hand result display text mapping
 */
export const RESULT_TEXT: Record<string, string> = {
  win: 'Win',
  blackjack: 'BJ!',
  lose: 'Lose',
  push: 'Push',
};

/**
 * Suit symbol mapping
 */
export const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};
