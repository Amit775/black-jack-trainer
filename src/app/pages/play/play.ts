/**
 * PlayComponent - Smart Container Component
 *
 * This is the main container component for the play page.
 * Following the smart/dumb pattern, this component:
 * - Orchestrates child services (BoxManager, CarouselState, GameActions)
 * - Connects the store to the view
 * - Delegates business logic to services
 * - Passes data down to presentational (dumb) components
 * - Handles events from child components
 *
 * The actual business logic is delegated to:
 * - BoxManagerService: Box selection, betting, chip management
 * - CarouselStateService: Carousel navigation and indicators
 * - GameActionsService: Game action execution
 * - BlackjackStore: Core game state
 */

import {
  Component,
  inject,
  OnInit,
  computed,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BlackjackStore } from '../../store';
import { GameAction, ChipDenomination, Box } from '../../shared/models';
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
import { CarouselComponent, CarouselItemDirective } from '../../shared/components';
import {
  BoxManagerService,
  CarouselStateService,
  GameActionsService,
  type CarouselItem,
} from './services';

const DEFAULT_BET = 10;

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
  providers: [
    // Provide scoped services for this component tree
    BoxManagerService,
    CarouselStateService,
    GameActionsService,
  ],
  templateUrl: './play.html',
  styleUrl: './play.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayComponent implements OnInit {
  // Injected dependencies
  protected readonly store = inject(BlackjackStore);
  private readonly boxManager = inject(BoxManagerService);
  private readonly carouselState = inject(CarouselStateService);
  private readonly gameActions = inject(GameActionsService);

  // ============================================================================
  // Carousel State Delegation
  // ============================================================================

  protected readonly carouselItems = this.carouselState.carouselItems;
  protected readonly carouselIndicators = this.carouselState.carouselIndicators;
  protected readonly activeCarouselIndex = this.carouselState.activeCarouselIndex;
  protected readonly currentCarouselItem = this.carouselState.currentCarouselItem;

  // ============================================================================
  // Computed Values
  // ============================================================================

  protected readonly controlsState = computed<GameControlsState>(() => ({
    canHit: this.store.canHit() ?? false,
    canStand: this.store.canStand() ?? false,
    canDoubleDown: this.store.canDoubleDown() ?? false,
    canSplit: this.store.canSplit() ?? false,
    canPlaceBets: this.boxManager.canPlaceBets(),
  }));

  // ============================================================================
  // Lifecycle
  // ============================================================================

  constructor() {
    // Sync carousel state with store state using effect
    effect(() => {
      const boxes = this.store.boxes();
      const phase = this.store.phase();
      const activeBox = this.store.activeBox();
      const insuranceBox = this.store.insuranceBox();

      this.carouselState.updateState(
        boxes,
        phase,
        activeBox?.id ?? null,
        activeBox?.activeHandIndex ?? 0,
        insuranceBox?.id ?? null
      );
    });
  }

  ngOnInit(): void {
    this.gameActions.newGame();
    this.boxManager.initialize(DEFAULT_BET);
  }

  // ============================================================================
  // Carousel Event Handlers
  // ============================================================================

  protected onCarouselIndexChange(index: number): void {
    this.carouselState.setCarouselIndex(index);
    const boxId = this.carouselState.getBoxIdAtIndex(index);
    if (boxId) {
      this.boxManager.selectBox(boxId);
    }
  }

  // ============================================================================
  // Box Helpers - Delegated to BoxManagerService
  // ============================================================================

  protected getBox(boxId: string): Box | undefined {
    return this.boxManager.getBox(boxId);
  }

  protected isActiveBox(boxId: string): boolean {
    return this.boxManager.isActiveBox(boxId);
  }

  protected isInsuranceBox(boxId: string): boolean {
    return this.boxManager.isInsuranceBox(boxId);
  }

  protected isSelectedBox(boxId: string): boolean {
    return this.boxManager.isSelectedBox(boxId);
  }

  protected canRemoveBox(): boolean {
    return this.boxManager.canRemoveBox();
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  protected onBoxSelected(event: PlayerBoxEvent): void {
    this.boxManager.selectBox(event.boxId);
  }

  protected onChipRemoved(event: ChipRemoveEvent): void {
    this.boxManager.removeChip(event.boxId, event.chipValue);
  }

  protected onBoxRemoved(event: PlayerBoxEvent): void {
    this.boxManager.removeBox(event.boxId);
  }

  protected onChipSelected(chip: ChipDenomination): void {
    this.boxManager.addChip(chip);
  }

  protected onAddBox(): void {
    const newBoxId = this.boxManager.addBox(DEFAULT_BET);
    if (newBoxId) {
      this.carouselState.navigateToBox(newBoxId);
    }
  }

  protected onCardAnimationComplete(cardId: string): void {
    this.gameActions.markCardRevealed(cardId);
  }

  protected onActionTriggered(action: GameAction): void {
    this.gameActions.executeAction(action);
  }

  protected openSettings(): void {
    this.gameActions.openSettings();
  }
}
