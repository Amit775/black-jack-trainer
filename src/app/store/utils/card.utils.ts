import {
  Card,
  Suit,
  Box,
  BoxPosition,
  SUITS,
  RANKS,
  SUIT_SYMBOLS,
  createEmptyHand,
  createEmptyBox,
} from '../../shared/models';

// ============================================================================
// Card ID Generation
// ============================================================================

let cardIdCounter = 0;

export function generateCardId(): string {
  return `card-${++cardIdCounter}-${Date.now()}`;
}

// ============================================================================
// Deck & Shoe Creation
// ============================================================================

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: generateCardId(),
        suit,
        rank,
        faceUp: true,
        animationState: 'none',
        animationDelay: 0,
        isRevealed: true,
      });
    }
  }
  return deck;
}

export function createShoe(numberOfDecks: number): Card[] {
  const shoe: Card[] = [];
  for (let i = 0; i < numberOfDecks; i++) {
    shoe.push(...createDeck());
  }
  return shuffle(shoe);
}

export function shuffle(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================================
// Card Value Calculations
// ============================================================================

export function getCardValue(card: Card): number[] {
  if (card.rank === 'A') {
    return [1, 11];
  }
  if (['J', 'Q', 'K'].includes(card.rank)) {
    return [10];
  }
  return [parseInt(card.rank, 10)];
}

export function calculateHandValue(cards: Card[]): { value: number; isSoft: boolean } {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    // Count all face-up cards (isRevealed is for animation tracking, faceUp is the actual visibility)
    if (!card.faceUp) continue;

    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank, 10);
    }
  }

  // Convert aces from 11 to 1 as needed
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return {
    value,
    isSoft: aces > 0 && value <= 21,
  };
}

// ============================================================================
// Hand Evaluation
// ============================================================================

export function isBlackjack(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const { value } = calculateHandValue(cards);
  return value === 21;
}

export function isBusted(cards: Card[]): boolean {
  return calculateHandValue(cards).value > 21;
}

export function canSplit(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return getCardValue(cards[0])[0] === getCardValue(cards[1])[0];
}

// ============================================================================
// Display Utilities
// ============================================================================

export function getCardDisplay(card: Card): string {
  if (!card.faceUp) return '🂠';
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function getSuitColor(suit: Suit): 'red' | 'black' {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
}

// ============================================================================
// Re-exports from models for convenience
// ============================================================================

export { createEmptyHand, createEmptyBox };
