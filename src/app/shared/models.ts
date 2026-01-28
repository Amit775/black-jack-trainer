/**
 * Shared models and types for the Black Jack Trainer application.
 * This is the single source of truth for all game-related types.
 */

// ============================================================================
// Constants (used to derive types)
// ============================================================================

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const BOX_POSITIONS = ['left', 'center', 'right'] as const;
export const CHIP_DENOMINATIONS = [5, 10, 25, 50, 100] as const;

// ============================================================================
// Card Types (derived from constants)
// ============================================================================

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type BoxPosition = (typeof BOX_POSITIONS)[number];
export type ChipDenomination = (typeof CHIP_DENOMINATIONS)[number];

export type CardAnimationState =
  | 'none'
  | 'entering' // Card is animating in from the shoe
  | 'dealt' // Card has finished entering and is in place
  | 'revealing' // Face-down card is flipping to show face
  | 'revealed' // Card has finished revealing
  | 'split-left' // Card is animating to left split position
  | 'split-right' // Card is animating to right split position
  | 'exiting'; // Card is leaving (end of hand)

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
  /** Current animation state */
  animationState: CardAnimationState;
  /** Delay before animation starts (ms) */
  animationDelay: number;
  /** Whether the card's value should be included in hand calculation */
  isRevealed: boolean;
  /** Stagger index for enter animation timing */
  dealIndex?: number;
}

// ============================================================================
// Hand Types
// ============================================================================

export type HandResult = 'win' | 'lose' | 'push' | 'blackjack';

export interface Hand {
  cards: Card[];
  bet: number;
  isDoubledDown: boolean;
  isSplit: boolean;
  isStanding: boolean;
  isBusted: boolean;
  result?: HandResult;
}

// ============================================================================
// Box Types
// ============================================================================

export interface Box {
  position: BoxPosition;
  hands: Hand[];
  activeHandIndex: number;
  bet: number;
  isActive: boolean;
  isResolved: boolean;
  insuranceBet: number;
  insuranceDeclined: boolean;
}

// ============================================================================
// Game State Types
// ============================================================================

export type GamePhase =
  | 'betting'
  | 'dealing'
  | 'insurance'
  | 'playing'
  | 'dealer-turn'
  | 'resolved';
export type GameResult = HandResult | null;

export interface ShoeState {
  totalCards: number;
  cardsDealt: number;
  cutCardPosition: number;
  shuffleNeeded: boolean;
  cutCardReached: boolean;
}

export interface GameSettings {
  numberOfDecks: number;
  dealerHitsSoft17: boolean;
  blackjackPays: number;
  doubleDownAllowed: boolean;
  splitAllowed: boolean;
  insuranceAllowed: boolean;
  surrenderAllowed: boolean;
}

// ============================================================================
// Game Action Types
// ============================================================================

export type GameAction =
  | 'hit'
  | 'stand'
  | 'double'
  | 'split'
  | 'insurance-yes'
  | 'insurance-no'
  | 'deal'
  | 'new-game';

// ============================================================================
// Display Constants
// ============================================================================

export const RESULT_TEXT: Record<HandResult, string> = {
  win: 'Win',
  blackjack: 'BJ!',
  lose: 'Lose',
  push: 'Push',
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

// ============================================================================
// Initial Values / Factory Functions
// ============================================================================

export const DEFAULT_SETTINGS: GameSettings = {
  numberOfDecks: 6,
  dealerHitsSoft17: true,
  blackjackPays: 1.5,
  doubleDownAllowed: true,
  splitAllowed: true,
  insuranceAllowed: true,
  surrenderAllowed: false,
};

export const INITIAL_SHOE_STATE: ShoeState = {
  totalCards: 0,
  cardsDealt: 0,
  cutCardPosition: 0,
  shuffleNeeded: false,
  cutCardReached: false,
};

export const createEmptyHand = (bet: number = 0): Hand => ({
  cards: [],
  bet,
  isDoubledDown: false,
  isSplit: false,
  isStanding: false,
  isBusted: false,
});

export const createInitialBoxes = (): Box[] => [
  createEmptyBox('left'),
  {
    ...createEmptyBox('center'),
    isActive: true,
  },
  createEmptyBox('right'),
];

export const createEmptyBox = (position: BoxPosition, bet: number = 0): Box => ({
  position,
  hands: [],
  activeHandIndex: 0,
  bet,
  isActive: false,
  isResolved: false,
  insuranceBet: 0,
  insuranceDeclined: false,
});

// ============================================================================
// Store State Slices (for NgRx Signal Store)
// ============================================================================

export interface BalanceState {
  balance: number;
}

export interface SettingsState {
  settings: GameSettings;
}

export interface ShoeSliceState {
  shoe: Card[];
  shoeState: ShoeState;
  discardTray: Card[];
}

export interface GameSliceState {
  boxes: Box[];
  activeBoxIndex: number;
  insuranceBoxIndex: number;
  dealerHand: Hand;
  phase: GamePhase;
  result: GameResult;
  message: string;
}

export interface BlackjackStoreState
  extends BalanceState, SettingsState, ShoeSliceState, GameSliceState {}
