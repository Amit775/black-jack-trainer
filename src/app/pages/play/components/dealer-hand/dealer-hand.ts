import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  output,
  signal,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Hand, Card, Suit, SUIT_SYMBOLS } from '../../../../shared/models';
import { PlayingCardComponent } from '../../../../shared/components';
import { AnimationCoordinatorService } from '../../../../services/animation-coordinator.service';

/**
 * DealerHandComponent
 *
 * Displays the dealer's hand with animated cards that slide in from the shoe.
 * Hand value is only calculated after animations complete for revealed cards.
 */
@Component({
  selector: 'app-dealer-hand',
  standalone: true,
  imports: [CommonModule, PlayingCardComponent],
  templateUrl: './dealer-hand.html',
  styleUrl: './dealer-hand.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealerHandComponent {
  private readonly animationCoordinator = inject(AnimationCoordinatorService);

  /** Dealer's hand */
  readonly hand = input.required<Hand>();

  /** Calculated hand value (only revealed cards) */
  readonly handValue = input.required<number>();

  /** Emitted when a card's enter animation completes */
  readonly cardEntered = output<string>();

  /** Emitted when a card's reveal animation completes */
  readonly cardRevealed = output<string>();

  /** Track which cards have completed their animations */
  private readonly revealedCardIds = signal<Set<string>>(new Set());

  protected readonly shouldShowValue = computed(() => {
    const cards = this.hand().cards;
    if (cards.length === 0) return false;
    // Only show value if at least one card is revealed
    return cards.some(c => c.isRevealed);
  });

  /** Display value with animation consideration */
  protected readonly displayValue = computed(() => {
    return this.handValue();
  });

  /** Whether dealer has blackjack (for special display) */
  protected readonly hasBlackjack = computed(() => {
    const value = this.handValue();
    const cards = this.hand().cards;
    return value === 21 && cards.length === 2 && cards.every(c => c.isRevealed);
  });

  protected getSuitSymbol(suit: Suit): string {
    return SUIT_SYMBOLS[suit];
  }

  protected isRed(card: Card): boolean {
    return card.suit === 'hearts' || card.suit === 'diamonds';
  }

  protected onCardEnterComplete(cardId: string): void {
    this.animationCoordinator.completeAnimation(cardId, 'card-dealt');
    this.cardEntered.emit(cardId);
  }

  protected onCardRevealComplete(cardId: string): void {
    this.revealedCardIds.update(ids => {
      const newIds = new Set(ids);
      newIds.add(cardId);
      return newIds;
    });
    this.animationCoordinator.completeAnimation(cardId, 'card-revealed');
    this.cardRevealed.emit(cardId);
  }

  protected trackByCardId(index: number, card: Card): string {
    return card.id;
  }
}
