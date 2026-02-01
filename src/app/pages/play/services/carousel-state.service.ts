/**
 * Carousel State Service
 * 
 * Manages carousel navigation and indicator state for the play page.
 * Extracted from PlayComponent for single responsibility and testability.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { Box, GamePhase } from '../../../shared/models';
import { calculateHandValue } from '../../../store/utils/card.utils';

/**
 * Represents an item in the carousel (either a box or a specific hand within a split box)
 */
export interface CarouselItem {
  boxId: string;
  boxIndex: number;
  handIndex: number;
  isSplitHand: boolean;
}

/**
 * Carousel indicator state
 */
export interface CarouselIndicator {
  value?: string;
  state: 'inactive' | 'playing' | 'has-cards' | 'result-win' | 'result-lose' | 'result-push' | 'result-blackjack';
}

/**
 * Build carousel items from boxes
 * Expands split boxes into multiple carousel items
 */
export function buildCarouselItems(boxes: Box[]): CarouselItem[] {
  const items: CarouselItem[] = [];

  boxes.forEach((box, boxIndex) => {
    if (box.isActive && box.hands.length > 1) {
      // Split box - add each hand as separate item
      for (let i = 0; i < box.hands.length; i++) {
        items.push({ boxId: box.id, boxIndex, handIndex: i, isSplitHand: true });
      }
    } else {
      // Regular box or inactive - single item
      items.push({ boxId: box.id, boxIndex, handIndex: 0, isSplitHand: false });
    }
  });

  return items;
}

/**
 * Find the carousel index for a specific box and hand
 */
export function findCarouselIndex(
  items: CarouselItem[],
  boxId: string,
  handIndex: number
): number {
  return items.findIndex(
    (item) => item.boxId === boxId && item.handIndex === handIndex
  );
}

/**
 * Build indicator for a carousel item
 */
export function buildCarouselIndicator(
  item: CarouselItem,
  boxes: Box[],
  activeBoxId: string | null,
  activeHandIndex: number,
  isPlaying: boolean
): CarouselIndicator {
  const box = boxes.find((b) => b.id === item.boxId);

  if (!box?.isActive) {
    return { state: 'inactive' };
  }

  const hand = box.hands[item.handIndex];
  if (!hand) {
    return { state: 'inactive' };
  }

  // Calculate hand value if cards exist
  const value = hand.cards.length > 0
    ? calculateHandValue(hand.cards).value.toString()
    : undefined;

  // Determine state
  let state: CarouselIndicator['state'] = 'inactive';

  if (hand.result) {
    state = `result-${hand.result}` as CarouselIndicator['state'];
  } else if (isPlaying && box.id === activeBoxId && box.activeHandIndex === item.handIndex) {
    state = 'playing';
  } else if (hand.cards.length > 0) {
    state = 'has-cards';
  }

  return { value, state };
}

@Injectable()
export class CarouselStateService {
  // Manual carousel index (for user navigation)
  private readonly _carouselIndex = signal(0);
  
  // Inputs from parent (set via methods)
  private readonly _boxes = signal<Box[]>([]);
  private readonly _phase = signal<GamePhase>('betting');
  private readonly _activeBoxId = signal<string | null>(null);
  private readonly _activeHandIndex = signal(0);
  private readonly _insuranceBoxId = signal<string | null>(null);

  // Public readonly signals
  readonly carouselIndex = this._carouselIndex.asReadonly();

  // Computed carousel items
  readonly carouselItems = computed(() => buildCarouselItems(this._boxes()));

  // Computed active index (synced with game state)
  readonly activeCarouselIndex = computed(() => {
    const activeBoxId = this._activeBoxId();
    const insuranceBoxId = this._insuranceBoxId();
    const phase = this._phase();
    const items = this.carouselItems();

    // During active gameplay, sync to the active hand
    if (phase === 'playing' && activeBoxId) {
      const index = findCarouselIndex(items, activeBoxId, this._activeHandIndex());
      if (index !== -1) return index;
    }

    // During insurance, sync to the insurance box
    if (phase === 'insurance' && insuranceBoxId) {
      const index = items.findIndex((item) => item.boxId === insuranceBoxId);
      if (index !== -1) return index;
    }

    // Otherwise, use manual selection
    return this._carouselIndex();
  });

  // Current carousel item
  readonly currentCarouselItem = computed(() => {
    const items = this.carouselItems();
    const index = this.activeCarouselIndex();
    const safeIndex = Math.min(Math.max(0, index), items.length - 1);
    return items[safeIndex];
  });

  // Carousel indicators
  readonly carouselIndicators = computed<CarouselIndicator[]>(() => {
    const items = this.carouselItems();
    const boxes = this._boxes();
    const activeBoxId = this._activeBoxId();
    const activeHandIndex = this._activeHandIndex();
    const isPlaying = this._phase() === 'playing';

    return items.map((item) =>
      buildCarouselIndicator(item, boxes, activeBoxId, activeHandIndex, isPlaying)
    );
  });

  /**
   * Update state from parent component
   */
  updateState(
    boxes: Box[],
    phase: GamePhase,
    activeBoxId: string | null,
    activeHandIndex: number,
    insuranceBoxId: string | null
  ): void {
    this._boxes.set(boxes);
    this._phase.set(phase);
    this._activeBoxId.set(activeBoxId);
    this._activeHandIndex.set(activeHandIndex);
    this._insuranceBoxId.set(insuranceBoxId);
  }

  /**
   * Set carousel index from user interaction
   */
  setCarouselIndex(index: number): void {
    this._carouselIndex.set(index);
  }

  /**
   * Get box ID for a carousel index
   */
  getBoxIdAtIndex(index: number): string | null {
    const items = this.carouselItems();
    if (index >= 0 && index < items.length) {
      return items[index].boxId;
    }
    return null;
  }

  /**
   * Navigate to a specific box
   */
  navigateToBox(boxId: string): void {
    const items = this.carouselItems();
    const index = items.findIndex((item) => item.boxId === boxId);
    if (index !== -1) {
      this._carouselIndex.set(index);
    }
  }
}
