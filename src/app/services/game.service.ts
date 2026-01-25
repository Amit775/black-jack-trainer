import { Injectable, inject, signal, computed } from '@angular/core';
import { CardService, Card, Hand } from './card.service';
import { GameSettingsService } from './game-settings.service';
import { BalanceService } from './balance.service';

export type GamePhase = 'betting' | 'insurance' | 'playing' | 'dealer-turn' | 'resolved';
export type GameResult = 'win' | 'lose' | 'push' | 'blackjack' | null;

export interface GameState {
  shoe: Card[];
  playerHands: Hand[];
  activeHandIndex: number;
  dealerHand: Hand;
  phase: GamePhase;
  currentBet: number;
  insuranceBet: number;
  result: GameResult;
  message: string;
}

const INITIAL_STATE: GameState = {
  shoe: [],
  playerHands: [],
  activeHandIndex: 0,
  dealerHand: {
    cards: [],
    bet: 0,
    isDoubledDown: false,
    isSplit: false,
    isStanding: false,
    isBusted: false,
  },
  phase: 'betting',
  currentBet: 0,
  insuranceBet: 0,
  result: null,
  message: 'Place your bet to start',
};

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private readonly cardService = inject(CardService);
  private readonly settingsService = inject(GameSettingsService);
  private readonly balanceService = inject(BalanceService);

  private readonly _state = signal<GameState>(INITIAL_STATE);

  readonly state = this._state.asReadonly();
  readonly phase = computed(() => this._state().phase);
  readonly playerHands = computed(() => this._state().playerHands);
  readonly activeHand = computed(() => this._state().playerHands[this._state().activeHandIndex]);
  readonly dealerHand = computed(() => this._state().dealerHand);
  readonly currentBet = computed(() => this._state().currentBet);
  readonly insuranceBet = computed(() => this._state().insuranceBet);
  readonly result = computed(() => this._state().result);
  readonly message = computed(() => this._state().message);

  readonly playerHandValue = computed(() => {
    const hand = this.activeHand();
    if (!hand || hand.cards.length === 0) return 0;
    return this.cardService.calculateHandValue(hand.cards).value;
  });

  readonly dealerHandValue = computed(() => {
    const hand = this.dealerHand();
    if (!hand || hand.cards.length === 0) return 0;
    return this.cardService.calculateHandValue(hand.cards).value;
  });

  readonly dealerShowsAce = computed(() => {
    const hand = this.dealerHand();
    if (!hand || hand.cards.length === 0) return false;
    return hand.cards[0]?.faceUp && hand.cards[0]?.rank === 'A';
  });

  readonly canTakeInsurance = computed(() => {
    const state = this._state();
    if (state.phase !== 'insurance') return false;
    if (!this.settingsService.insuranceAllowed()) return false;
    const maxInsurance = state.currentBet / 2;
    return this.balanceService.balance() >= maxInsurance;
  });

  readonly canHit = computed(() => {
    const state = this._state();
    if (state.phase !== 'playing') return false;
    const hand = state.playerHands[state.activeHandIndex];
    return hand && !hand.isStanding && !hand.isBusted;
  });

  readonly canStand = computed(() => this._state().phase === 'playing');

  readonly canDoubleDown = computed(() => {
    const state = this._state();
    if (state.phase !== 'playing') return false;
    if (!this.settingsService.doubleDownAllowed()) return false;
    const hand = state.playerHands[state.activeHandIndex];
    if (!hand || hand.cards.length !== 2) return false;
    return this.balanceService.balance() >= state.currentBet;
  });

  readonly canSplit = computed(() => {
    const state = this._state();
    if (state.phase !== 'playing') return false;
    if (!this.settingsService.splitAllowed()) return false;
    const hand = state.playerHands[state.activeHandIndex];
    if (!hand || hand.cards.length !== 2) return false;
    if (hand.isSplit) return false; // Can't re-split for now
    if (!this.cardService.canSplit(hand.cards)) return false;
    return this.balanceService.balance() >= state.currentBet;
  });

  initializeShoe(): void {
    const shoe = this.cardService.createShoe(this.settingsService.numberOfDecks());
    this._state.update((s) => ({ ...s, shoe }));
  }

  placeBet(amount: number): boolean {
    if (amount <= 0 || amount > this.balanceService.balance()) return false;
    if (this._state().phase !== 'betting') return false;

    if (!this.balanceService.deductBet(amount)) return false;

    this._state.update((s) => ({
      ...s,
      currentBet: amount,
      message: 'Dealing cards...',
    }));

    this.dealInitialCards();
    return true;
  }

  private dealInitialCards(): void {
    const state = this._state();
    let shoe = [...state.shoe];

    if (shoe.length < 20) {
      shoe = this.cardService.createShoe(this.settingsService.numberOfDecks());
    }

    const playerCard1 = { ...shoe.pop()!, faceUp: true };
    const dealerCard1 = { ...shoe.pop()!, faceUp: true };
    const playerCard2 = { ...shoe.pop()!, faceUp: true };
    const dealerCard2 = { ...shoe.pop()!, faceUp: false };

    const playerHand = this.cardService.createEmptyHand(state.currentBet);
    playerHand.cards = [playerCard1, playerCard2];

    const dealerHand = this.cardService.createEmptyHand();
    dealerHand.cards = [dealerCard1, dealerCard2];

    // Check if dealer shows an Ace and insurance is allowed
    const dealerShowsAce = dealerCard1.rank === 'A';
    const insuranceAllowed = this.settingsService.insuranceAllowed();
    const canAffordInsurance = this.balanceService.balance() >= state.currentBet / 2;

    if (dealerShowsAce && insuranceAllowed && canAffordInsurance) {
      this._state.update((s) => ({
        ...s,
        shoe,
        playerHands: [playerHand],
        activeHandIndex: 0,
        dealerHand,
        phase: 'insurance',
        message: 'Dealer shows Ace. Insurance?',
      }));
    } else {
      this._state.update((s) => ({
        ...s,
        shoe,
        playerHands: [playerHand],
        activeHandIndex: 0,
        dealerHand,
        phase: 'playing',
        message: 'Your turn',
      }));

      // Check for blackjacks
      if (this.cardService.isBlackjack(playerHand.cards)) {
        this.checkBlackjacks();
      }
    }
  }

  takeInsurance(): void {
    const state = this._state();
    if (state.phase !== 'insurance') return;

    const insuranceAmount = state.currentBet / 2;
    if (!this.balanceService.deductBet(insuranceAmount)) return;

    this._state.update((s) => ({
      ...s,
      insuranceBet: insuranceAmount,
      phase: 'playing',
      message: 'Insurance taken. Your turn.',
    }));

    // Check for player blackjack
    if (this.cardService.isBlackjack(state.playerHands[0].cards)) {
      this.checkBlackjacks();
    }
  }

  declineInsurance(): void {
    const state = this._state();
    if (state.phase !== 'insurance') return;

    this._state.update((s) => ({
      ...s,
      phase: 'playing',
      message: 'Your turn',
    }));

    // Check for player blackjack
    if (this.cardService.isBlackjack(state.playerHands[0].cards)) {
      this.checkBlackjacks();
    }
  }

  private checkBlackjacks(): void {
    const state = this._state();
    const playerHand = state.playerHands[0];
    const dealerCards = [...state.dealerHand.cards];

    const playerHasBlackjack = this.cardService.isBlackjack(playerHand.cards);

    // Reveal dealer's hole card
    dealerCards[1] = { ...dealerCards[1], faceUp: true };
    const dealerHasBlackjack = this.cardService.isBlackjack(dealerCards);

    // Handle insurance payout
    if (state.insuranceBet > 0 && dealerHasBlackjack) {
      // Insurance pays 2:1
      this.balanceService.addWinnings(state.insuranceBet * 3);
    }

    // Update dealer hand with revealed card
    this._state.update((s) => ({
      ...s,
      dealerHand: { ...s.dealerHand, cards: dealerCards },
    }));

    if (playerHasBlackjack && dealerHasBlackjack) {
      const message =
        state.insuranceBet > 0
          ? 'Both have Blackjack - Push! Insurance paid.'
          : 'Both have Blackjack - Push!';
      this.resolveGame('push', message);
    } else if (playerHasBlackjack) {
      const winnings = state.currentBet + state.currentBet * this.settingsService.blackjackPays();
      this.balanceService.addWinnings(winnings);
      this.resolveGame('blackjack', 'Blackjack! You win!');
    } else if (dealerHasBlackjack) {
      const message =
        state.insuranceBet > 0
          ? 'Dealer has Blackjack. Insurance paid!'
          : 'Dealer has Blackjack. You lose.';
      this.resolveGame('lose', message);
    }
  }

  hit(): void {
    if (!this.canHit()) return;

    const state = this._state();
    let shoe = [...state.shoe];
    const playerHands = [...state.playerHands];
    const hand = { ...playerHands[state.activeHandIndex] };

    const newCard = { ...shoe.pop()!, faceUp: true };
    hand.cards = [...hand.cards, newCard];

    if (this.cardService.isBusted(hand.cards)) {
      hand.isBusted = true;
    }

    playerHands[state.activeHandIndex] = hand;

    this._state.update((s) => ({
      ...s,
      shoe,
      playerHands,
      message: hand.isBusted ? 'Busted!' : 'Your turn',
    }));

    if (hand.isBusted) {
      this.moveToNextHand();
    }
  }

  stand(): void {
    if (!this.canStand()) return;

    const state = this._state();
    const playerHands = [...state.playerHands];
    const hand = { ...playerHands[state.activeHandIndex] };
    hand.isStanding = true;
    playerHands[state.activeHandIndex] = hand;

    this._state.update((s) => ({
      ...s,
      playerHands,
    }));

    this.moveToNextHand();
  }

  doubleDown(): void {
    if (!this.canDoubleDown()) return;

    const state = this._state();

    if (!this.balanceService.deductBet(state.currentBet)) return;

    let shoe = [...state.shoe];
    const playerHands = [...state.playerHands];
    const hand = { ...playerHands[state.activeHandIndex] };

    hand.bet *= 2;
    hand.isDoubledDown = true;

    const newCard = { ...shoe.pop()!, faceUp: true };
    hand.cards = [...hand.cards, newCard];

    if (this.cardService.isBusted(hand.cards)) {
      hand.isBusted = true;
    }
    hand.isStanding = true;

    playerHands[state.activeHandIndex] = hand;

    this._state.update((s) => ({
      ...s,
      shoe,
      playerHands,
      currentBet: state.currentBet * 2,
      message: hand.isBusted ? 'Busted!' : 'Doubled down',
    }));

    this.moveToNextHand();
  }

  split(): void {
    if (!this.canSplit()) return;

    const state = this._state();

    // Deduct bet for second hand
    if (!this.balanceService.deductBet(state.currentBet)) return;

    let shoe = [...state.shoe];
    const playerHands = [...state.playerHands];
    const currentHand = playerHands[state.activeHandIndex];

    // Create two new hands from the split
    const hand1 = this.cardService.createEmptyHand(currentHand.bet);
    hand1.cards = [currentHand.cards[0], { ...shoe.pop()!, faceUp: true }];
    hand1.isSplit = true;

    const hand2 = this.cardService.createEmptyHand(currentHand.bet);
    hand2.cards = [currentHand.cards[1], { ...shoe.pop()!, faceUp: true }];
    hand2.isSplit = true;

    // Replace current hand with two split hands
    playerHands.splice(state.activeHandIndex, 1, hand1, hand2);

    this._state.update((s) => ({
      ...s,
      shoe,
      playerHands,
      message: 'Split! Playing first hand.',
    }));
  }

  private moveToNextHand(): void {
    const state = this._state();
    const nextIndex = state.activeHandIndex + 1;

    if (nextIndex < state.playerHands.length) {
      this._state.update((s) => ({
        ...s,
        activeHandIndex: nextIndex,
        message: 'Next hand',
      }));
    } else {
      this.dealerTurn();
    }
  }

  private dealerTurn(): void {
    const state = this._state();

    // Check if all player hands busted
    const allBusted = state.playerHands.every((h) => h.isBusted);
    if (allBusted) {
      this.resolveGame('lose', 'You busted. Dealer wins.');
      return;
    }

    // Reveal dealer's hole card
    const dealerHand = { ...state.dealerHand };
    dealerHand.cards = dealerHand.cards.map((c) => ({ ...c, faceUp: true }));

    this._state.update((s) => ({
      ...s,
      dealerHand,
      phase: 'dealer-turn',
      message: "Dealer's turn",
    }));

    this.dealerPlay();
  }

  private dealerPlay(): void {
    const state = this._state();
    let shoe = [...state.shoe];
    const dealerHand = { ...state.dealerHand };

    let handValue = this.cardService.calculateHandValue(dealerHand.cards);

    // Dealer draws until 17 or higher
    while (
      handValue.value < 17 ||
      (handValue.value === 17 && handValue.isSoft && this.settingsService.dealerHitsSoft17())
    ) {
      const newCard = { ...shoe.pop()!, faceUp: true };
      dealerHand.cards = [...dealerHand.cards, newCard];
      handValue = this.cardService.calculateHandValue(dealerHand.cards);
    }

    const dealerBusted = handValue.value > 21;

    this._state.update((s) => ({
      ...s,
      shoe,
      dealerHand,
    }));

    this.compareHands(dealerBusted);
  }

  private compareHands(dealerBusted: boolean): void {
    const state = this._state();
    const dealerValue = this.cardService.calculateHandValue(state.dealerHand.cards).value;

    let totalWinnings = 0;
    let resultMessage = '';

    for (const hand of state.playerHands) {
      if (hand.isBusted) continue;

      const playerValue = this.cardService.calculateHandValue(hand.cards).value;

      if (dealerBusted) {
        totalWinnings += hand.bet * 2;
        resultMessage = 'Dealer busted! You win!';
      } else if (playerValue > dealerValue) {
        totalWinnings += hand.bet * 2;
        resultMessage = 'You win!';
      } else if (playerValue === dealerValue) {
        totalWinnings += hand.bet;
        resultMessage = 'Push - bet returned';
      } else {
        resultMessage = 'Dealer wins';
      }
    }

    if (totalWinnings > 0) {
      this.balanceService.addWinnings(totalWinnings);
    }

    const result: GameResult =
      totalWinnings > state.currentBet
        ? 'win'
        : totalWinnings === state.currentBet
          ? 'push'
          : 'lose';

    this.resolveGame(result, resultMessage);
  }

  private resolveGame(result: GameResult, message: string): void {
    // Reveal all cards
    const dealerHand = { ...this._state().dealerHand };
    dealerHand.cards = dealerHand.cards.map((c) => ({ ...c, faceUp: true }));

    this._state.update((s) => ({
      ...s,
      dealerHand,
      phase: 'resolved',
      result,
      message,
    }));
  }

  newGame(): void {
    const shoe =
      this._state().shoe.length > 20
        ? this._state().shoe
        : this.cardService.createShoe(this.settingsService.numberOfDecks());

    this._state.set({
      ...INITIAL_STATE,
      shoe,
    });
  }
}
