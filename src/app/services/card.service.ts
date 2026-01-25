import { Injectable } from '@angular/core';

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export interface Hand {
  cards: Card[];
  bet: number;
  isDoubledDown: boolean;
  isSplit: boolean;
  isStanding: boolean;
  isBusted: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CardService {
  private readonly suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  private readonly ranks: Rank[] = [
    'A',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'J',
    'Q',
    'K',
  ];

  createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of this.suits) {
      for (const rank of this.ranks) {
        deck.push({ suit, rank, faceUp: true });
      }
    }
    return deck;
  }

  createShoe(numberOfDecks: number): Card[] {
    const shoe: Card[] = [];
    for (let i = 0; i < numberOfDecks; i++) {
      shoe.push(...this.createDeck());
    }
    return this.shuffle(shoe);
  }

  shuffle(cards: Card[]): Card[] {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getCardValue(card: Card): number[] {
    if (card.rank === 'A') {
      return [1, 11];
    }
    if (['J', 'Q', 'K'].includes(card.rank)) {
      return [10];
    }
    return [parseInt(card.rank, 10)];
  }

  calculateHandValue(cards: Card[]): { value: number; isSoft: boolean } {
    let value = 0;
    let aces = 0;

    for (const card of cards) {
      if (!card.faceUp) continue;

      if (card.rank === 'A') {
        aces++;
        value += 11;
      } else if (['J', 'Q', 'K'].includes(card.rank)) {
        value += 10;
      } else {
        value += parseInt(card.rank, 10);
      }
    }

    // Convert aces from 11 to 1 as needed
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }

    return {
      value,
      isSoft: aces > 0 && value <= 21,
    };
  }

  isBlackjack(cards: Card[]): boolean {
    if (cards.length !== 2) return false;
    const { value } = this.calculateHandValue(cards);
    return value === 21;
  }

  isBusted(cards: Card[]): boolean {
    return this.calculateHandValue(cards).value > 21;
  }

  canSplit(cards: Card[]): boolean {
    if (cards.length !== 2) return false;
    return this.getCardValue(cards[0])[0] === this.getCardValue(cards[1])[0];
  }

  getCardDisplay(card: Card): string {
    if (!card.faceUp) return '🂠';

    const suitSymbols: Record<Suit, string> = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
    };

    return `${card.rank}${suitSymbols[card.suit]}`;
  }

  getSuitColor(suit: Suit): 'red' | 'black' {
    return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
  }

  createEmptyHand(bet: number = 0): Hand {
    return {
      cards: [],
      bet,
      isDoubledDown: false,
      isSplit: false,
      isStanding: false,
      isBusted: false,
    };
  }
}
