import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Box,
  BoxPosition,
  Hand,
  Card,
  GamePhase,
  Suit,
  HandResult,
  SUIT_SYMBOLS,
  RESULT_TEXT,
} from '../../../../shared/models';

export interface PlayerBoxEvent {
  position: BoxPosition;
}

export interface ChipRemoveEvent {
  position: BoxPosition;
  chipValue: number;
}

@Component({
  selector: 'app-player-box',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './player-box.html',
  styleUrl: './player-box.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerBoxComponent {
  /** The box data to display */
  readonly box = input.required<Box>();

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

  /** Emitted when user clicks on the box to select it for betting */
  readonly boxSelected = output<PlayerBoxEvent>();

  /** Emitted when user removes a chip from the bet */
  readonly chipRemoved = output<ChipRemoveEvent>();

  /** Emitted when user clicks remove box button */
  readonly boxRemoved = output<PlayerBoxEvent>();

  protected readonly position = computed(() => this.box().position);
  protected readonly bet = computed(() => this.box().bet);
  protected readonly hands = computed(() => this.box().hands);
  protected readonly isBetting = computed(() => this.gamePhase() === 'betting');
  protected readonly isCenter = computed(() => this.position() === 'center');

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

  protected getHandValue(hand: Hand): number {
    let value = 0;
    let aces = 0;

    for (const card of hand.cards) {
      if (!card.faceUp) continue;

      if (card.rank === 'A') {
        aces++;
        value += 11;
      } else if (['J', 'Q', 'K'].includes(card.rank)) {
        value += 10;
      } else {
        value += parseInt(card.rank, 10);
      }
    }

    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return value;
  }

  protected onBoxClick(): void {
    if (this.isBetting()) {
      this.boxSelected.emit({ position: this.position() });
    }
  }

  protected onChipRemove(chipValue: number, event: Event): void {
    event.stopPropagation();
    this.chipRemoved.emit({ position: this.position(), chipValue });
  }

  protected onRemoveBox(event: Event): void {
    event.stopPropagation();
    this.boxRemoved.emit({ position: this.position() });
  }
}
