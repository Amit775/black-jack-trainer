/**
 * Dealing Logic
 * 
 * Pure functions that handle the initial dealing of cards.
 * Separated for testability and single responsibility.
 */

import { Box, Card, Hand, ShoeState, GamePhase, createEmptyHand } from '../../models';
import { dealCardFromShoe, dealFaceDownCard } from '../shoe.feature';
import { createShoe } from '../../utils/card.utils';

// ============================================================================
// Types
// ============================================================================

export interface DealSequenceItem {
  type: 'player' | 'dealer';
  boxIndex?: number;
  faceDown?: boolean;
}

export interface InitialDealSetup {
  shoe: Card[];
  shoeState: ShoeState;
  boxes: Box[];
  dealerHand: Hand;
  dealSequence: DealSequenceItem[];
}

export interface DealCardToPlayerResult {
  shoe: Card[];
  shoeState: ShoeState;
  boxes: Box[];
}

export interface DealCardToDealerResult {
  shoe: Card[];
  shoeState: ShoeState;
  dealerHand: Hand;
}

// ============================================================================
// Deal Setup Functions
// ============================================================================

/**
 * Prepare the initial deal setup - initialize boxes and create deal sequence
 */
export function prepareInitialDeal(
  shoe: Card[],
  shoeState: ShoeState,
  boxes: Box[],
  numberOfDecks: number
): InitialDealSetup {
  let currentShoe = [...shoe];
  let currentShoeState = { ...shoeState };

  // Reshuffle if needed
  if (currentShoe.length < 52) {
    currentShoe = createShoe(numberOfDecks);
    currentShoeState = {
      totalCards: currentShoe.length,
      cardsDealt: 0,
      cutCardPosition: currentShoeState.cutCardPosition,
      shuffleNeeded: false,
      cutCardReached: false,
    };
  }

  currentShoeState = { ...currentShoeState, cutCardReached: false };

  // Get active box indices
  const activeBoxIndices = boxes
    .map((box, index) => ({ box, index }))
    .filter(({ box }) => box.isActive)
    .map(({ index }) => index);

  // Initialize boxes with empty hands
  const initializedBoxes = boxes.map((box) => {
    if (!box.isActive) return box;
    const hand = createEmptyHand(box.bet);
    return { ...box, hands: [hand], activeHandIndex: 0, isResolved: false };
  });

  // Build the deal sequence
  const dealSequence: DealSequenceItem[] = [];

  // First round: one card to each player, then dealer
  for (const boxIndex of activeBoxIndices) {
    dealSequence.push({ type: 'player', boxIndex });
  }
  dealSequence.push({ type: 'dealer', faceDown: false });

  // Second round: one card to each player, then dealer (face down)
  for (const boxIndex of activeBoxIndices) {
    dealSequence.push({ type: 'player', boxIndex });
  }
  dealSequence.push({ type: 'dealer', faceDown: true });

  return {
    shoe: currentShoe,
    shoeState: currentShoeState,
    boxes: initializedBoxes,
    dealerHand: createEmptyHand(),
    dealSequence,
  };
}

/**
 * Deal a single card to a player box
 */
export function dealCardToPlayer(
  shoe: Card[],
  shoeState: ShoeState,
  boxes: Box[],
  boxIndex: number,
  dealIndex: number
): DealCardToPlayerResult {
  const result = dealCardFromShoe([...shoe], { ...shoeState }, 0, dealIndex);
  const card = { ...result.card, isRevealed: true };

  const updatedBoxes = boxes.map((box, idx) => {
    if (idx !== boxIndex) return box;
    const hand = { ...box.hands[0] };
    hand.cards = [...hand.cards, card];
    return { ...box, hands: [hand] };
  });

  return {
    shoe: result.shoe,
    shoeState: result.shoeState,
    boxes: updatedBoxes,
  };
}

/**
 * Deal a single card to the dealer
 */
export function dealCardToDealer(
  shoe: Card[],
  shoeState: ShoeState,
  dealerHand: Hand,
  faceDown: boolean,
  dealIndex: number
): DealCardToDealerResult {
  const result = faceDown
    ? dealFaceDownCard([...shoe], { ...shoeState }, 0, dealIndex)
    : dealCardFromShoe([...shoe], { ...shoeState }, 0, dealIndex);

  const card = { ...result.card, isRevealed: !faceDown };

  return {
    shoe: result.shoe,
    shoeState: result.shoeState,
    dealerHand: {
      ...dealerHand,
      cards: [...dealerHand.cards, card],
    },
  };
}

/**
 * Determine the next phase after initial deal completes
 */
export interface PostDealPhaseResult {
  phase: GamePhase;
  activeBoxIndex: number;
  insuranceBoxIndex: number;
  message: string;
  shouldCheckBlackjacks: boolean;
}

export function determinePostDealPhase(
  boxes: Box[],
  dealerHand: Hand,
  balance: number,
  insuranceAllowed: boolean
): PostDealPhaseResult {
  const firstActiveIndex = boxes.findIndex((b) => b.isActive);
  const dealerCard1 = dealerHand.cards[0];
  const dealerShowsAce = dealerCard1?.rank === 'A';
  const anyBoxCanAffordInsurance = boxes.some(
    (box) => box.isActive && balance >= box.bet / 2
  );

  if (dealerShowsAce && insuranceAllowed && anyBoxCanAffordInsurance) {
    const firstInsuranceBoxIndex = boxes.findIndex((b) => b.isActive);
    const firstBox = boxes[firstInsuranceBoxIndex];

    return {
      phase: 'insurance',
      activeBoxIndex: firstActiveIndex,
      insuranceBoxIndex: firstInsuranceBoxIndex,
      message: `Insurance for box ${firstInsuranceBoxIndex + 1}? (Cost: $${(firstBox.bet / 2).toFixed(2)})`,
      shouldCheckBlackjacks: false,
    };
  }

  return {
    phase: 'playing',
    activeBoxIndex: firstActiveIndex,
    insuranceBoxIndex: -1,
    message: 'Your turn',
    shouldCheckBlackjacks: true,
  };
}
