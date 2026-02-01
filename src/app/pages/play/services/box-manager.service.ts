/**
 * Box Manager Service
 * 
 * Manages betting box operations for the play page.
 * Extracted from PlayComponent for single responsibility and testability.
 */

import { Injectable, signal, inject, computed } from '@angular/core';
import { Box, ChipDenomination, GamePhase } from '../../../shared/models';
import { BlackjackStore } from '../../../store';

/**
 * Pure function to check if bets can be placed
 */
export function canPlaceBetsForBoxes(
  boxes: Box[],
  balance: number
): boolean {
  const activeBoxes = boxes.filter((b) => b.isActive);
  if (activeBoxes.length === 0) return false;
  if (activeBoxes.some((b) => b.bet <= 0)) return false;
  
  const totalBet = activeBoxes.reduce((sum, b) => sum + b.bet, 0);
  return totalBet > 0 && totalBet <= balance;
}

/**
 * Calculate chips to display for a bet amount
 */
export function calculateChipsForBet(bet: number): number[] {
  const chips: number[] = [];
  let remaining = bet;
  const denominations = [100, 50, 25, 10, 5];

  for (const denom of denominations) {
    while (remaining >= denom) {
      chips.push(denom);
      remaining -= denom;
    }
  }
  return chips;
}

@Injectable()
export class BoxManagerService {
  private readonly store = inject(BlackjackStore);

  /** Currently selected box ID for betting */
  private readonly _selectedBoxId = signal<string | null>(null);
  
  readonly selectedBoxId = this._selectedBoxId.asReadonly();

  /**
   * Initialize with the first box selected
   */
  initialize(defaultBet: number): void {
    const firstBox = this.store.boxes()[0];
    if (firstBox) {
      this._selectedBoxId.set(firstBox.id);
      this.store.setBoxBet(firstBox.id, defaultBet);
    }
  }

  /**
   * Select a box for betting
   */
  selectBox(boxId: string): void {
    const box = this.getBox(boxId);
    if (box?.isActive) {
      this._selectedBoxId.set(boxId);
    }
  }

  /**
   * Get a box by ID
   */
  getBox(boxId: string): Box | undefined {
    return this.store.boxes().find((b) => b.id === boxId);
  }

  /**
   * Get a box by index
   */
  getBoxByIndex(index: number): Box | undefined {
    return this.store.boxes()[index];
  }

  /**
   * Check if a box is the active playing box
   */
  isActiveBox(boxId: string): boolean {
    const activeBox = this.store.activeBox();
    return activeBox?.id === boxId && this.store.phase() === 'playing';
  }

  /**
   * Check if a box is being offered insurance
   */
  isInsuranceBox(boxId: string): boolean {
    const insuranceBox = this.store.insuranceBox();
    return insuranceBox?.id === boxId && this.store.phase() === 'insurance';
  }

  /**
   * Check if a box is selected for betting
   */
  isSelectedBox(boxId: string): boolean {
    return this._selectedBoxId() === boxId && this.store.phase() === 'betting';
  }

  /**
   * Get active hand index for a box
   */
  getActiveHandIndex(boxId: string): number {
    const box = this.getBox(boxId);
    return box?.activeHandIndex ?? 0;
  }

  /**
   * Check if boxes can be removed (more than one active)
   */
  canRemoveBox(): boolean {
    return this.store.boxes().filter((b) => b.isActive).length > 1;
  }

  /**
   * Add a chip to the selected box
   */
  addChip(chip: ChipDenomination): void {
    const selectedId = this._selectedBoxId();
    if (!selectedId) return;
    
    const box = this.getBox(selectedId);
    if (box?.isActive) {
      this.store.setBoxBet(selectedId, box.bet + chip);
    }
  }

  /**
   * Remove a chip from a box
   */
  removeChip(boxId: string, chipValue: number): void {
    const box = this.getBox(boxId);
    if (box?.isActive && box.bet >= chipValue) {
      this.store.setBoxBet(boxId, box.bet - chipValue);
    }
  }

  /**
   * Add a new box
   */
  addBox(defaultBet: number): string | null {
    const newBoxId = this.store.addBox();
    if (newBoxId) {
      this._selectedBoxId.set(newBoxId);
      this.store.setBoxBet(newBoxId, defaultBet);
    }
    return newBoxId;
  }

  /**
   * Remove a box
   */
  removeBox(boxId: string): void {
    this.store.removeBox(boxId);
  }

  /**
   * Check if bets can be placed
   */
  canPlaceBets(): boolean {
    return canPlaceBetsForBoxes(this.store.boxes(), this.store.balance());
  }
}
