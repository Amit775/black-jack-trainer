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
import { CardService, Card } from '../../services/card.service';
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

  protected betAmount = 10;
  protected readonly betChips = [5, 10, 25, 50, 100];

  ngOnInit(): void {
    this.gameService.initializeShoe();
    this.gameService.newGame();
  }

  placeBet(): void {
    if (this.betAmount > 0 && this.betAmount <= this.balanceService.balance()) {
      this.gameService.placeBet(this.betAmount);
    }
  }

  selectBetChip(amount: number): void {
    if (amount <= this.balanceService.balance()) {
      this.betAmount = amount;
    }
  }

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

  openSettings(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '500px',
    });
  }

  getCardDisplay(card: Card): string {
    return this.cardService.getCardDisplay(card);
  }

  getCardColor(card: Card): string {
    return this.cardService.getSuitColor(card.suit);
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
}
