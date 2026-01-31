import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Box,
  Hand,
  Card,
  GamePhase,
  Suit,
  HandResult,
  SUIT_SYMBOLS,
  RESULT_TEXT,
} from '../../../../shared/models';
import { PlayingCardComponent } from '../../../../shared/components';
import { AnimationCoordinatorService } from '../../../../services/animation-coordinator.service';
import { calculateHandValue } from '../../../../store/utils/card.utils';

export interface PlayerBoxEvent {
  boxId: string;
}

export interface ChipRemoveEvent {
  boxId: string;
  chipValue: number;
}

/**
 * PlayerBoxComponent
 *
 * Displays a player's betting box with animated cards.
 * Hand values are calculated only after cards are revealed (animation complete).
 */
@Component({
  selector: 'app-player-box',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, PlayingCardComponent],
  templateUrl: './player-box.html',
  styleUrl: './player-box.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerBoxComponent {
  private readonly animationCoordinator = inject(AnimationCoordinatorService);

  /** The box data to display */
  readonly box = input.required<Box>();

  /** The box ID */
  readonly boxId = input.required<string>();

  /** Current game phase */
  readonly gamePhase = input.required<GamePhase>();

  /** Whether this box is the currently active playing box */
  readonly isActiveBox = input<boolean>(false);

  /** Whether this box is currently being offered insurance */
  readonly isInsuranceBox = input<boolean>(false);

  /** Whether this box is selected for betting */
  readonly isSelectedBox = input<boolean>(false);

  /** Index of the active hand within this box (for split hands) */
  readonly activeHandIndex = input<number>(0);

  /** When >= 0, only show this specific hand (for mobile carousel split view) */
  readonly showOnlyHandIndex = input<number>(-1);

  /** Whether this box can be removed (more than one box exists) */
  readonly canRemove = input<boolean>(false);

  /** Emitted when user clicks on the box to select it for betting */
  readonly boxSelected = output<PlayerBoxEvent>();

  /** Emitted when user removes a chip from the bet */
  readonly chipRemoved = output<ChipRemoveEvent>();

  /** Emitted when user clicks remove box button */
  readonly boxRemoved = output<PlayerBoxEvent>();

  /** Emitted when a card animation completes */
  readonly cardAnimationComplete = output<string>();

  // Track revealed cards for each hand
  private readonly revealedCards = signal<Set<string>>(new Set());

  protected readonly bet = computed(() => this.box().bet);
  protected readonly hands = computed(() => this.box().hands);
  
  // Hands to display - filters to single hand when showOnlyHandIndex is set
  protected readonly displayedHands = computed(() => {
    const allHands = this.hands();
    const singleHandIndex = this.showOnlyHandIndex();
    
    if (singleHandIndex >= 0 && singleHandIndex < allHands.length) {
      return [{ hand: allHands[singleHandIndex], originalIndex: singleHandIndex }];
    }
    
    return allHands.map((hand, index) => ({ hand, originalIndex: index }));
  });
  protected readonly isBetting = computed(() => this.gamePhase() === 'betting');
  protected readonly isPlaying = computed(() => this.gamePhase() === 'playing');

  protected readonly chipsForBet = computed(() => {
    const chips: number[] = [];
    let remaining = this.bet();
    const denominations = [100, 50, 25, 10, 5];

    for (const denom of denominations) {
      while (remaining >= denom) {
        chips.push(denom);
        remaining -= denom;
      }
    }
    return chips;
  });

  protected getSuitSymbol(suit: Suit): string {
    return SUIT_SYMBOLS[suit];
  }

  protected getResultText(result: HandResult): string {
    return RESULT_TEXT[result];
  }

  protected isRed(card: Card): boolean {
    return card.suit === 'hearts' || card.suit === 'diamonds';
  }

  protected isActiveHand(handIndex: number): boolean {
    return this.isActiveBox() && this.activeHandIndex() === handIndex;
  }

  /**
   * Get the hand value, only counting revealed cards
   */
  protected getHandValue(hand: Hand): number {
    return calculateHandValue(hand.cards).value;
  }

  /**
   * Check if hand has a blackjack
   */
  protected isBlackjack(hand: Hand): boolean {
    const value = calculateHandValue(hand.cards);
    return value.value === 21 && hand.cards.length === 2 && !hand.isSplit;
  }

  /**
   * Check if hand is busted
   */
  protected isBustedHand(hand: Hand): boolean {
    return calculateHandValue(hand.cards).value > 21;
  }

  /**
   * Get classes for result display
   */
  protected getResultClass(result: HandResult | undefined): string {
    if (!result) return '';
    return `result-${result}`;
  }

  protected onBoxClick(): void {
    if (this.isBetting()) {
      this.boxSelected.emit({ boxId: this.boxId() });
    }
  }

  protected onChipRemove(chipValue: number, event: Event): void {
    event.stopPropagation();
    this.chipRemoved.emit({ boxId: this.boxId(), chipValue });
  }

  protected onRemoveBox(event: Event): void {
    event.stopPropagation();
    this.boxRemoved.emit({ boxId: this.boxId() });
  }

  protected onCardEnterComplete(cardId: string): void {
    this.revealedCards.update((cards) => {
      const newCards = new Set(cards);
      newCards.add(cardId);
      return newCards;
    });
    this.animationCoordinator.completeAnimation(cardId, 'card-dealt');
    this.cardAnimationComplete.emit(cardId);
  }

  protected onCardRevealComplete(cardId: string): void {
    this.animationCoordinator.completeAnimation(cardId, 'card-revealed');
    this.cardAnimationComplete.emit(cardId);
  }

  protected trackByCardId(index: number, card: Card): string {
    return card.id;
  }

  protected trackByHandIndex(index: number, hand: Hand): number {
    return index;
  }
}
