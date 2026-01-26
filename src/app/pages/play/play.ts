import { Component, inject, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GameService } from '../../services/game.service';
import { BalanceService } from '../../services/balance.service';
import { BoxPosition } from '../../services/card.service';
import { GameAction, ChipDenomination } from '../../shared/models';
import { SettingsDialogComponent } from './settings-dialog/settings-dialog';
import {
  GameHeaderComponent,
  TableAccessoriesComponent,
  DealerHandComponent,
  PlayerBoxComponent,
  ChipRackComponent,
  GameControlsComponent,
  type GameControlsState,
  type PlayerBoxEvent,
  type ChipRemoveEvent,
} from './components';

@Component({
  selector: 'app-play',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    GameHeaderComponent,
    TableAccessoriesComponent,
    DealerHandComponent,
    PlayerBoxComponent,
    ChipRackComponent,
    GameControlsComponent,
  ],
  templateUrl: './play.html',
  styleUrl: './play.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayComponent implements OnInit {
  protected readonly gameService = inject(GameService);
  protected readonly balanceService = inject(BalanceService);
  private readonly dialog = inject(MatDialog);

  protected readonly defaultBet = 10;
  protected selectedBoxPosition: BoxPosition = 'center';

  protected readonly boxPositions: BoxPosition[] = ['left', 'center', 'right'];

  // Computed signals for template
  protected readonly balance = computed(() => this.balanceService.balance());
  protected readonly phase = computed(() => this.gameService.phase());
  protected readonly boxes = computed(() => this.gameService.boxes());
  protected readonly dealerHand = computed(() => this.gameService.dealerHand());
  protected readonly dealerHandValue = computed(() => this.gameService.dealerHandValue());
  protected readonly shoeState = computed(() => this.gameService.shoeState());
  protected readonly cardsInShoe = computed(() => this.gameService.shoe().length);
  protected readonly discardTray = computed(() => this.gameService.discardTray());
  protected readonly totalBet = computed(() => this.gameService.currentBet());
  protected readonly insuranceBox = computed(() => this.gameService.insuranceBox());
  protected readonly message = computed(() => this.gameService.message());
  protected readonly result = computed(() => this.gameService.result());

  protected readonly controlsState = computed<GameControlsState>(() => ({
    canHit: this.gameService.canHit() ?? false,
    canStand: this.gameService.canStand() ?? false,
    canDoubleDown: this.gameService.canDoubleDown() ?? false,
    canSplit: this.gameService.canSplit() ?? false,
    canPlaceBets: this.canPlaceBets(),
  }));

  ngOnInit(): void {
    this.gameService.initializeShoe();
    this.gameService.newGame();
    this.gameService.setBoxBet('center', this.defaultBet);
  }

  // Box helpers
  protected getBox(position: BoxPosition) {
    return this.boxes().find((b) => b.position === position);
  }

  protected isActiveBox(position: BoxPosition): boolean {
    const activeBox = this.gameService.activeBox();
    return activeBox?.position === position && this.phase() === 'playing';
  }

  protected isInsuranceBox(position: BoxPosition): boolean {
    const insuranceBox = this.gameService.insuranceBox();
    return insuranceBox?.position === position && this.phase() === 'insurance';
  }

  protected isSelectedBox(position: BoxPosition): boolean {
    return this.selectedBoxPosition === position && this.phase() === 'betting';
  }

  protected getActiveHandIndex(position: BoxPosition): number {
    const box = this.getBox(position);
    return box?.activeHandIndex ?? 0;
  }

  // Event handlers from child components
  protected onBoxSelected(event: PlayerBoxEvent): void {
    const box = this.getBox(event.position);
    if (box?.isActive) {
      this.selectedBoxPosition = event.position;
    }
  }

  protected onChipRemoved(event: ChipRemoveEvent): void {
    const box = this.getBox(event.position);
    if (box?.isActive && box.bet >= event.chipValue) {
      this.gameService.setBoxBet(event.position, box.bet - event.chipValue);
    }
  }

  protected onBoxRemoved(event: PlayerBoxEvent): void {
    this.gameService.toggleBox(event.position);
  }

  protected onChipSelected(chip: ChipDenomination): void {
    const box = this.getBox(this.selectedBoxPosition);
    if (box?.isActive) {
      this.gameService.setBoxBet(this.selectedBoxPosition, box.bet + chip);
    }
  }

  protected onToggleBox(position: BoxPosition): void {
    const wasActive = this.getBox(position)?.isActive;
    this.gameService.toggleBox(position);
    const box = this.getBox(position);
    if (box?.isActive && !wasActive) {
      this.selectedBoxPosition = position;
      if (box.bet === 0) {
        this.gameService.setBoxBet(position, this.defaultBet);
      }
    }
  }

  protected onActionTriggered(action: GameAction): void {
    switch (action) {
      case 'hit':
        this.gameService.hit();
        break;
      case 'stand':
        this.gameService.stand();
        break;
      case 'double':
        this.gameService.doubleDown();
        break;
      case 'split':
        this.gameService.split();
        break;
      case 'insurance-yes':
        this.gameService.takeInsurance();
        break;
      case 'insurance-no':
        this.gameService.declineInsurance();
        break;
      case 'deal':
        this.gameService.placeBets();
        break;
      case 'new-game':
        this.gameService.newGame();
        break;
    }
  }

  protected openSettings(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '500px',
    });
  }

  // Private helpers
  private canPlaceBets(): boolean {
    const boxes = this.boxes();
    const activeBoxes = boxes.filter((b) => b.isActive);
    if (activeBoxes.length === 0) return false;
    if (activeBoxes.some((b) => b.bet <= 0)) return false;
    const total = this.totalBet();
    return total > 0 && total <= this.balance();
  }
}
