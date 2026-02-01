/**
 * Dealer Logic
 * 
 * Pure functions that handle dealer turn mechanics.
 * Separated for testability and single responsibility.
 */

import { Card, Hand, ShoeState } from '../../models';
import { dealCardFromShoe } from '../shoe.feature';
import { calculateHandValue } from '../../utils/card.utils';

// ============================================================================
// Types
// ============================================================================

export interface DealerTurnResult {
  dealerHand: Hand;
  needsMoreCards: boolean;
  finalValue: number;
  isBusted: boolean;
}

export interface DealerHitResult {
  shoe: Card[];
  shoeState: ShoeState;
  dealerHand: Hand;
  needsMoreCards: boolean;
  isBusted: boolean;
}

// ============================================================================
// Dealer Logic Functions
// ============================================================================

/**
 * Prepare dealer's hand for their turn - reveal hole card
 */
export function prepareDealerTurn(dealerHand: Hand): Hand {
  const cards = dealerHand.cards.map((c, index) => {
    if (index === 0) {
      return { ...c, isRevealed: true };
    }
    if (index === 1 && !c.faceUp) {
      return {
        ...c,
        faceUp: true,
        animationState: 'revealing' as const,
        animationDelay: 0,
        isRevealed: false,
      };
    }
    return { ...c, faceUp: true };
  });

  return { ...dealerHand, cards };
}

/**
 * Mark hole card as revealed after animation
 */
export function markHoleCardRevealed(dealerHand: Hand): Hand {
  const cards = dealerHand.cards.map((c, index) =>
    index === 1 ? { ...c, animationState: 'dealt' as const, isRevealed: true } : c
  );

  return { ...dealerHand, cards };
}

/**
 * Check if dealer needs to hit based on their hand value
 */
export function shouldDealerHit(
  dealerHand: Hand,
  dealerHitsSoft17: boolean
): boolean {
  const handValue = calculateHandValue(dealerHand.cards);

  return (
    handValue.value < 17 ||
    (handValue.value === 17 && handValue.isSoft && dealerHitsSoft17)
  );
}

/**
 * Execute a dealer hit
 */
export function executeDealerHit(
  shoe: Card[],
  shoeState: ShoeState,
  dealerHand: Hand
): DealerHitResult {
  const result = dealCardFromShoe([...shoe], { ...shoeState }, 0);
  const newCard: Card = { ...result.card, isRevealed: false };

  const updatedHand: Hand = {
    ...dealerHand,
    cards: [...dealerHand.cards, newCard],
  };

  const handValue = calculateHandValue(updatedHand.cards);
  const isBusted = handValue.value > 21;

  return {
    shoe: result.shoe,
    shoeState: result.shoeState,
    dealerHand: updatedHand,
    needsMoreCards: !isBusted && handValue.value < 17,
    isBusted,
  };
}

/**
 * Mark the last card in dealer's hand as revealed (after animation)
 */
export function markLastDealerCardRevealed(dealerHand: Hand): Hand {
  const cards = dealerHand.cards.map((c, index) =>
    index === dealerHand.cards.length - 1
      ? { ...c, animationState: 'dealt' as const, isRevealed: true }
      : c
  );

  return { ...dealerHand, cards };
}

/**
 * Reveal all dealer cards (for final display)
 */
export function revealAllDealerCards(dealerHand: Hand): Hand {
  const cards = dealerHand.cards.map((c) => ({ ...c, faceUp: true }));
  return { ...dealerHand, cards };
}

/**
 * Get the current dealer hand value (only revealed cards)
 */
export function getDealerHandValue(dealerHand: Hand): number {
  const revealedCards = dealerHand.cards.filter((c) => c.isRevealed);
  if (revealedCards.length === 0) return 0;
  return calculateHandValue(revealedCards).value;
}

/**
 * Get visible dealer value (face-up cards only)
 */
export function getVisibleDealerValue(dealerHand: Hand): number {
  const visibleCards = dealerHand.cards.filter((c) => c.faceUp);
  if (visibleCards.length === 0) return 0;
  return calculateHandValue(visibleCards).value;
}
