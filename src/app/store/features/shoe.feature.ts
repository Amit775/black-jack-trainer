import { computed } from '@angular/core';
import { signalStoreFeature, withComputed, withMethods, withState, patchState } from '@ngrx/signals';
import { Card, ShoeState, ShoeSliceState, INITIAL_SHOE_STATE } from '../models';
import { createShoe } from '../utils/card.utils';

const INITIAL_STATE: ShoeSliceState = {
  shoe: [],
  shoeState: INITIAL_SHOE_STATE,
  discardTray: [],
};

export interface DealCardResult {
  card: Card;
  shoe: Card[];
  shoeState: ShoeState;
  cutCardHit: boolean;
}

/**
 * Pure function to deal a card from the shoe
 * Used by both shoe and game features
 */
export function dealCardFromShoe(
  shoe: Card[],
  shoeState: ShoeState,
  animationDelay: number = 0,
): DealCardResult {
  const updatedShoe = [...shoe];
  const card: Card = {
    ...updatedShoe.pop()!,
    faceUp: true,
    animationState: 'dealing',
    animationDelay,
  };

  const newCardsDealt = shoeState.cardsDealt + 1;
  const remainingCards = shoeState.totalCards - newCardsDealt;

  const cutCardHit = remainingCards <= shoeState.cutCardPosition && !shoeState.cutCardReached;

  const updatedShoeState: ShoeState = {
    ...shoeState,
    cardsDealt: newCardsDealt,
    cutCardReached: shoeState.cutCardReached || cutCardHit,
    shuffleNeeded: shoeState.shuffleNeeded || cutCardHit,
  };

  return { card, shoe: updatedShoe, shoeState: updatedShoeState, cutCardHit };
}

/**
 * Calculate cut card position based on number of decks
 */
function calculateCutCardPosition(numberOfDecks: number): number {
  let cutCardMin: number;
  let cutCardMax: number;

  if (numberOfDecks >= 4) {
    cutCardMin = 52; // 1 deck
    cutCardMax = 78; // 1.5 decks
  } else {
    cutCardMin = 26; // 0.5 deck
    cutCardMax = 26;
  }

  return cutCardMin + Math.floor(Math.random() * (cutCardMax - cutCardMin + 1));
}

export function withShoe() {
  return signalStoreFeature(
    withState(INITIAL_STATE),

    withComputed((store) => ({
      cardsRemaining: computed(() => store.shoe().length),
      penetration: computed(() => {
        const state = store.shoeState();
        if (state.totalCards === 0) return 0;
        return (state.cardsDealt / state.totalCards) * 100;
      }),
      needsReshuffle: computed(() => store.shoeState().shuffleNeeded),
    })),

    withMethods((store) => ({
      initializeShoe(numberOfDecks: number): void {
        const shoe = createShoe(numberOfDecks);
        const totalCards = shoe.length;
        const cutCardPosition = calculateCutCardPosition(numberOfDecks);

        const shoeState: ShoeState = {
          totalCards,
          cardsDealt: 0,
          cutCardPosition,
          shuffleNeeded: false,
          cutCardReached: false,
        };

        patchState(store, { shoe, shoeState, discardTray: [] });
      },

      addToDiscardTray(cards: Card[]): void {
        patchState(store, {
          discardTray: [
            ...store.discardTray(),
            ...cards.map((c) => ({ ...c, faceUp: false })),
          ],
        });
      },

      reshuffleIfNeeded(numberOfDecks: number): boolean {
        const state = store.shoeState();
        if (!state.shuffleNeeded) return false;

        const shoe = createShoe(numberOfDecks);
        const totalCards = shoe.length;
        const cutCardPosition = calculateCutCardPosition(numberOfDecks);

        const shoeState: ShoeState = {
          totalCards,
          cardsDealt: 0,
          cutCardPosition,
          shuffleNeeded: false,
          cutCardReached: false,
        };

        patchState(store, { shoe, shoeState, discardTray: [] });
        return true;
      },

      updateShoeAfterDeal(shoe: Card[], shoeState: ShoeState): void {
        patchState(store, { shoe, shoeState });
      },

      resetCutCardReached(): void {
        patchState(store, {
          shoeState: { ...store.shoeState(), cutCardReached: false },
        });
      },
    })),
  );
}
