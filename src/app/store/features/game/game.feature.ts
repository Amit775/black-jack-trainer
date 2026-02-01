/**
 * Game Feature - Main NgRx Signal Store Feature
 *
 * This is the orchestrator that composes the smaller, focused modules.
 * It manages state transitions and coordinates between pure functions.
 *
 * Responsibilities:
 * - Compose computed signals for the store
 * - Wire up methods that call pure functions from sub-modules
 * - Handle async operations (setTimeout for animations)
 * - Manage state transitions via patchState
 *
 * The actual logic is delegated to:
 * - game-helpers.ts: State manipulation utilities
 * - game-actions.ts: Player actions (hit, stand, double, split)
 * - dealing-logic.ts: Initial card dealing
 * - dealer-logic.ts: Dealer turn mechanics
 * - card-reveal-logic.ts: Animation handling
 */

import { computed } from '@angular/core';
import {
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
  patchState,
  type,
} from '@ngrx/signals';
import {
  Box,
  Card,
  GamePhase,
  GameResult,
  GameSliceState,
  Hand,
  ShoeState,
  createEmptyHand,
  createInitialBoxes,
  createEmptyBox,
} from '../../models';
import { dealCardFromShoe, dealFaceDownCard } from '../shoe.feature';
import {
  calculateHandValue,
  canSplit as canSplitCards,
  createShoe,
  isBlackjack,
  isBusted,
} from '../../utils/card.utils';
import {
  CARD_DEAL_DURATION,
  CARD_FLIP_DURATION,
  DEALER_HIT_DELAY,
  ANIMATION_BUFFER,
} from '../../../shared/animation.config';

// Import pure functions from sub-modules
import {
  formatMoneyResult,
  findNextActiveBoxIndex,
  compareAllHands,
  processInitialBlackjacks,
  allBoxesBusted,
} from './game-helpers';
import {
  executeHit,
  executeStand,
  executeDoubleDown,
  executeSplit,
} from './game-actions';
import {
  prepareInitialDeal,
  dealCardToPlayer,
  dealCardToDealer,
  determinePostDealPhase,
} from './dealing-logic';
import {
  prepareDealerTurn,
  markHoleCardRevealed,
  shouldDealerHit,
  executeDealerHit,
  markLastDealerCardRevealed,
  revealAllDealerCards,
} from './dealer-logic';
import {
  revealDealerCard,
  revealPlayerCard,
  revealAllCardsInHand,
  revealAllPlayerCards,
} from './card-reveal-logic';

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_GAME_STATE: GameSliceState = {
  boxes: createInitialBoxes(),
  activeBoxIndex: 0,
  insuranceBoxIndex: -1,
  dealerHand: createEmptyHand(),
  phase: 'betting',
  result: null,
  message: 'Place your bets to start',
  roundStartBalance: 0,
};

// ============================================================================
// Animation Timing (derived from config)
// ============================================================================

const DEAL_DELAY_MS = CARD_DEAL_DURATION + ANIMATION_BUFFER;
const HOLE_CARD_REVEAL_MS = CARD_FLIP_DURATION + ANIMATION_BUFFER;
const DEALER_CARD_ANIMATION_MS = CARD_DEAL_DURATION;
const DELAY_BETWEEN_DEALER_CARDS = DEALER_HIT_DELAY;

// ============================================================================
// Game Feature
// ============================================================================

