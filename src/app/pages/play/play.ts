import { Component, inject, OnInit, computed, ChangeDetectionStrategy, signal, HostListener } from '@angular/core';
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
  
  // Mobile carousel state
  protected readonly isMobile = signal(false);
  protected readonly mobileBoxIndex = signal(1); // 0=left, 1=center, 2=right

  // Only keep computed signals that add value or combine multiple sources
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
    this.checkMobile();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkMobile();
  }

  private checkMobile(): void {
    this.isMobile.set(window.innerWidth <= 600);
  }

  // Mobile carousel navigation
  protected get currentMobilePosition(): BoxPosition {
    return this.boxPositions[this.mobileBoxIndex()];
  }

  protected navigateBox(direction: 'prev' | 'next'): void {
    const current = this.mobileBoxIndex();
    if (direction === 'prev' && current > 0) {
      this.mobileBoxIndex.set(current - 1);
      this.selectedBoxPosition = this.boxPositions[current - 1];
    } else if (direction === 'next' && current < 2) {
      this.mobileBoxIndex.set(current + 1);
      this.selectedBoxPosition = this.boxPositions[current + 1];
    }
  }

  protected canNavigate(direction: 'prev' | 'next'): boolean {
    const current = this.mobileBoxIndex();
    return direction === 'prev' ? current > 0 : current < 2;
  }

  // Box helpers
  protected getBox(position: BoxPosition) {
    return this.store.boxes().find((b) => b.position === position);
  }

  protected isActiveBox(position: BoxPosition): boolean {
    const activeBox = this.store.activeBox();
    return activeBox?.position === position && this.store.phase() === 'playing';
  }

  protected isInsuranceBox(position: BoxPosition): boolean {
    const insuranceBox = this.store.insuranceBox();
    return insuranceBox?.position === position && this.store.phase() === 'insurance';
  }

  protected isSelectedBox(position: BoxPosition): boolean {
    return this.selectedBoxPosition === position && this.store.phase() === 'betting';
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

  /**
   * Handle card animation completion - mark the card as revealed
   * so its value is included in hand calculations
   */
  protected onCardAnimationComplete(cardId: string): void {
    this.store.markCardRevealed(cardId);
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
    const boxes = this.store.boxes();
    const activeBoxes = boxes.filter((b) => b.isActive);
    if (activeBoxes.length === 0) return false;
    if (activeBoxes.some((b) => b.bet <= 0)) return false;
    const total = this.store.currentBet();
    return total > 0 && total <= this.store.balance();
  }
}
