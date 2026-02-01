/**
 * Game Actions
 * 
 * Pure functions that implement player actions (hit, stand, double, split).
 * These functions are stateless and return state changes without side effects.
 */

import { Box, Card, Hand, ShoeState, createEmptyHand } from '../../models';
import { dealCardFromShoe } from '../shoe.feature';
import { calculateHandValue, canSplit as canSplitCards, isBusted } from '../../utils/card.utils';
import {
  CARD_DEAL_DURATION,
  ANIMATION_BUFFER,
} from '../../../shared/animation.config';

const SPLIT_DELAY_MS = 300;
const DEAL_DELAY_MS = CARD_DEAL_DURATION + ANIMATION_BUFFER;

// ============================================================================
// Action Result Types
// ============================================================================

export interface HitResult {
  shoe: Card[];
  shoeState: ShoeState;
  boxes: Box[];
  isBusted: boolean;
  message: string;
}

export interface StandResult {
  boxes: Box[];
  moveToNext: boolean;
}

export interface DoubleDownResult {
  shoe: Card[];
  shoeState: ShoeState;
  boxes: Box[];
  additionalBet: number;
  message: string;
}

export interface SplitResult {
  shoe: Card[];
  shoeState: ShoeState;
  boxes: Box[];
  additionalBet: number;
  message: string;
}

// ============================================================================
// Action Validation
// ============================================================================

export interface ActionValidation {
  canHit: boolean;
  canStand: boolean;
  canDoubleDown: boolean;
  canSplit: boolean;
}

export function validateActions(
  phase: string,
  activeHand: Hand | null,
  balance: number,
  settings: {
    doubleDownAllowed: boolean;
    splitAllowed: boolean;
  }
): ActionValidation {
  const isPlaying = phase === 'playing';
  
  const canHit = isPlaying && activeHand !== null && !activeHand.isStanding && !activeHand.isBusted;
  const canStand = isPlaying;
  
  const canDoubleDown = 
    isPlaying &&
    settings.doubleDownAllowed &&
    activeHand !== null &&
    activeHand.cards.length === 2 &&
    balance >= activeHand.bet;
  
  const canSplit =
    isPlaying &&
    settings.splitAllowed &&
    activeHand !== null &&
    activeHand.cards.length === 2 &&
    canSplitCards(activeHand.cards) &&
    balance >= activeHand.bet;

  return { canHit, canStand, canDoubleDown, canSplit };
}

// ============================================================================
// Action Implementations
// ============================================================================

/**
 * Execute a hit action
 */
export function executeHit(
  shoe: Card[],
  shoeState: ShoeState,
  boxes: Box[],
  activeBoxIndex: number
): HitResult {
  const box = boxes[activeBoxIndex];
  const activeHandIndex = box.activeHandIndex;
  const hand = box.hands[activeHandIndex];

  const result = dealCardFromShoe([...shoe], { ...shoeState });
  const newCard = result.card;

  const updatedHand: Hand = {
    ...hand,
    cards: [...hand.cards, newCard],
  };

  const handIsBusted = isBusted(updatedHand.cards);
  if (handIsBusted) {
    updatedHand.isBusted = true;
    updatedHand.result = 'lose';
  }

  // Update boxes immutably
  const updatedBoxes = boxes.map((b, idx) => {
    if (idx !== activeBoxIndex) return b;
    const hands = [...b.hands];
    hands[activeHandIndex] = updatedHand;
    return { ...b, hands };
  });

  return {
    shoe: result.shoe,
    shoeState: result.shoeState,
    boxes: updatedBoxes,
    isBusted: handIsBusted,
    message: handIsBusted ? 'Busted!' : 'Your turn',
  };
}

/**
 * Execute a stand action
 */
export function executeStand(boxes: Box[], activeBoxIndex: number): StandResult {
  const box = boxes[activeBoxIndex];
  const activeHandIndex = box.activeHandIndex;

  const updatedBoxes = boxes.map((b, idx) => {
    if (idx !== activeBoxIndex) return b;
    const hands = [...b.hands];
    hands[activeHandIndex] = { ...hands[activeHandIndex], isStanding: true };
    return { ...b, hands };
  });

  return {
    boxes: updatedBoxes,
    moveToNext: true,
  };
}

/**
 * Execute a double down action
 */
export function executeDoubleDown(
  shoe: Card[],
  shoeState: ShoeState,
  boxes: Box[],
  activeBoxIndex: number
): DoubleDownResult {
  const box = boxes[activeBoxIndex];
  const activeHandIndex = box.activeHandIndex;
  const hand = box.hands[activeHandIndex];

  const result = dealCardFromShoe([...shoe], { ...shoeState });
  // Card is dealt face down (sealed)
  const sealedCard: Card = { ...result.card, faceUp: false };

  const updatedHand: Hand = {
    ...hand,
    bet: hand.bet * 2,
    isDoubledDown: true,
    isStanding: true,
    cards: [...hand.cards, sealedCard],
  };

  const updatedBoxes = boxes.map((b, idx) => {
    if (idx !== activeBoxIndex) return b;
    const hands = [...b.hands];
    hands[activeHandIndex] = updatedHand;
    return { ...b, hands };
  });

  return {
    shoe: result.shoe,
    shoeState: result.shoeState,
    boxes: updatedBoxes,
    additionalBet: hand.bet, // Original bet amount is deducted
    message: 'Doubled down',
  };
}

/**
 * Execute a split action
 */
export function executeSplit(
  shoe: Card[],
  shoeState: ShoeState,
  boxes: Box[],
  activeBoxIndex: number
): SplitResult {
  const box = boxes[activeBoxIndex];
  const activeHandIndex = box.activeHandIndex;
  const currentHand = box.hands[activeHandIndex];

  let currentShoe = [...shoe];
  let currentShoeState = { ...shoeState };

  // Create first split hand
  const hand1 = createEmptyHand(currentHand.bet);
  const splitCard1: Card = {
    ...currentHand.cards[0],
    animationState: 'split-left',
    animationDelay: 0,
  };
  
  let dealResult = dealCardFromShoe(currentShoe, currentShoeState, SPLIT_DELAY_MS + DEAL_DELAY_MS);
  currentShoe = dealResult.shoe;
  currentShoeState = dealResult.shoeState;
  
  hand1.cards = [splitCard1, dealResult.card];
  hand1.isSplit = true;

  // Create second split hand
  const hand2 = createEmptyHand(currentHand.bet);
  const splitCard2: Card = {
    ...currentHand.cards[1],
    animationState: 'split-right',
    animationDelay: 0,
  };
  
  dealResult = dealCardFromShoe(currentShoe, currentShoeState, SPLIT_DELAY_MS + DEAL_DELAY_MS * 2);
  currentShoe = dealResult.shoe;
  currentShoeState = dealResult.shoeState;
  
  hand2.cards = [splitCard2, dealResult.card];
  hand2.isSplit = true;

  // Update the box with split hands
  const updatedBoxes = boxes.map((b, idx) => {
    if (idx !== activeBoxIndex) return b;
    const hands = [...b.hands];
    hands.splice(activeHandIndex, 1, hand1, hand2);
    return { ...b, hands };
  });

  return {
    shoe: currentShoe,
    shoeState: currentShoeState,
    boxes: updatedBoxes,
    additionalBet: currentHand.bet,
    message: 'Split! Playing first hand.',
  };
}
