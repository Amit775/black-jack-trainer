import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Hand, Card, SUIT_SYMBOLS } from '../../../../shared/models';

@Component({
  selector: 'app-dealer-hand',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dealer-hand.html',
  styleUrl: './dealer-hand.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DealerHandComponent {
  /** Dealer's hand */
  readonly hand = input.required<Hand>();

  /** Calculated hand value (only visible cards) */
  readonly handValue = input.required<number>();

  protected readonly shouldShowValue = computed(() => {
    return this.hand().cards.length > 0 && this.handValue() > 0;
  });

  protected getSuitSymbol(suit: string): string {
    return SUIT_SYMBOLS[suit] || '';
  }

  protected isRed(card: Card): boolean {
    return card.suit === 'hearts' || card.suit === 'diamonds';
  }
}
