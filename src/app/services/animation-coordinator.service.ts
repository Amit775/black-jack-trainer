import { Injectable, signal, computed } from '@angular/core';
import { Subject, Observable, timer, firstValueFrom } from 'rxjs';
import { take, map } from 'rxjs/operators';
import {
  CARD_DEAL_DURATION,
  CARD_FLIP_DURATION,
  DEAL_STAGGER_DELAY,
  DEALER_TURN_DELAY,
  DEALER_HIT_DELAY,
  HOLE_CARD_REVEAL_DELAY,
  ANIMATION_BUFFER,
  AnimationPhase,
} from '../shared/animation.config';

export interface AnimationEvent {
  type: 'card-dealt' | 'card-revealed' | 'hand-complete' | 'phase-complete';
  cardId?: string;
  handIndex?: number;
  boxIndex?: number;
}

export interface CardAnimationRequest {
  cardId: string;
  delay: number;
  duration: number;
  type: 'deal' | 'reveal' | 'split';
}

/**
 * AnimationCoordinatorService
 * 
 * Manages animation timing and coordination across the game.
 * Provides reactive animation events and timing utilities.
 * 
 * Key responsibilities:
 * - Track current animation phase
 * - Queue and coordinate card animations
 * - Emit events when animations complete
 * - Provide timing utilities for sequential animations
 */
@Injectable({
  providedIn: 'root',
})
export class AnimationCoordinatorService {
  // Animation state
  private readonly _phase = signal<AnimationPhase>('idle');
  private readonly _isAnimating = signal(false);
  private readonly _pendingAnimations = signal<Set<string>>(new Set());
  
  // Public signals
  readonly phase = this._phase.asReadonly();
  readonly isAnimating = this._isAnimating.asReadonly();
  
  // Animation event streams
  private readonly _animationComplete$ = new Subject<AnimationEvent>();
  private readonly _cardDealt$ = new Subject<string>();
  private readonly _cardRevealed$ = new Subject<string>();
  
  // Public observables
  readonly animationComplete$: Observable<AnimationEvent> = this._animationComplete$.asObservable();
  readonly cardDealt$: Observable<string> = this._cardDealt$.asObservable();
  readonly cardRevealed$: Observable<string> = this._cardRevealed$.asObservable();
  
  // Track pending animations for coordination
  readonly hasPendingAnimations = computed(() => this._pendingAnimations().size > 0);

  // ============================================================================
  // Phase Management
  // ============================================================================

  setPhase(phase: AnimationPhase): void {
    this._phase.set(phase);
    this._isAnimating.set(phase !== 'idle');
  }

  resetToIdle(): void {
    this._phase.set('idle');
    this._isAnimating.set(false);
    this._pendingAnimations.set(new Set());
  }

  // ============================================================================
  // Animation Registration & Tracking
  // ============================================================================

  /**
   * Register a card animation that's about to start
   */
  registerAnimation(cardId: string): void {
    this._pendingAnimations.update((set) => {
      const newSet = new Set(set);
      newSet.add(cardId);
      return newSet;
    });
  }

  /**
   * Mark a card animation as complete
   */
  completeAnimation(cardId: string, type: AnimationEvent['type'] = 'card-dealt'): void {
    this._pendingAnimations.update((set) => {
      const newSet = new Set(set);
      newSet.delete(cardId);
      return newSet;
    });

    this._animationComplete$.next({ type, cardId });

    if (type === 'card-dealt') {
      this._cardDealt$.next(cardId);
    } else if (type === 'card-revealed') {
      this._cardRevealed$.next(cardId);
    }

    // Check if all animations for current phase are complete
    if (this._pendingAnimations().size === 0) {
      this._animationComplete$.next({ type: 'phase-complete' });
    }
  }

  // ============================================================================
  // Timing Utilities
  // ============================================================================

  /**
   * Calculate staggered delay for dealing multiple cards
   */
  getStaggeredDelay(cardIndex: number, baseDelay: number = 0): number {
    return baseDelay + cardIndex * DEAL_STAGGER_DELAY;
  }

  /**
   * Get the total duration for dealing N cards
   */
  getTotalDealDuration(cardCount: number): number {
    return CARD_DEAL_DURATION + (cardCount - 1) * DEAL_STAGGER_DELAY + ANIMATION_BUFFER;
  }

  /**
   * Wait for a specific duration (returns a promise)
   */
  async wait(ms: number): Promise<void> {
    await firstValueFrom(timer(ms));
  }

  /**
   * Wait for card deal animation to complete
   */
  async waitForDeal(): Promise<void> {
    await this.wait(CARD_DEAL_DURATION + ANIMATION_BUFFER);
  }

  /**
   * Wait for card flip animation to complete
   */
  async waitForFlip(): Promise<void> {
    await this.wait(CARD_FLIP_DURATION + ANIMATION_BUFFER);
  }

  /**
   * Wait for dealer turn delay
   */
  async waitForDealerTurn(): Promise<void> {
    await this.wait(DEALER_TURN_DELAY);
  }

  /**
   * Wait for dealer hit delay
   */
  async waitForDealerHit(): Promise<void> {
    await this.wait(DEALER_HIT_DELAY);
  }

  /**
   * Wait for hole card reveal delay
   */
  async waitForHoleCardReveal(): Promise<void> {
    await this.wait(HOLE_CARD_REVEAL_DELAY);
  }

  /**
   * Wait for all pending animations to complete
   */
  async waitForAllAnimations(): Promise<void> {
    if (this._pendingAnimations().size === 0) return;
    
    // Wait until pending animations are cleared
    return new Promise((resolve) => {
      const checkComplete = () => {
        if (this._pendingAnimations().size === 0) {
          resolve();
        } else {
          setTimeout(checkComplete, 50);
        }
      };
      checkComplete();
    });
  }

  // ============================================================================
  // Timing Constants (exposed for external use)
  // ============================================================================

  get dealDuration(): number {
    return CARD_DEAL_DURATION;
  }

  get flipDuration(): number {
    return CARD_FLIP_DURATION;
  }

  get staggerDelay(): number {
    return DEAL_STAGGER_DELAY;
  }

  get dealerHitDelay(): number {
    return DEALER_HIT_DELAY;
  }
}
