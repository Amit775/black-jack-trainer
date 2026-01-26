import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GameService } from '../../services/game.service';
import { BalanceService } from '../../services/balance.service';
import { CardService, Card, Hand, Box, BoxPosition } from '../../services/card.service';
import { SettingsDialogComponent } from './settings-dialog/settings-dialog';

@Component({
  selector: 'app-play',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatChipsModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  templateUrl: './play.html',
  styleUrl: './play.scss',
})
export class PlayComponent implements OnInit {
  protected readonly gameService = inject(GameService);
  protected readonly balanceService = inject(BalanceService);
  protected readonly cardService = inject(CardService);
  private readonly dialog = inject(MatDialog);

  protected readonly betChips = [5, 10, 25, 50, 100];
  protected readonly defaultBet = 10;
  protected selectedBoxPosition: BoxPosition = 'center';

  ngOnInit(): void {
    this.gameService.initializeShoe();
    this.gameService.newGame();
    // Set default bet for center box
    this.gameService.setBoxBet('center', this.defaultBet);
  }

  // Box management
  getBox(position: BoxPosition): Box | undefined {
    return this.gameService.boxes().find((b) => b.position === position);
  }

  toggleBox(position: BoxPosition): void {
    const wasActive = this.getBox(position)?.isActive;
    this.gameService.toggleBox(position);
    const box = this.getBox(position);
    if (box?.isActive) {
      // Newly activated box
      if (!wasActive) {
        this.selectedBoxPosition = position;
        if (box.bet === 0) {
          this.gameService.setBoxBet(position, this.defaultBet);
        }
      }
    }
  }

  isActiveBox(position: BoxPosition): boolean {
    const activeBox = this.gameService.activeBox();
    return activeBox?.position === position && this.gameService.phase() === 'playing';
  }

  isInsuranceBox(position: BoxPosition): boolean {
    const insuranceBox = this.gameService.insuranceBox();
    return insuranceBox?.position === position && this.gameService.phase() === 'insurance';
  }

  isActiveHand(position: BoxPosition, handIndex: number): boolean {
    const activeBox = this.gameService.activeBox();
    if (!activeBox || activeBox.position !== position) return false;
    if (this.gameService.phase() !== 'playing') return false;
    return activeBox.activeHandIndex === handIndex;
  }

  // Box selection for betting
  selectBox(position: BoxPosition): void {
    const box = this.getBox(position);
    if (box?.isActive) {
      this.selectedBoxPosition = position;
    }
  }

  isSelectedBox(position: BoxPosition): boolean {
    return this.selectedBoxPosition === position && this.gameService.phase() === 'betting';
  }

  getSelectedBox(): Box | undefined {
    return this.getBox(this.selectedBoxPosition);
  }

  // Betting
  addChipToSelectedBox(amount: number): void {
    const box = this.getSelectedBox();
    if (box?.isActive) {
      this.gameService.setBoxBet(this.selectedBoxPosition, box.bet + amount);
    }
  }

  removeChipFromBox(position: BoxPosition, chipValue: number, event: Event): void {
    event.stopPropagation(); // Prevent selecting the box
    const box = this.getBox(position);
    if (box?.isActive && box.bet >= chipValue) {
      this.gameService.setBoxBet(position, box.bet - chipValue);
    }
  }

  clearSelectedBoxBet(): void {
    const box = this.getSelectedBox();
    if (box?.isActive) {
      this.gameService.setBoxBet(this.selectedBoxPosition, 0);
    }
  }

  selectBetChip(position: BoxPosition, amount: number): void {
    this.gameService.setBoxBet(position, amount);
  }

  incrementBet(position: BoxPosition): void {
    const box = this.getBox(position);
    if (box) {
      this.gameService.setBoxBet(position, box.bet + 5);
    }
  }

  decrementBet(position: BoxPosition): void {
    const box = this.getBox(position);
    if (box && box.bet > 5) {
      this.gameService.setBoxBet(position, box.bet - 5);
    }
  }

