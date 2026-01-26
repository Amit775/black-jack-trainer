import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GamePhase, GameAction, Box } from '../../../../shared/models';

export interface GameControlsState {
  canHit: boolean;
  canStand: boolean;
  canDoubleDown: boolean;
  canSplit: boolean;
  canPlaceBets: boolean;
}

@Component({
  selector: 'app-game-controls',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './game-controls.html',
  styleUrl: './game-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameControlsComponent {
  /** Current game phase */
  readonly phase = input.required<GamePhase>();

  /** Total bet amount for display */
  readonly totalBet = input.required<number>();

  /** Control state flags */
  readonly controlsState = input.required<GameControlsState>();

  /** Insurance box for insurance phase */
  readonly insuranceBox = input<Box | null>(null);

  /** Emitted when a game action is triggered */
  readonly actionTriggered = output<GameAction>();

  protected readonly insuranceCost = computed(() => {
    const box = this.insuranceBox();
    return box ? box.bet / 2 : 0;
  });

  protected emitAction(action: GameAction): void {
    this.actionTriggered.emit(action);
  }
}
