/**
 * Card Reveal Logic
 * 
 * Pure functions that handle marking cards as revealed.
 * Used for animation coordination.
 */

import { Box, Card, Hand } from '../../models';

// ============================================================================
// Types
// ============================================================================

export interface CardRevealResult {
  found: boolean;
  dealerHand?: Hand;
  boxes?: Box[];
}

// ============================================================================
// Card Reveal Functions
// ============================================================================

/**
 * Mark a specific card as revealed in the dealer's hand
 */
export function revealDealerCard(dealerHand: Hand, cardId: string): Hand | null {
  const cardIndex = dealerHand.cards.findIndex((c) => c.id === cardId);
  
  if (cardIndex < 0) return null;

  const updatedCards = [...dealerHand.cards];
  updatedCards[cardIndex] = {
    ...updatedCards[cardIndex],
    isRevealed: true,
    animationState: 'dealt',
  };

  return { ...dealerHand, cards: updatedCards };
}

/**
 * Mark a specific card as revealed in player boxes
 */
export function revealPlayerCard(boxes: Box[], cardId: string): Box[] | null {
  let found = false;

  const updatedBoxes = boxes.map((box) => {
    if (!box.isActive || found) return box;

    const hands = box.hands.map((hand) => {
      const cardIndex = hand.cards.findIndex((c) => c.id === cardId);
      if (cardIndex >= 0) {
        found = true;
        const updatedCards = [...hand.cards];
        updatedCards[cardIndex] = {
          ...updatedCards[cardIndex],
          isRevealed: true,
          animationState: 'dealt',
        };
        return { ...hand, cards: updatedCards };
      }
      return hand;
    });

    return { ...box, hands };
  });

  return found ? updatedBoxes : null;
}

/**
 * Reveal all cards in a hand
 */
export function revealAllCardsInHand(hand: Hand): Hand {
  const cards = hand.cards.map((c) => ({
    ...c,
    isRevealed: c.faceUp,
    animationState: 'dealt' as const,
  }));

  return { ...hand, cards };
}

/**
 * Reveal all cards in all boxes
 */
export function revealAllPlayerCards(boxes: Box[]): Box[] {
  return boxes.map((box) => {
    if (!box.isActive) return box;

    const hands = box.hands.map((hand) => ({
      ...hand,
      cards: hand.cards.map((c) => ({
        ...c,
        isRevealed: c.faceUp,
        animationState: 'dealt' as const,
      })),
    }));

    return { ...box, hands };
  });
}