export function withGame() {
  return signalStoreFeature(
    // Require these slices to exist in the store
    {
      state: type<{
        balance: number;
        shoe: Card[];
        shoeState: ShoeState;
        discardTray: Card[];
        settings: {
          numberOfDecks: number;
          dealerHitsSoft17: boolean;
          blackjackPays: number;
          doubleDownAllowed: boolean;
          splitAllowed: boolean;
          insuranceAllowed: boolean;
        };
      }>(),
    },

    withState(INITIAL_GAME_STATE),

    withComputed((store) => {
      // Core computed signals
      const activeBox = computed(() => store.boxes()[store.activeBoxIndex()]);

      const activeHand = computed(() => {
        const box = activeBox();
        if (!box || box.hands.length === 0) return null;
        return box.hands[box.activeHandIndex];
      });

      const insuranceBox = computed(() => {
        const idx = store.insuranceBoxIndex();
        return idx >= 0 ? store.boxes()[idx] : null;
      });

      const activeBoxes = computed(() => store.boxes().filter((b) => b.isActive));

      const playerHands = computed(() => activeBox()?.hands || []);

      // Bet calculations
      const currentBet = computed(() =>
        store.boxes().reduce((total, box) => total + (box.isActive ? box.bet : 0), 0),
      );

      const totalBetsPlaced = computed(() =>
        store.boxes().reduce((total, box) => {
          if (!box.isActive) return total;
          return total + box.hands.reduce((handTotal, hand) => handTotal + hand.bet, 0);
        }, 0),
      );

      // Hand value calculations
      const playerHandValue = computed(() => {
        const hand = activeHand();
        if (!hand || hand.cards.length === 0) return 0;
        return calculateHandValue(hand.cards).value;
      });

      const dealerHandValue = computed(() => {
        const hand = store.dealerHand();
        const phase = store.phase();
        if (!hand || hand.cards.length === 0) return 0;

        if (phase === 'dealer-turn') {
          const revealedCards = hand.cards.filter((c) => c.isRevealed);
          if (revealedCards.length === 0) return 0;
          return calculateHandValue(revealedCards).value;
        }

        const visibleCards = hand.cards.filter((c) => c.faceUp);
        if (visibleCards.length === 0) return 0;
        return calculateHandValue(visibleCards).value;
      });

      const dealerShowsAce = computed(() => {
        const hand = store.dealerHand();
        if (!hand || hand.cards.length === 0) return false;
        return hand.cards[0]?.faceUp && hand.cards[0]?.rank === 'A';
      });

      // Action availability
      const canTakeInsurance = computed(() => {
        if (store.phase() !== 'insurance') return false;
        if (!store.settings().insuranceAllowed) return false;
        const box = insuranceBox();
        if (!box) return false;
        return store.balance() >= box.bet / 2;
      });

      const canHit = computed(() => {
        if (store.phase() !== 'playing') return false;
        const hand = activeHand();
        return hand !== null && !hand.isStanding && !hand.isBusted;
      });

      const canStand = computed(() => store.phase() === 'playing');

      const canDoubleDown = computed(() => {
        if (store.phase() !== 'playing') return false;
        if (!store.settings().doubleDownAllowed) return false;
        const hand = activeHand();
        if (!hand || hand.cards.length !== 2) return false;
        return store.balance() >= hand.bet;
      });

      const canSplit = computed(() => {
        if (store.phase() !== 'playing') return false;
        if (!store.settings().splitAllowed) return false;
        const hand = activeHand();
        if (!hand || hand.cards.length !== 2) return false;
        if (!canSplitCards(hand.cards)) return false;
        return store.balance() >= hand.bet;
      });

      return {
        activeBox,
        activeHand,
        insuranceBox,
        activeBoxes,
        playerHands,
        currentBet,
        totalBetsPlaced,
        playerHandValue,
        dealerHandValue,
        dealerShowsAce,
        canTakeInsurance,
        canHit,
        canStand,
        canDoubleDown,
        canSplit,
      };
    }),

    withMethods((store) => {
      // ========================================================================
      // Internal Navigation Methods
      // ========================================================================

      const moveToNextHand = () => {
        const boxes = store.boxes();
        const box = boxes[store.activeBoxIndex()];
        const nextHandIndex = box.activeHandIndex + 1;

        if (nextHandIndex < box.hands.length) {
          const updatedBoxes = [...boxes];
          updatedBoxes[store.activeBoxIndex()] = { ...box, activeHandIndex: nextHandIndex };
          patchState(store, { boxes: updatedBoxes, message: 'Next hand' });
        } else {
          moveToNextBox();
        }
      };

      const moveToNextBox = () => {
        const boxes = [...store.boxes()];
        boxes[store.activeBoxIndex()] = { ...boxes[store.activeBoxIndex()], isResolved: true };

        const nextBoxIndex = findNextActiveBoxIndex(boxes, store.activeBoxIndex());

        if (nextBoxIndex >= 0) {
          patchState(store, { boxes, activeBoxIndex: nextBoxIndex, message: 'Next box' });
        } else {
          patchState(store, { boxes });
          dealerTurn();
        }
      };

      // ========================================================================
      // Dealer Turn Methods
      // ========================================================================

      const dealerTurn = () => {
        if (allBoxesBusted(store.boxes())) {
          const netResult = store.balance() - store.roundStartBalance();
          resolveGame('lose', formatMoneyResult(netResult));
          return;
        }

        const dealerHand = prepareDealerTurn(store.dealerHand());
        patchState(store, { dealerHand, phase: 'dealer-turn', message: "Dealer's turn" });

        // Animate hole card reveal
        setTimeout(() => {
          const revealed = markHoleCardRevealed(store.dealerHand());
          patchState(store, { dealerHand: revealed });
          setTimeout(() => dealerPlay(), 300);
        }, HOLE_CARD_REVEAL_MS);
      };

      const dealerPlay = () => {
        const needsMore = shouldDealerHit(store.dealerHand(), store.settings().dealerHitsSoft17);

        if (!needsMore) {
          const dealerValue = calculateHandValue(store.dealerHand().cards).value;
          compareHands(dealerValue > 21);
          return;
        }

        const result = executeDealerHit(store.shoe(), store.shoeState(), store.dealerHand());
        patchState(store, {
          shoe: result.shoe,
          shoeState: result.shoeState,
          dealerHand: result.dealerHand,
        });

        // Animate dealer card
        setTimeout(() => {
          const revealed = markLastDealerCardRevealed(store.dealerHand());
          patchState(store, { dealerHand: revealed });
          setTimeout(() => dealerPlay(), DELAY_BETWEEN_DEALER_CARDS - DEALER_CARD_ANIMATION_MS);
        }, DEALER_CARD_ANIMATION_MS);
      };

      const compareHands = (dealerBusted: boolean) => {
        const dealerValue = calculateHandValue(store.dealerHand().cards).value;
        const result = compareAllHands(store.boxes(), dealerBusted, dealerValue);

        const newBalance = store.balance() + result.totalWinnings;
        patchState(store, { balance: newBalance, boxes: result.boxes });

        const netResult = newBalance - store.roundStartBalance();
        resolveGame(result.gameResult, formatMoneyResult(netResult));
      };

      const resolveGame = (result: GameResult, message: string) => {
        const dealerHand = revealAllDealerCards(store.dealerHand());
        patchState(store, { dealerHand, phase: 'resolved', result, message });
      };

      // ========================================================================
      // Insurance Methods
      // ========================================================================

      const moveToNextInsuranceBox = (boxes: Box[], currentIndex: number) => {
        let nextIndex = -1;
        const updatedBoxes = [...boxes];

        for (let i = currentIndex + 1; i < boxes.length; i++) {
          const b = boxes[i];
          if (b.isActive && b.insuranceBet === 0 && !b.insuranceDeclined) {
            if (store.balance() >= b.bet / 2) {
              nextIndex = i;
              break;
            } else {
              updatedBoxes[i] = { ...b, insuranceDeclined: true };
            }
          }
        }

        if (nextIndex >= 0) {
          const nextBox = updatedBoxes[nextIndex];
          patchState(store, {
            boxes: updatedBoxes,
            insuranceBoxIndex: nextIndex,
            message: `Insurance for box ${nextIndex + 1}? (Cost: $${(nextBox.bet / 2).toFixed(2)})`,
          });
        } else {
          patchState(store, {
            boxes: updatedBoxes,
            insuranceBoxIndex: -1,
            phase: 'playing',
            message: 'Your turn',
          });
          checkInitialBlackjacks();
        }
      };

      const checkInitialBlackjacks = () => {
        const dealerCards = [...store.dealerHand().cards];
        dealerCards[1] = { ...dealerCards[1], faceUp: true };

        const result = processInitialBlackjacks(
          store.boxes(),
          dealerCards,
          store.settings().blackjackPays,
          store.balance()
        );

        if (result.totalPayout > 0) {
          patchState(store, { balance: store.balance() + result.totalPayout });
        }

        if (result.allResolved) {
          const netResult = store.balance() - store.roundStartBalance();
          patchState(store, {
            boxes: result.boxes,
            dealerHand: { ...store.dealerHand(), cards: dealerCards },
            phase: 'resolved',
            result: result.dealerHasBlackjack ? 'lose' : 'blackjack',
            message: formatMoneyResult(netResult),
          });
        } else {
          const firstPlayableIndex = result.boxes.findIndex((b) => b.isActive && !b.isResolved);
          patchState(store, {
            boxes: result.boxes,
            activeBoxIndex: firstPlayableIndex >= 0 ? firstPlayableIndex : store.activeBoxIndex(),
          });
        }
      };

      // ========================================================================
      // Initial Deal
      // ========================================================================

      const dealInitialCards = () => {
        const setup = prepareInitialDeal(
          store.shoe(),
          store.shoeState(),
          store.boxes(),
          store.settings().numberOfDecks
        );

        patchState(store, {
          shoe: setup.shoe,
          shoeState: setup.shoeState,
          boxes: setup.boxes,
          dealerHand: setup.dealerHand,
          phase: 'dealing' as GamePhase,
          message: 'Dealing cards...',
        });

        let dealIndex = 0;
        const sequence = setup.dealSequence;

        const dealNextCard = () => {
          if (dealIndex >= sequence.length) {
            finishInitialDeal();
            return;
          }

          const currentDeal = sequence[dealIndex];

          if (currentDeal.type === 'player') {
            const result = dealCardToPlayer(
              store.shoe(),
              store.shoeState(),
              store.boxes(),
              currentDeal.boxIndex!,
              dealIndex
            );
            patchState(store, {
              shoe: result.shoe,
              shoeState: result.shoeState,
              boxes: result.boxes,
            });
          } else {
            const result = dealCardToDealer(
              store.shoe(),
              store.shoeState(),
              store.dealerHand(),
              currentDeal.faceDown!,
              dealIndex
            );
            patchState(store, {
              shoe: result.shoe,
              shoeState: result.shoeState,
              dealerHand: result.dealerHand,
            });
          }

          dealIndex++;
          setTimeout(dealNextCard, DEAL_DELAY_MS);
        };

        setTimeout(dealNextCard, 100);
      };

      const finishInitialDeal = () => {
        const result = determinePostDealPhase(
          store.boxes(),
          store.dealerHand(),
          store.balance(),
          store.settings().insuranceAllowed
        );

        patchState(store, {
          activeBoxIndex: result.activeBoxIndex,
          insuranceBoxIndex: result.insuranceBoxIndex,
          phase: result.phase,
          message: result.message,
        });

        if (result.shouldCheckBlackjacks) {
          checkInitialBlackjacks();
        }
      };

      // ========================================================================
      // Public Methods
      // ========================================================================

      return {
        // Betting Phase
        addBox(): string | null {
          if (store.phase() !== 'betting') return null;

          const newBox = createEmptyBox();
          newBox.isActive = true;
          const boxes = [...store.boxes(), newBox];
          patchState(store, { boxes });
          return newBox.id;
        },

        removeBox(boxId: string): void {
          if (store.phase() !== 'betting') return;

          const boxes = store.boxes();
          const activeCount = boxes.filter((b) => b.isActive).length;
          if (activeCount <= 1) return;

          const boxIndex = boxes.findIndex((b) => b.id === boxId);
          if (boxIndex === -1) return;

          const updatedBoxes = boxes.filter((b) => b.id !== boxId);
          patchState(store, { boxes: updatedBoxes });
        },

        setBoxBet(boxId: string, amount: number): void {
          if (store.phase() !== 'betting') return;
          if (amount < 0) return;

          const box = store.boxes().find((b) => b.id === boxId);
          if (!box || !box.isActive) return;

          const otherBoxesBet = store
            .boxes()
            .filter((b) => b.isActive && b.id !== boxId)
            .reduce((sum, b) => sum + b.bet, 0);

          if (otherBoxesBet + amount > store.balance()) return;

          const boxes = store.boxes().map((b) =>
            b.id === boxId ? { ...b, bet: amount } : b
          );
          patchState(store, { boxes });
        },

        placeBets(): boolean {
          if (store.phase() !== 'betting') return false;

          const activeBoxes = store.boxes().filter((b) => b.isActive);
          const totalBet = activeBoxes.reduce((sum, b) => sum + b.bet, 0);

          if (totalBet <= 0 || totalBet > store.balance()) return false;
          if (activeBoxes.some((b) => b.bet <= 0)) return false;

          patchState(store, {
            roundStartBalance: store.balance(),
            balance: store.balance() - totalBet,
            message: 'Dealing cards...',
          });
          dealInitialCards();
          return true;
        },

        // Insurance Phase
        takeInsurance(): void {
          if (store.phase() !== 'insurance') return;
          if (store.insuranceBoxIndex() < 0) return;

          const box = store.boxes()[store.insuranceBoxIndex()];
          const insuranceAmount = box.bet / 2;
          if (store.balance() < insuranceAmount) return;

          patchState(store, { balance: store.balance() - insuranceAmount });

          const boxes = [...store.boxes()];
          boxes[store.insuranceBoxIndex()] = { ...box, insuranceBet: insuranceAmount };
          moveToNextInsuranceBox(boxes, store.insuranceBoxIndex());
        },

        declineInsurance(): void {
          if (store.phase() !== 'insurance') return;
          if (store.insuranceBoxIndex() < 0) return;

          const box = store.boxes()[store.insuranceBoxIndex()];
          const boxes = [...store.boxes()];
          boxes[store.insuranceBoxIndex()] = { ...box, insuranceDeclined: true };
          moveToNextInsuranceBox(boxes, store.insuranceBoxIndex());
        },

        // Player Actions - delegated to pure functions
        hit(): void {
          if (store.phase() !== 'playing') return;
          const hand = store.activeHand();
          if (!hand || hand.isStanding || hand.isBusted) return;

          const result = executeHit(
            store.shoe(),
            store.shoeState(),
            store.boxes(),
            store.activeBoxIndex()
          );

          patchState(store, {
            shoe: result.shoe,
            shoeState: result.shoeState,
            boxes: result.boxes,
            message: result.message,
          });

          if (result.isBusted) {
            moveToNextHand();
          }
        },

        stand(): void {
          if (store.phase() !== 'playing') return;

          const result = executeStand(store.boxes(), store.activeBoxIndex());
          patchState(store, { boxes: result.boxes });
          moveToNextHand();
        },

        doubleDown(): void {
          if (store.phase() !== 'playing') return;
          if (!store.settings().doubleDownAllowed) return;

          const hand = store.activeHand();
          if (!hand || hand.cards.length !== 2) return;
          if (store.balance() < hand.bet) return;

          const result = executeDoubleDown(
            store.shoe(),
            store.shoeState(),
            store.boxes(),
            store.activeBoxIndex()
          );

          patchState(store, {
            balance: store.balance() - result.additionalBet,
            shoe: result.shoe,
            shoeState: result.shoeState,
            boxes: result.boxes,
            message: result.message,
          });

          moveToNextHand();
        },

        split(): void {
          if (store.phase() !== 'playing') return;
          if (!store.settings().splitAllowed) return;

          const hand = store.activeHand();
          if (!hand || hand.cards.length !== 2) return;
          if (!canSplitCards(hand.cards)) return;
          if (store.balance() < hand.bet) return;

          const result = executeSplit(
            store.shoe(),
            store.shoeState(),
            store.boxes(),
            store.activeBoxIndex()
          );

          patchState(store, {
            balance: store.balance() - result.additionalBet,
            shoe: result.shoe,
            shoeState: result.shoeState,
            boxes: result.boxes,
            message: result.message,
          });
        },

        // Game Lifecycle
        newGame(): void {
          const cardsToDiscard: Card[] = [];
          cardsToDiscard.push(...store.dealerHand().cards);
          store.boxes().forEach((box) => {
            if (box.isActive) {
              box.hands.forEach((hand) => {
                cardsToDiscard.push(...hand.cards);
              });
            }
          });

          let shoe = [...store.shoe()];
          let shoeState = { ...store.shoeState() };
          let discardTray = [
            ...store.discardTray(),
            ...cardsToDiscard.map((c) => ({ ...c, faceUp: false })),
          ];

          if (shoeState.shuffleNeeded || shoe.length < 52) {
            shoe = createShoe(store.settings().numberOfDecks);
            shoeState = {
              totalCards: shoe.length,
              cardsDealt: 0,
              cutCardPosition: shoeState.cutCardPosition,
              shuffleNeeded: false,
              cutCardReached: false,
            };
            discardTray = [];
          }

          // Preserve the existing box structure, just reset hands and resolution state
          const previousBoxes = store.boxes();
          const boxes = previousBoxes.map((box) => ({
            ...createEmptyBox(box.bet),
            id: box.id,
            isActive: box.isActive,
            bet: box.bet,
          }));

          patchState(store, {
            shoe,
            shoeState,
            discardTray,
            boxes,
            activeBoxIndex: 0,
            insuranceBoxIndex: -1,
            dealerHand: createEmptyHand(),
            phase: 'betting',
            result: null,
            message: 'Place your bets to start',
          });
        },

        getHandValue(hand: Hand): number {
          return calculateHandValue(hand.cards).value;
        },

        markCardRevealed(cardId: string): void {
          // Check dealer hand first
          const dealerResult = revealDealerCard(store.dealerHand(), cardId);
          if (dealerResult) {
            patchState(store, { dealerHand: dealerResult });
            return;
          }

          // Check player boxes
          const boxesResult = revealPlayerCard(store.boxes(), cardId);
          if (boxesResult) {
            patchState(store, { boxes: boxesResult });
          }
        },

        revealAllCards(): void {
          const dealerHand = revealAllCardsInHand(store.dealerHand());
          const boxes = revealAllPlayerCards(store.boxes());
          patchState(store, { dealerHand, boxes });
        },
      };
    }),
  );
}
