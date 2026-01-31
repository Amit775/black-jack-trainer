import {
  Component,
  inject,
  OnInit,
  computed,
  ChangeDetectionStrategy,
  signal,
  HostListener,
  effect,
} from '@angular/core';
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
import { calculateHandValue } from '../../store/utils/card.utils';
import { Box, Hand, HandResult } from '../../shared/models';

// Represents an item in the mobile carousel (either a box or a specific hand within a split box)
export interface CarouselItem {
  position: BoxPosition;
  handIndex: number; // 0 for non-split, 0 or 1 for split hands
  isSplitHand: boolean;
  label: string; // e.g., 'L', 'C', 'R', 'C1', 'C2'
}

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
  protected readonly mobileCarouselIndex = signal(1); // Index into carouselItems

  // Dynamic carousel items - expands when hands are split
  protected readonly carouselItems = computed<CarouselItem[]>(() => {
    const boxes = this.store.boxes();
    const items: CarouselItem[] = [];

    for (const position of this.boxPositions) {
      const box = boxes.find((b) => b.position === position);

      if (box?.isActive && box.hands.length > 1) {
        // Split box - add each hand as separate item
        for (let i = 0; i < box.hands.length; i++) {
          items.push({
            position,
            handIndex: i,
            isSplitHand: true,
            label: `${position.charAt(0).toUpperCase()}${i + 1}`,
          });
        }
      } else {
        // Regular box or inactive - single item
        items.push({
          position,
          handIndex: 0,
          isSplitHand: false,
          label: position.charAt(0).toUpperCase(),
        });
      }
    }

    return items;
  });

  constructor() {
    // Sync carousel with active box/hand during gameplay
    effect(() => {
      const activeBox = this.store.activeBox();
      const insuranceBox = this.store.insuranceBox();
      const phase = this.store.phase();
      const items = this.carouselItems();

      if (this.isMobile() && items.length > 0) {
        let targetPosition: BoxPosition | null = null;
        let targetHandIndex = 0;

        if (phase === 'playing' && activeBox) {
          targetPosition = activeBox.position;
          targetHandIndex = activeBox.activeHandIndex;
        } else if (phase === 'insurance' && insuranceBox) {
          targetPosition = insuranceBox.position;
        }

        if (targetPosition) {
          const index = items.findIndex(
            (item) => item.position === targetPosition && item.handIndex === targetHandIndex,
          );
          if (index !== -1 && index !== this.mobileCarouselIndex()) {
            this.mobileCarouselIndex.set(index);
          }
        }
      }
    });
  }

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
  protected get currentCarouselItem(): CarouselItem {
    const items = this.carouselItems();
    const index = this.mobileCarouselIndex();
    // Ensure index is within bounds
    const safeIndex = Math.min(Math.max(0, index), items.length - 1);
    return items[safeIndex];
  }

  protected navigateCarousel(direction: 'prev' | 'next'): void {
    const current = this.mobileCarouselIndex();
    const items = this.carouselItems();

    if (direction === 'prev' && current > 0) {
      this.mobileCarouselIndex.set(current - 1);
      this.selectedBoxPosition = items[current - 1].position;
    } else if (direction === 'next' && current < items.length - 1) {
      this.mobileCarouselIndex.set(current + 1);
      this.selectedBoxPosition = items[current + 1].position;
    }
  }

  protected canNavigateCarousel(direction: 'prev' | 'next'): boolean {
    const current = this.mobileCarouselIndex();
    const items = this.carouselItems();
    return direction === 'prev' ? current > 0 : current < items.length - 1;
  }

  protected selectCarouselItem(index: number): void {
    const items = this.carouselItems();
    if (index >= 0 && index < items.length) {
      this.mobileCarouselIndex.set(index);
      this.selectedBoxPosition = items[index].position;
    }
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

  // Carousel indicator helpers
  protected getItemHandValue(item: CarouselItem): string {
    const box = this.getBox(item.position);
    if (!box?.isActive) return '';

    const hand = box.hands[item.handIndex];
    if (!hand?.cards.length) return '';

    const value = calculateHandValue(hand.cards).value;
    return value.toString();
  }

  protected getItemIndicatorClass(item: CarouselItem): string {
    const box = this.getBox(item.position);
    const classes: string[] = [];

    if (!box?.isActive) {
      classes.push('inactive');
      return classes.join(' ');
    }

    const hand = box.hands[item.handIndex];

    if (hand?.result) {
      classes.push(`result-${hand.result}`);
    } else if (this.isActiveBox(item.position) && box.activeHandIndex === item.handIndex) {
      classes.push('playing');
    } else if (hand?.cards.length) {
      classes.push('has-cards');
    }

    if (item.isSplitHand) {
      classes.push('split-hand');
    }

    return classes.join(' ');
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
