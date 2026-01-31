import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  ElementRef,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card, SUIT_SYMBOLS } from '../../models';

/**
 * PlayingCardComponent
 *
 * A reusable animated playing card component.
 * Cards slide in from the left (where the shoe is positioned) with a smooth animation.
 *
 * Features:
 * - Enter animation: slides in from the shoe position
 * - Flip animation: reveals face-down cards with a 3D flip effect
 * - Emits events when animations complete for value calculation timing
 */
@Component({
  selector: 'app-playing-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playing-card.html',
  styleUrl: './playing-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'playing-card-host',
    '[class.is-red]': 'isRed()',
    '[class.is-face-down]': '!card().faceUp',
    '[class.is-revealing]': 'isRevealing()',
    '[class.is-revealed]': 'card().isRevealed',
    '[class.card-enter]': 'shouldAnimate()',
    '[style.--deal-delay]': 'dealDelay()',
    '[style.--deal-index]': 'card().dealIndex ?? 0',
  },
})
export class PlayingCardComponent implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef);

  /** The card data to display */
  readonly card = input.required<Card>();

  /** Size variant of the card */
  readonly size = input<'small' | 'medium' | 'large'>('medium');

  /** Emitted when the enter animation completes */
  readonly enterComplete = output<string>();

  /** Emitted when the flip/reveal animation completes */
  readonly revealComplete = output<string>();

  /** Internal tracking of reveal state */
  protected readonly isRevealing = signal(false);
  private hasEmittedEnter = false;
  private animationEndHandler: ((event: AnimationEvent) => void) | null = null;

  protected readonly isRed = computed(() => {
    const suit = this.card().suit;
    return suit === 'hearts' || suit === 'diamonds';
  });

  /** Whether to apply the enter animation (animate when state is 'entering' or 'dealt') */
  protected readonly shouldAnimate = computed(() => {
    const state = this.card().animationState;
    return state === 'entering' || state === 'dealt' || state === 'revealed';
  });

  protected readonly dealDelay = computed(() => {
    return `${this.card().animationDelay}ms`;
  });

  protected readonly suitSymbol = computed(() => {
    return SUIT_SYMBOLS[this.card().suit];
  });

  protected readonly cardClasses = computed(() => {
    const c = this.card();
    return {
      'card-small': this.size() === 'small',
      'card-medium': this.size() === 'medium',
      'card-large': this.size() === 'large',
      'card-entering': c.animationState === 'entering',
      'card-dealt': c.animationState === 'dealt' || c.animationState === 'revealed',
      'card-revealing': c.animationState === 'revealing',
      'card-split-left': c.animationState === 'split-left',
      'card-split-right': c.animationState === 'split-right',
    };
  });

  ngAfterViewInit(): void {
    const element = this.el.nativeElement as HTMLElement;

    // Listen for animation end to emit completion events
    this.animationEndHandler = (event: AnimationEvent) => {
      if (event.animationName === 'cardSlideIn' && !this.hasEmittedEnter) {
        this.hasEmittedEnter = true;
        this.enterComplete.emit(this.card().id);
      }
      if (event.animationName === 'cardFlip') {
        this.isRevealing.set(false);
        this.revealComplete.emit(this.card().id);
      }
    };

    element.addEventListener('animationend', this.animationEndHandler as EventListener);
  }

  ngOnDestroy(): void {
    if (this.animationEndHandler) {
      const element = this.el.nativeElement as HTMLElement;
      element.removeEventListener('animationend', this.animationEndHandler as EventListener);
    }
  }

  /**
   * Trigger the flip animation to reveal the card
   */
  triggerReveal(): void {
    this.isRevealing.set(true);
  }
}
