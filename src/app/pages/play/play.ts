import {
  Component,
  inject,
  OnInit,
  computed,
  ChangeDetectionStrategy,
  signal,
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
import { CarouselComponent, CarouselItemDirective, CarouselIndicator } from '../../shared/components';
import { calculateHandValue } from '../../store/utils/card.utils';

/**
 * Represents an item in the carousel (either a box or a specific hand within a split box)
 */
export interface CarouselItem {
  position: BoxPosition;
  handIndex: number;
  isSplitHand: boolean;
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
    CarouselComponent,
    CarouselItemDirective,
  ],
  templateUrl: './play.html',
  styleUrl: './play.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayComponent implements OnInit {
  protected readonly store = inject(BlackjackStore);
  private readonly dialog = inject(MatDialog);

  protected readonly defaultBet = 10;
  protected readonly boxPositions: BoxPosition[] = ['left', 'center', 'right'];

  /** Currently selected box for betting */
  protected selectedBoxPosition: BoxPosition = 'center';

  /** Current carousel index - bound to carousel component */
  protected readonly carouselIndex = signal(1);

  /** Dynamic carousel items - expands when hands are split */
  protected readonly carouselItems = computed<CarouselItem[]>(() => {
    const boxes = this.store.boxes();
    const items: CarouselItem[] = [];

    for (const position of this.boxPositions) {
      const box = boxes.find((b) => b.position === position);

      if (box?.isActive && box.hands.length > 1) {
        // Split box - add each hand as separate item
        for (let i = 0; i < box.hands.length; i++) {
          items.push({ position, handIndex: i, isSplitHand: true });
        }
      } else {
        // Regular box or inactive - single item
        items.push({ position, handIndex: 0, isSplitHand: false });
      }
    }

    return items;
  });

  /** Carousel indicators derived from carousel items */
  protected readonly carouselIndicators = computed<CarouselIndicator[]>(() => {
    return this.carouselItems().map((item) => this.getIndicatorForItem(item));
  });

  /** The active carousel index, synced with game state */
  protected readonly activeCarouselIndex = computed(() => {
    const activeBox = this.store.activeBox();
    const insuranceBox = this.store.insuranceBox();
    const phase = this.store.phase();
    const items = this.carouselItems();

    // During active gameplay, sync to the active hand
    if (phase === 'playing' && activeBox) {
      const index = items.findIndex(
        (item) => item.position === activeBox.position && item.handIndex === activeBox.activeHandIndex
      );
      if (index !== -1) return index;
    }

    // During insurance, sync to the insurance box
    if (phase === 'insurance' && insuranceBox) {
      const index = items.findIndex((item) => item.position === insuranceBox.position);
      if (index !== -1) return index;
    }

    // Otherwise, use manual selection
    return this.carouselIndex();
  });

  /** Current carousel item based on active index */
  protected readonly currentCarouselItem = computed(() => {
    const items = this.carouselItems();
    const index = this.activeCarouselIndex();
    const safeIndex = Math.min(Math.max(0, index), items.length - 1);
    return items[safeIndex];
  });

  protected readonly controlsState = computed<GameControlsState>(() => ({
    canHit: this.store.canHit() ?? false,
    canStand: this.store.canStand() ?? false,
    canDoubleDown: this.store.canDoubleDown() ?? false,
    canSplit: this.store.canSplit() ?? false,
    canPlaceBets: this.canPlaceBets(),
  }));

  ngOnInit(): void {
    this.store.newGame();
    this.store.setBoxBet('center', this.defaultBet);
  }

  /** Handle carousel index change from user interaction */
  protected onCarouselIndexChange(index: number): void {
    this.carouselIndex.set(index);
    const items = this.carouselItems();
    if (index >= 0 && index < items.length) {
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

  protected isSelectedBox(position: BoxPosition): boolean {
    return this.selectedBoxPosition === position && this.store.phase() === 'betting';
  }

  protected getActiveHandIndex(position: BoxPosition): number {
    const box = this.getBox(position);
    return box?.activeHandIndex ?? 0;
  }

  // Event handlers
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
  private getIndicatorForItem(item: CarouselItem): CarouselIndicator {
    const box = this.getBox(item.position);

    if (!box?.isActive) {
      return { state: 'inactive' };
    }

    const hand = box.hands[item.handIndex];
    if (!hand) {
      return { state: 'inactive' };
    }

    // Calculate hand value if cards exist
    const value = hand.cards.length > 0 ? calculateHandValue(hand.cards).value.toString() : undefined;

    // Determine state
    let state: CarouselIndicator['state'] = 'inactive';

    if (hand.result) {
      state = `result-${hand.result}` as CarouselIndicator['state'];
    } else if (this.isActiveBox(item.position) && box.activeHandIndex === item.handIndex) {
      state = 'playing';
    } else if (hand.cards.length > 0) {
      state = 'has-cards';
    }

    return { value, state };
  }

  private canPlaceBets(): boolean {
    const boxes = this.store.boxes();
    const activeBoxes = boxes.filter((b) => b.isActive);
    if (activeBoxes.length === 0) return false;
    if (activeBoxes.some((b) => b.bet <= 0)) return false;
    const total = this.store.currentBet();
    return total > 0 && total <= this.store.balance();
  }
}
