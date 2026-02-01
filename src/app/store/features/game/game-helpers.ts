/**
 * Game Helper Functions
 *
 * Pure utility functions for game state manipulation.
 * These are stateless and easily testable.
 */

import {
  Box,
  Hand,
  GameResult,
  createEmptyHand,
} from '../../models';
import { calculateHandValue, isBusted, isBlackjack } from '../../utils/card.utils';

/**
 * Format a money result for display
 */
export function formatMoneyResult(netResult: number): string {
  if (netResult > 0) {
    return `+$${netResult.toFixed(2)}`;
  } else if (netResult < 0) {
    return `-$${Math.abs(netResult).toFixed(2)}`;
  } else {
    return '$0.00';
  }
}

/**
 * Find the first active box index that hasn't been resolved
 */
export function findFirstPlayableBoxIndex(boxes: Box[]): number {
  return boxes.findIndex((b) => b.isActive && !b.isResolved);
}

/**
 * Find the next insurance box index starting from currentIndex
 */
export function findNextInsuranceBoxIndex(
  boxes: Box[],
  currentIndex: number,
  balance: number
): { nextIndex: number; updatedBoxes: Box[] } {
  const updatedBoxes = [...boxes];
  let nextIndex = -1;

  for (let i = currentIndex + 1; i < boxes.length; i++) {
    const box = boxes[i];
    if (box.isActive && box.insuranceBet === 0 && !box.insuranceDeclined) {
      if (balance >= box.bet / 2) {
        nextIndex = i;
        break;
      } else {
        updatedBoxes[i] = { ...box, insuranceDeclined: true };
      }
    }
  }

  return { nextIndex, updatedBoxes };
}

/**
 * Check if all active boxes have busted
 */
export function allBoxesBusted(boxes: Box[]): boolean {
  return boxes
    .filter((b) => b.isActive)
    .every((b) => b.hands.every((h) => h.isBusted));
}

/**
 * Update a specific hand within a box
 */
export function updateHandInBox(
  boxes: Box[],
  boxIndex: number,
  handIndex: number,
  handUpdater: (hand: Hand) => Hand
): Box[] {
  const updatedBoxes = [...boxes];
  const box = { ...boxes[boxIndex] };
  const hands = [...box.hands];
  hands[handIndex] = handUpdater(hands[handIndex]);
  box.hands = hands;
  updatedBoxes[boxIndex] = box;
  return updatedBoxes;
}

/**
 * Mark a box as resolved
 */
export function markBoxResolved(boxes: Box[], boxIndex: number): Box[] {
  const updatedBoxes = [...boxes];
  updatedBoxes[boxIndex] = { ...boxes[boxIndex], isResolved: true };
  return updatedBoxes;
}

/**
 * Find the next active box that hasn't been resolved
 */
export function findNextActiveBoxIndex(boxes: Box[], currentIndex: number): number {
  for (let i = currentIndex + 1; i < boxes.length; i++) {
    if (boxes[i].isActive && !boxes[i].isResolved) {
      return i;
    }
  }
  return -1;
}

/**
 * Compare player hands against dealer and calculate winnings
 */
export interface CompareHandsResult {
  boxes: Box[];
  totalWinnings: number;
  wins: number;
  losses: number;
  gameResult: GameResult;
}

export function compareAllHands(
  boxes: Box[],
  dealerBusted: boolean,
  dealerValue: number
): CompareHandsResult {
  let totalWinnings = 0;
  let wins = 0;
  let losses = 0;

  const updatedBoxes = boxes.map((box) => {
    if (!box.isActive) return box;

    const hands = box.hands.map((hand) => {
      // Reveal any sealed (face-down) cards from double down
      let updatedHand = { ...hand };
      const hasHiddenCard = hand.cards.some((c) => !c.faceUp);
      
      if (hasHiddenCard) {
        updatedHand.cards = hand.cards.map((c) => ({ ...c, faceUp: true }));
        // Now check if busted
        if (isBusted(updatedHand.cards)) {
          updatedHand.isBusted = true;
          updatedHand.result = 'lose';
          losses++;
          return updatedHand;
        }
      }

      if (updatedHand.isBusted || updatedHand.result) return updatedHand;

      const playerValue = calculateHandValue(updatedHand.cards).value;

      if (dealerBusted) {
        totalWinnings += hand.bet * 2;
        updatedHand.result = 'win';
        wins++;
      } else if (playerValue > dealerValue) {
        totalWinnings += hand.bet * 2;
        updatedHand.result = 'win';
        wins++;
      } else if (playerValue === dealerValue) {
        totalWinnings += hand.bet;
        updatedHand.result = 'push';
      } else {
        updatedHand.result = 'lose';
        losses++;
      }

      return updatedHand;
    });

    return { ...box, hands };
  });

  const gameResult: GameResult = wins > losses ? 'win' : wins < losses ? 'lose' : 'push';

  return {
    boxes: updatedBoxes,
    totalWinnings,
    wins,
    losses,
    gameResult,
  };
}

/**
 * Process initial blackjacks for all boxes
 */
export interface BlackjackCheckResult {
  boxes: Box[];
  totalPayout: number;
  allResolved: boolean;
  dealerHasBlackjack: boolean;
}

export function processInitialBlackjacks(
  boxes: Box[],
  dealerCards: import('../../models').Card[],
  blackjackPays: number,
  currentBalance: number
): BlackjackCheckResult {
  const dealerHasBlackjack = isBlackjack(dealerCards);
  
  // Calculate insurance payouts first
  let totalPayout = 0;
  if (dealerHasBlackjack) {
    boxes.forEach((box) => {
      if (box.isActive && box.insuranceBet > 0) {
        totalPayout += box.insuranceBet * 3;
      }
    });
  }

  let allResolved = true;
  const updatedBoxes = boxes.map((box) => {
    if (!box.isActive) return box;

    const hand = box.hands[0];
    const playerHasBlackjack = isBlackjack(hand.cards);

    if (playerHasBlackjack) {
      if (dealerHasBlackjack) {
        totalPayout += hand.bet;
        return { ...box, hands: [{ ...hand, result: 'push' as const }], isResolved: true };
      } else {
        const winnings = hand.bet + hand.bet * blackjackPays;
        totalPayout += winnings;
        return {
          ...box,
          hands: [{ ...hand, result: 'blackjack' as const }],
          isResolved: true,
        };
      }
    } else if (dealerHasBlackjack) {
      return { ...box, hands: [{ ...hand, result: 'lose' as const }], isResolved: true };
    }

    allResolved = false;
    return box;
  });

  return {
    boxes: updatedBoxes,
    totalPayout,
    allResolved: dealerHasBlackjack || allResolved,
    dealerHasBlackjack,
  };
}

/**
 * Create split hands from current hand
 */
export interface SplitHandsResult {
  hand1: Hand;
  hand2: Hand;
}

export function createSplitHands(currentHand: Hand): SplitHandsResult {
  const hand1 = createEmptyHand(currentHand.bet);
  hand1.isSplit = true;
  
  const hand2 = createEmptyHand(currentHand.bet);
  hand2.isSplit = true;

  return { hand1, hand2 };
}
