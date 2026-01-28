import { computed, Signal } from '@angular/core';
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
  BoxPosition,
  Card,
  GamePhase,
  GameResult,
  GameSliceState,
  Hand,
  ShoeState,
  createEmptyHand,
  createInitialBoxes,
} from '../models';
import { dealCardFromShoe, dealFaceDownCard } from './shoe.feature';
import {
  calculateHandValue,
  canSplit as canSplitCards,
  createShoe,
  isBlackjack,
  isBusted,
} from '../utils/card.utils';
import {
  CARD_DEAL_DURATION,
  CARD_FLIP_DURATION,
  DEALER_HIT_DELAY,
  ANIMATION_BUFFER,
} from '../../shared/animation.config';

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_GAME_STATE: GameSliceState = {
  boxes: createInitialBoxes(),
  activeBoxIndex: 1,
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

const SPLIT_DELAY_MS = 300;
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
        if (hand.isSplit) return false;
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
      // Internal Helper Methods
      // ========================================================================

      const updateBoxes = (updater: (boxes: Box[]) => Box[]) => {
        patchState(store, { boxes: updater([...store.boxes()]) });
      };

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

        let nextBoxIndex = -1;
        for (let i = store.activeBoxIndex() + 1; i < boxes.length; i++) {
          if (boxes[i].isActive && !boxes[i].isResolved) {
            nextBoxIndex = i;
            break;
          }
        }

        if (nextBoxIndex >= 0) {
          patchState(store, { boxes, activeBoxIndex: nextBoxIndex, message: 'Next box' });
        } else {
          patchState(store, { boxes });
          dealerTurn();
        }
      };

      const dealerTurn = () => {
        const boxes = store.boxes();
        const allBusted = boxes
          .filter((b) => b.isActive)
          .every((b) => b.hands.every((h) => h.isBusted));

        if (allBusted) {
          const netResult = store.balance() - store.roundStartBalance();
          resolveGame('lose', formatMoneyResult(netResult));
          return;
        }

        const dealerHand = { ...store.dealerHand() };
        dealerHand.cards = dealerHand.cards.map((c, index) => {
          if (index === 0) return { ...c, isRevealed: true };
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

        patchState(store, { dealerHand, phase: 'dealer-turn', message: "Dealer's turn" });

        // TODO: Move to animation service in Phase 2
        setTimeout(() => {
          patchState(store, (s) => {
            const hand = { ...s.dealerHand };
            hand.cards = hand.cards.map((c, index) =>
              index === 1 ? { ...c, animationState: 'dealt' as const, isRevealed: true } : c,
            );
            return { ...s, dealerHand: hand };
          });

          setTimeout(() => dealerPlay(), 300);
        }, HOLE_CARD_REVEAL_MS);
      };

      const dealerPlay = () => {
        const dealerHand = { ...store.dealerHand() };
        const handValue = calculateHandValue(dealerHand.cards);

        const needsMoreCards =
          handValue.value < 17 ||
          (handValue.value === 17 && handValue.isSoft && store.settings().dealerHitsSoft17);

        if (!needsMoreCards) {
          compareHands(handValue.value > 21);
          return;
        }

        let shoe = [...store.shoe()];
        let shoeState = { ...store.shoeState() };

        const result = dealCardFromShoe(shoe, shoeState, 0);
        const newCard = { ...result.card, isRevealed: false };
        dealerHand.cards = [...dealerHand.cards, newCard];

        patchState(store, { shoe: result.shoe, shoeState: result.shoeState, dealerHand });

        // TODO: Move to animation service in Phase 2
        setTimeout(() => {
          patchState(store, (s) => {
            const hand = { ...s.dealerHand };
            hand.cards = hand.cards.map((c, index) =>
              index === hand.cards.length - 1
                ? { ...c, animationState: 'dealt' as const, isRevealed: true }
                : c,
            );
            return { ...s, dealerHand: hand };
          });

          setTimeout(() => dealerPlay(), DELAY_BETWEEN_DEALER_CARDS - DEALER_CARD_ANIMATION_MS);
        }, DEALER_CARD_ANIMATION_MS);
      };

      const formatMoneyResult = (netResult: number) => {
        if (netResult > 0) {
          return `+$${netResult.toFixed(2)}`;
        } else if (netResult < 0) {
          return `-$${Math.abs(netResult).toFixed(2)}`;
        } else {
          return '$0.00';
        }
      };

      const compareHands = (dealerBusted: boolean) => {
        const dealerValue = calculateHandValue(store.dealerHand().cards).value;

        let totalWinnings = 0;
        let wins = 0;
        let losses = 0;

        const boxes = store.boxes().map((box) => {
          if (!box.isActive) return box;

          const hands = box.hands.map((hand) => {
            if (hand.isBusted || hand.result) return hand;

            const playerValue = calculateHandValue(hand.cards).value;
            const updatedHand = { ...hand };

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

        const newBalance = store.balance() + totalWinnings;
        patchState(store, { balance: newBalance, boxes });

        const netResult = newBalance - store.roundStartBalance();
        const resultMessage = formatMoneyResult(netResult);

        const gameResult: GameResult = wins > losses ? 'win' : wins < losses ? 'lose' : 'push';
        resolveGame(gameResult, resultMessage);
      };

      const resolveGame = (result: GameResult, message: string) => {
        const dealerHand = { ...store.dealerHand() };
        dealerHand.cards = dealerHand.cards.map((c) => ({ ...c, faceUp: true }));
        patchState(store, { dealerHand, phase: 'resolved', result, message });
      };

      const moveToNextInsuranceBox = (boxes: Box[], currentIndex: number) => {
        let nextIndex = -1;
        for (let i = currentIndex + 1; i < boxes.length; i++) {
          const b = boxes[i];
          if (b.isActive && b.insuranceBet === 0 && !b.insuranceDeclined) {
            if (store.balance() >= b.bet / 2) {
              nextIndex = i;
              break;
            } else {
              boxes[i] = { ...b, insuranceDeclined: true };
            }
          }
        }

        if (nextIndex >= 0) {
          const nextBox = boxes[nextIndex];
          patchState(store, {
            boxes,
            insuranceBoxIndex: nextIndex,
            message: `Insurance for ${nextBox.position} box? (Cost: $${(nextBox.bet / 2).toFixed(2)})`,
          });
        } else {
          patchState(store, {
            boxes,
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
        const dealerHasBlackjack = isBlackjack(dealerCards);

        let totalInsurancePayout = 0;
        if (dealerHasBlackjack) {
          store.boxes().forEach((box) => {
            if (box.isActive && box.insuranceBet > 0) {
              totalInsurancePayout += box.insuranceBet * 3;
            }
          });
          if (totalInsurancePayout > 0) {
            patchState(store, { balance: store.balance() + totalInsurancePayout });
          }
        }

        let allResolved = true;
        const boxes = store.boxes().map((box) => {
          if (!box.isActive) return box;

          const hand = box.hands[0];
          const playerHasBlackjack = isBlackjack(hand.cards);

          if (playerHasBlackjack) {
            if (dealerHasBlackjack) {
              patchState(store, { balance: store.balance() + hand.bet });
              return { ...box, hands: [{ ...hand, result: 'push' as const }], isResolved: true };
            } else {
              const winnings = hand.bet + hand.bet * store.settings().blackjackPays;
              patchState(store, { balance: store.balance() + winnings });
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

        if (dealerHasBlackjack || allResolved) {
          const netResult = store.balance() - store.roundStartBalance();
          patchState(store, {
            boxes,
            dealerHand: { ...store.dealerHand(), cards: dealerCards },
            phase: 'resolved',
            result: allResolved ? 'blackjack' : 'lose',
            message: formatMoneyResult(netResult),
          });
        } else {
          const firstPlayableIndex = boxes.findIndex((b) => b.isActive && !b.isResolved);
          patchState(store, {
            boxes,
            activeBoxIndex: firstPlayableIndex >= 0 ? firstPlayableIndex : store.activeBoxIndex(),
          });
        }
      };

      // ========================================================================
      // Public Methods
      // ========================================================================

      return {
        // Betting Phase
        toggleBox(position: BoxPosition): void {
          if (store.phase() !== 'betting') return;

          updateBoxes((boxes) =>
            boxes.map((box) => {
              if (box.position === position) {
                if (box.isActive && boxes.filter((b) => b.isActive).length <= 1) {
                  return box;
                }
                return { ...box, isActive: !box.isActive, bet: box.isActive ? 0 : box.bet };
              }
              return box;
            }),
          );
        },

        setBoxBet(position: BoxPosition, amount: number): void {
          if (store.phase() !== 'betting') return;
          if (amount < 0) return;

          const box = store.boxes().find((b) => b.position === position);
          if (!box || !box.isActive) return;

          const otherBoxesBet = store
            .boxes()
            .filter((b) => b.isActive && b.position !== position)
            .reduce((sum, b) => sum + b.bet, 0);

          if (otherBoxesBet + amount > store.balance()) return;

          updateBoxes((boxes) =>
            boxes.map((b) => (b.position === position ? { ...b, bet: amount } : b)),
          );
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

        // Player Actions
        hit(): void {
          if (store.phase() !== 'playing') return;
          const hand = store.activeHand();
          if (!hand || hand.isStanding || hand.isBusted) return;

          let shoe = [...store.shoe()];
          let shoeState = { ...store.shoeState() };
          const boxes = [...store.boxes()];
          const box = { ...boxes[store.activeBoxIndex()] };
          const hands = [...box.hands];
          const updatedHand = { ...hands[box.activeHandIndex] };

          const result = dealCardFromShoe(shoe, shoeState);
          updatedHand.cards = [...updatedHand.cards, result.card];

          if (isBusted(updatedHand.cards)) {
            updatedHand.isBusted = true;
            updatedHand.result = 'lose';
          }

          hands[box.activeHandIndex] = updatedHand;
          box.hands = hands;
          boxes[store.activeBoxIndex()] = box;

          patchState(store, {
            shoe: result.shoe,
            shoeState: result.shoeState,
            boxes,
            message: updatedHand.isBusted ? 'Busted!' : 'Your turn',
          });

          if (updatedHand.isBusted) {
            moveToNextHand();
          }
        },

        stand(): void {
          if (store.phase() !== 'playing') return;

          const boxes = [...store.boxes()];
          const box = { ...boxes[store.activeBoxIndex()] };
          const hands = [...box.hands];
          hands[box.activeHandIndex] = { ...hands[box.activeHandIndex], isStanding: true };
          box.hands = hands;
          boxes[store.activeBoxIndex()] = box;

          patchState(store, { boxes });
          moveToNextHand();
        },

        doubleDown(): void {
          if (store.phase() !== 'playing') return;
          if (!store.settings().doubleDownAllowed) return;

          const hand = store.activeHand();
          if (!hand || hand.cards.length !== 2) return;
          if (store.balance() < hand.bet) return;

          patchState(store, { balance: store.balance() - hand.bet });

          let shoe = [...store.shoe()];
          let shoeState = { ...store.shoeState() };
          const boxes = [...store.boxes()];
          const box = { ...boxes[store.activeBoxIndex()] };
          const hands = [...box.hands];
          const updatedHand = { ...hands[box.activeHandIndex] };

          updatedHand.bet *= 2;
          updatedHand.isDoubledDown = true;

          const result = dealCardFromShoe(shoe, shoeState);
          updatedHand.cards = [...updatedHand.cards, result.card];

          if (isBusted(updatedHand.cards)) {
            updatedHand.isBusted = true;
            updatedHand.result = 'lose';
          }
          updatedHand.isStanding = true;

          hands[box.activeHandIndex] = updatedHand;
          box.hands = hands;
          boxes[store.activeBoxIndex()] = box;

          patchState(store, {
            shoe: result.shoe,
            shoeState: result.shoeState,
            boxes,
            message: updatedHand.isBusted ? 'Busted!' : 'Doubled down',
          });

          moveToNextHand();
        },

        split(): void {
          if (store.phase() !== 'playing') return;
          if (!store.settings().splitAllowed) return;

          const hand = store.activeHand();
          if (!hand || hand.cards.length !== 2) return;
          if (hand.isSplit || !canSplitCards(hand.cards)) return;
          if (store.balance() < hand.bet) return;

          patchState(store, { balance: store.balance() - hand.bet });

          let shoe = [...store.shoe()];
          let shoeState = { ...store.shoeState() };
          const boxes = [...store.boxes()];
          const box = { ...boxes[store.activeBoxIndex()] };
          const currentHand = box.hands[box.activeHandIndex];

          const hand1 = createEmptyHand(currentHand.bet);
          const splitCard1: Card = {
            ...currentHand.cards[0],
            animationState: 'split-left',
            animationDelay: 0,
          };
          let result = dealCardFromShoe(shoe, shoeState, SPLIT_DELAY_MS + DEAL_DELAY_MS);
          shoe = result.shoe;
          shoeState = result.shoeState;
          hand1.cards = [splitCard1, result.card];
          hand1.isSplit = true;

          const hand2 = createEmptyHand(currentHand.bet);
          const splitCard2: Card = {
            ...currentHand.cards[1],
            animationState: 'split-right',
            animationDelay: 0,
          };
          result = dealCardFromShoe(shoe, shoeState, SPLIT_DELAY_MS + DEAL_DELAY_MS * 2);
          shoe = result.shoe;
          shoeState = result.shoeState;
          hand2.cards = [splitCard2, result.card];
          hand2.isSplit = true;

          const hands = [...box.hands];
          hands.splice(box.activeHandIndex, 1, hand1, hand2);
          box.hands = hands;
          boxes[store.activeBoxIndex()] = box;

          patchState(store, { shoe, shoeState, boxes, message: 'Split! Playing first hand.' });
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

          const previousBoxes = store.boxes();
          const boxes = createInitialBoxes().map((box, index) => ({
            ...box,
            isActive: previousBoxes[index].isActive,
            bet: previousBoxes[index].bet,
          }));

          patchState(store, {
            shoe,
            shoeState,
            discardTray,
            boxes,
            activeBoxIndex: 1,
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

        /**
         * Mark a card as revealed after its animation completes.
         * This updates the card's isRevealed flag so its value is included in calculations.
         */
        markCardRevealed(cardId: string): void {
          // Check dealer hand
          const dealerHand = store.dealerHand();
          const dealerCardIndex = dealerHand.cards.findIndex((c) => c.id === cardId);

          if (dealerCardIndex >= 0) {
            const updatedCards = [...dealerHand.cards];
            updatedCards[dealerCardIndex] = {
              ...updatedCards[dealerCardIndex],
              isRevealed: true,
              animationState: 'dealt',
            };
            patchState(store, {
              dealerHand: { ...dealerHand, cards: updatedCards },
            });
            return;
          }

          // Check player boxes
          const boxes = store.boxes().map((box) => {
            if (!box.isActive) return box;

            const hands = box.hands.map((hand) => {
              const cardIndex = hand.cards.findIndex((c) => c.id === cardId);
              if (cardIndex >= 0) {
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

          patchState(store, { boxes });
        },

        /**
         * Mark all currently dealing cards as revealed.
         * Used when we need to skip animations or fast-forward.
         */
        revealAllCards(): void {
          const dealerHand = store.dealerHand();
          const updatedDealerCards = dealerHand.cards.map((c) => ({
            ...c,
            isRevealed: c.faceUp,
            animationState: 'dealt' as const,
          }));

          const boxes = store.boxes().map((box) => {
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

          patchState(store, {
            dealerHand: { ...dealerHand, cards: updatedDealerCards },
            boxes,
          });
        },
      };

      // ========================================================================
      // Deal Initial Cards (Private Implementation)
      // ========================================================================

      function dealInitialCards(): void {
        let shoe = [...store.shoe()];
        let shoeState = { ...store.shoeState() };

        if (shoe.length < 52) {
          shoe = createShoe(store.settings().numberOfDecks);
          shoeState = {
            totalCards: shoe.length,
            cardsDealt: 0,
            cutCardPosition: shoeState.cutCardPosition,
            shuffleNeeded: false,
            cutCardReached: false,
          };
        }

        shoeState = { ...shoeState, cutCardReached: false };

        // Prepare the active box positions for dealing
        const activeBoxIndices = store
          .boxes()
          .map((box, index) => ({ box, index }))
          .filter(({ box }) => box.isActive)
          .map(({ index }) => index);

        // Initialize boxes with empty hands
        let boxes = store.boxes().map((box) => {
          if (!box.isActive) return box;
          const hand = createEmptyHand(box.bet);
          return { ...box, hands: [hand], activeHandIndex: 0, isResolved: false };
        });

        // Initialize dealer hand
        const dealerHand = createEmptyHand();

        // Update state with initial setup
        patchState(store, {
          shoe,
          shoeState,
          boxes,
          dealerHand,
          phase: 'dealing' as GamePhase,
          message: 'Dealing cards...',
        });

        // Build the deal sequence: player1-card1, player2-card1, dealer-card1, player1-card2, player2-card2, dealer-card2
        const dealSequence: Array<
          { type: 'player'; boxIndex: number } | { type: 'dealer'; faceDown: boolean }
        > = [];

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

        // Deal cards one by one
        let dealIndex = 0;
        const dealDelay = CARD_DEAL_DURATION + ANIMATION_BUFFER;

        const dealNextCard = () => {
          if (dealIndex >= dealSequence.length) {
            // All cards dealt, start playing
            finishInitialDeal();
            return;
          }

          const currentDeal = dealSequence[dealIndex];
          let currentShoe = [...store.shoe()];
          let currentShoeState = { ...store.shoeState() };

          if (currentDeal.type === 'player') {
            const result = dealCardFromShoe(currentShoe, currentShoeState, 0, dealIndex);
            const card = { ...result.card, isRevealed: true };

            const updatedBoxes = store.boxes().map((box, idx) => {
              if (idx !== currentDeal.boxIndex) return box;
              const hand = { ...box.hands[0] };
              hand.cards = [...hand.cards, card];
              return { ...box, hands: [hand] };
            });

            patchState(store, {
              shoe: result.shoe,
              shoeState: result.shoeState,
              boxes: updatedBoxes,
            });
          } else {
            // Dealer card
            const result = currentDeal.faceDown
              ? dealFaceDownCard(currentShoe, currentShoeState, 0, dealIndex)
              : dealCardFromShoe(currentShoe, currentShoeState, 0, dealIndex);

            const card = { ...result.card, isRevealed: !currentDeal.faceDown };
            const currentDealerHand = store.dealerHand();

            patchState(store, {
              shoe: result.shoe,
              shoeState: result.shoeState,
              dealerHand: {
                ...currentDealerHand,
                cards: [...currentDealerHand.cards, card],
              },
            });
          }

          dealIndex++;
          setTimeout(dealNextCard, dealDelay);
        };

        // Start dealing after a short delay
        setTimeout(dealNextCard, 100);
      }

      function finishInitialDeal(): void {
        const boxes = store.boxes();
        const dealerHand = store.dealerHand();
        const firstActiveIndex = boxes.findIndex((b) => b.isActive);
        const dealerCard1 = dealerHand.cards[0];
        const dealerShowsAce = dealerCard1?.rank === 'A';
        const insuranceAllowed = store.settings().insuranceAllowed;
        const anyBoxCanAffordInsurance = boxes.some(
          (box) => box.isActive && store.balance() >= box.bet / 2,
        );

        if (dealerShowsAce && insuranceAllowed && anyBoxCanAffordInsurance) {
          const firstInsuranceBoxIndex = boxes.findIndex((b) => b.isActive);
          const firstBox = boxes[firstInsuranceBoxIndex];

          patchState(store, {
            activeBoxIndex: firstActiveIndex,
            insuranceBoxIndex: firstInsuranceBoxIndex,
            phase: 'insurance',
            message: `Insurance for ${firstBox.position} box? (Cost: $${(firstBox.bet / 2).toFixed(2)})`,
          });
        } else {
          patchState(store, {
            activeBoxIndex: firstActiveIndex,
            insuranceBoxIndex: -1,
            phase: 'playing',
            message: 'Your turn',
          });

          // Check for immediate blackjacks
          checkInitialBlackjacks();
        }
      }
    }),
  );
}
