import { Component, inject, OnInit, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BlackjackStore, BoxPosition } from '../../store';
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
  protected readonly store = inject(BlackjackStore);
  private readonly dialog = inject(MatDialog);

  protected readonly defaultBet = 10;
  protected selectedBoxPosition: BoxPosition = 'center';

  protected readonly boxPositions: BoxPosition[] = ['left', 'center', 'right'];

  // Computed signals for template
  protected readonly balance = computed(() => this.store.balance());
  protected readonly phase = computed(() => this.store.phase());
  protected readonly boxes = computed(() => this.store.boxes());
  protected readonly dealerHand = computed(() => this.store.dealerHand());
  protected readonly dealerHandValue = computed(() => this.store.dealerHandValue());
  protected readonly shoeState = computed(() => this.store.shoeState());
  protected readonly cardsInShoe = computed(() => this.store.shoe().length);
  protected readonly discardTray = computed(() => this.store.discardTray());
  protected readonly totalBet = computed(() => this.store.currentBet());
  protected readonly insuranceBox = computed(() => this.store.insuranceBox());
  protected readonly message = computed(() => this.store.message());
  protected readonly result = computed(() => this.store.result());

  protected readonly controlsState = computed<GameControlsState>(() => ({
    canHit: this.store.canHit() ?? false,
    canStand: this.store.canStand() ?? false,
    canDoubleDown: this.store.canDoubleDown() ?? false,
    canSplit: this.store.canSplit() ?? false,
    canPlaceBets: this.canPlaceBets(),
  }));

  ngOnInit(): void {
    // Store initializes shoe in onInit hook
    this.store.newGame();
    this.store.setBoxBet('center', this.defaultBet);
  }

  // Box helpers
  protected getBox(position: BoxPosition) {
    return this.boxes().find((b) => b.position === position);
  }

  protected isActiveBox(position: BoxPosition): boolean {
    const activeBox = this.store.activeBox();
    return activeBox?.position === position && this.phase() === 'playing';
  }

  protected isInsuranceBox(position: BoxPosition): boolean {
    const insuranceBox = this.store.insuranceBox();
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
      this.store.setBoxBet(event.position, box.bet - event.chipValue);
    }
  }

  protected onBoxRemoved(event: PlayerBoxEvent): void {
    this.store.toggleBox(event.position);
  }

  protected onChipSelected(chip: ChipDenomination): void {
    const box = this.getBox(this.selectedBoxPosition);
    if (box?.isActive) {
      this.store.setBoxBet(this.selectedBoxPosition, box.bet + chip);
    }
  }

  protected onToggleBox(position: BoxPosition): void {
    const wasActive = this.getBox(position)?.isActive;
    this.store.toggleBox(position);
    const box = this.getBox(position);
    if (box?.isActive && !wasActive) {
      this.selectedBoxPosition = position;
      if (box.bet === 0) {
        this.store.setBoxBet(position, this.defaultBet);
      }
    }
  }

  protected onActionTriggered(action: GameAction): void {
    switch (action) {
      case 'hit':
        this.store.hit();
        break;
      case 'stand':
        this.store.stand();
        break;
      case 'double':
        this.store.doubleDown();
        break;
      case 'split':
        this.store.split();
        break;
      case 'insurance-yes':
        this.store.takeInsurance();
        break;
      case 'insurance-no':
        this.store.declineInsurance();
        break;
      case 'deal':
        this.store.placeBets();
        break;
      case 'new-game':
        this.store.newGame();
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