  canIncrementBet(position: BoxPosition): boolean {
    const box = this.getBox(position);
    if (!box) return false;
    const currentTotal = this.getTotalBet();
    return currentTotal + 5 <= this.balanceService.balance();
  }

  canAddChip(amount: number): boolean {
    const currentTotal = this.getTotalBet();
    return currentTotal + amount <= this.balanceService.balance();
  }

  canSelectChip(amount: number): boolean {
    const boxes = this.gameService.boxes();
    const otherBoxesBet = boxes
      .filter((b) => b.isActive && b.position !== 'center')
      .reduce((sum, b) => sum + b.bet, 0);
    return otherBoxesBet + amount <= this.balanceService.balance();
  }

  getTotalBet(): number {
    return this.gameService.currentBet();
  }

  canPlaceBets(): boolean {
    const boxes = this.gameService.boxes();
    const activeBoxes = boxes.filter((b) => b.isActive);
    if (activeBoxes.length === 0) return false;
    if (activeBoxes.some((b) => b.bet <= 0)) return false;
    const total = this.getTotalBet();
    return total > 0 && total <= this.balanceService.balance();
  }

  placeBets(): void {
    this.gameService.placeBets();
  }

  // Game actions
  hit(): void {
    this.gameService.hit();
  }

  stand(): void {
    this.gameService.stand();
  }

  doubleDown(): void {
    this.gameService.doubleDown();
  }

  split(): void {
    this.gameService.split();
  }

  takeInsurance(): void {
    this.gameService.takeInsurance();
  }

  declineInsurance(): void {
    this.gameService.declineInsurance();
  }

  newGame(): void {
    this.gameService.newGame();
  }

  // Display helpers
  getHandValue(hand: Hand): number {
    return this.gameService.getHandValue(hand);
  }

  getCardDisplay(card: Card): string {
    return this.cardService.getCardDisplay(card);
  }

  getCardColor(card: Card): string {
    return this.cardService.getSuitColor(card.suit);
  }

  // Convert a bet amount into an array of chip denominations for display
  getChipsForBet(bet: number): number[] {
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

  getSuitSymbol(suit: string): string {
    const symbols: Record<string, string> = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
    };
    return symbols[suit] || '';
  }

  getResultText(result: string): string {
    switch (result) {
      case 'win':
        return 'Win';
      case 'blackjack':
        return 'BJ!';
      case 'lose':
        return 'Lose';
      case 'push':
        return 'Push';
      default:
        return '';
    }
  }

  // Shoe visualization helpers
  getShoeCardLayers(): number[] {
    // Create visual layers for the shoe (max 20 layers for visual)
    const shoeState = this.gameService.shoeState();
    const remainingCards = shoeState.totalCards - shoeState.cardsDealt;
    const maxLayers = 20;
    const layers = Math.min(
      Math.ceil(remainingCards / (shoeState.totalCards / maxLayers)),
      maxLayers,
    );
    return Array.from({ length: layers }, (_, i) => i);
  }

  isLayerPastCutCard(layerIndex: number): boolean {
    const shoeState = this.gameService.shoeState();
    const remainingCards = shoeState.totalCards - shoeState.cardsDealt;
    const cardsPerLayer = shoeState.totalCards / 20;
    const layerCards = (20 - layerIndex) * cardsPerLayer;
    return layerCards <= shoeState.cutCardPosition;
  }

  getCutCardVisualPosition(): number {
    // Returns a percentage position for the cut card (0-100, from bottom)
    const shoeState = this.gameService.shoeState();
    const cutCardPercent = (shoeState.cutCardPosition / shoeState.totalCards) * 100;
    return Math.min(cutCardPercent, 40); // Cap at 40% from bottom for visual
  }

  getDiscardLayers(): number[] {
    const discardCount = this.gameService.discardTray().length;
    const maxLayers = 15;
    const layers = Math.min(Math.ceil(discardCount / 10), maxLayers);
    return Array.from({ length: layers }, (_, i) => i);
  }

  openSettings(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '500px',
    });
  }
}
