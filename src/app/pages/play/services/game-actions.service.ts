/**
 * Game Actions Service
 * 
 * Handles game actions for the play page.
 * Extracted from PlayComponent for single responsibility and testability.
 * This is the bridge between UI events and the store.
 */

import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { GameAction } from '../../../shared/models';
import { BlackjackStore } from '../../../store';
import { SettingsDialogComponent } from '../settings-dialog/settings-dialog';

@Injectable()
export class GameActionsService {
  private readonly store = inject(BlackjackStore);
  private readonly dialog = inject(MatDialog);

  /**
   * Execute a game action
   */
  executeAction(action: GameAction): void {
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

  /**
   * Mark a card as revealed after animation
   */
  markCardRevealed(cardId: string): void {
    this.store.markCardRevealed(cardId);
  }

  /**
   * Open the settings dialog
   */
  openSettings(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '500px',
    });
  }

  /**
   * Start a new game
   */
  newGame(): void {
    this.store.newGame();
  }
}
