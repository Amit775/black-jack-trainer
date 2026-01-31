import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChipDenomination, CHIP_DENOMINATIONS } from '../../../../shared/models';

@Component({
  selector: 'app-chip-rack',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './chip-rack.html',
  styleUrl: './chip-rack.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipRackComponent {
  /** Current player balance to determine if chips can be added */
  readonly balance = input.required<number>();

  /** Current total bet across all active boxes */
  readonly currentTotalBet = input.required<number>();

  /** Emitted when a chip is selected */
  readonly chipSelected = output<ChipDenomination>();

  protected readonly chips = CHIP_DENOMINATIONS;

  canAddChip(amount: number): boolean {
    return this.currentTotalBet() + amount <= this.balance();
  }

  selectChip(chip: ChipDenomination): void {
    if (this.canAddChip(chip)) {
      this.chipSelected.emit(chip);
    }
  }
}
