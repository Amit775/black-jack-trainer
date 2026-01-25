import { Injectable, inject, signal, computed } from '@angular/core';
import { CardService, Card, Hand, Box, BoxPosition } from './card.service';
import { GameSettingsService } from './game-settings.service';
import { BalanceService } from './balance.service';

export type GamePhase = 'betting' | 'insurance' | 'playing' | 'dealer-turn' | 'resolved';
export type GameResult = 'win' | 'lose' | 'push' | 'blackjack' | null;

export interface GameState {
  shoe: Card[];
  boxes: Box[];
  activeBoxIndex: number;
  dealerHand: Hand;
  phase: GamePhase;
  insuranceBet: number;
  result: GameResult;
  message: string;
}

const createInitialBoxes = (): Box[] => [
  { position: 'left', hands: [], activeHandIndex: 0, bet: 0, isActive: false, isResolved: false },
  { position: 'center', hands: [], activeHandIndex: 0, bet: 0, isActive: true, isResolved: false },
  { position: 'right', hands: [], activeHandIndex: 0, bet: 0, isActive: false, isResolved: false },
];

const INITIAL_STATE: GameState = {
  shoe: [],
  boxes: createInitialBoxes(),
  activeBoxIndex: 1, // Center box is default
  dealerHand: {
    cards: [],
    bet: 0,
    isDoubledDown: false,
    isSplit: false,
    isStanding: false,
    isBusted: false,
  },
  phase: 'betting',
  insuranceBet: 0,
  result: null,
  message: 'Place your bets to start',
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
  readonly boxes = computed(() => this._state().boxes);
  readonly activeBoxIndex = computed(() => this._state().activeBoxIndex);
  readonly activeBox = computed(() => this._state().boxes[this._state().activeBoxIndex]);
  readonly dealerHand = computed(() => this._state().dealerHand);
  readonly insuranceBet = computed(() => this._state().insuranceBet);
  readonly result = computed(() => this._state().result);
  readonly message = computed(() => this._state().message);

  readonly activeHand = computed(() => {
    const box = this.activeBox();
    if (!box || box.hands.length === 0) return null;
    return box.hands[box.activeHandIndex];
  });

  readonly playerHands = computed(() => {
    const box = this.activeBox();
    return box?.hands || [];
  });

  readonly currentBet = computed(() => {
    return this._state().boxes.reduce((total, box) => total + (box.isActive ? box.bet : 0), 0);
  });

  readonly totalBetsPlaced = computed(() => {
    return this._state().boxes.reduce((total, box) => {
      if (!box.isActive) return total;
      return total + box.hands.reduce((handTotal, hand) => handTotal + hand.bet, 0);
    }, 0);
  });

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

  readonly activeBoxes = computed(() => this._state().boxes.filter(b => b.isActive));

  readonly canTakeInsurance = computed(() => {
    const state = this._state();
    if (state.phase !== 'insurance') return false;
    if (!this.settingsService.insuranceAllowed()) return false;
    const totalBet = this.currentBet();
    const maxInsurance = totalBet / 2;
    return this.balanceService.balance() >= maxInsurance;
  });

  readonly canHit = computed(() => {
    const state = this._state();
    if (state.phase !== 'playing') return false;
    const hand = this.activeHand();
    return hand && !hand.isStanding && !hand.isBusted;
  });

  readonly canStand = computed(() => this._state().phase === 'playing');

  readonly canDoubleDown = computed(() => {
    const state = this._state();
    if (state.phase !== 'playing') return false;
    if (!this.settingsService.doubleDownAllowed()) return false;
    const hand = this.activeHand();
    if (!hand || hand.cards.length !== 2) return false;
    return this.balanceService.balance() >= hand.bet;
  });

  readonly canSplit = computed(() => {
    const state = this._state();
    if (state.phase !== 'playing') return false;
    if (!this.settingsService.splitAllowed()) return false;
    const hand = this.activeHand();
    if (!hand || hand.cards.length !== 2) return false;
    if (hand.isSplit) return false;
    if (!this.cardService.canSplit(hand.cards)) return false;
    return this.balanceService.balance() >= hand.bet;
  });

  initializeShoe(): void {
    const shoe = this.cardService.createShoe(this.settingsService.numberOfDecks());
    this._state.update((s) => ({ ...s, shoe }));
  }

  toggleBox(position: BoxPosition): void {
    if (this._state().phase !== 'betting') return;

    this._state.update((s) => {
      const boxes = s.boxes.map(box => {
        if (box.position === position) {
          // Don't allow deactivating if it's the only active box
          if (box.isActive && s.boxes.filter(b => b.isActive).length <= 1) {
            return box;
          }
          return { ...box, isActive: !box.isActive, bet: box.isActive ? 0 : box.bet };
        }
        return box;
      });
      return { ...s, boxes };
    });
  }

  setBoxBet(position: BoxPosition, amount: number): void {
    if (this._state().phase !== 'betting') return;
    if (amount < 0) return;

    const box = this._state().boxes.find(b => b.position === position);
    if (!box || !box.isActive) return;

    // Calculate total bet with new amount
    const otherBoxesBet = this._state().boxes
      .filter(b => b.isActive && b.position !== position)
      .reduce((sum, b) => sum + b.bet, 0);
    
    if (otherBoxesBet + amount > this.balanceService.balance()) return;

    this._state.update((s) => ({
      ...s,
      boxes: s.boxes.map(b => 
        b.position === position ? { ...b, bet: amount } : b
      ),
    }));
  }

  placeBets(): boolean {
    const state = this._state();
    if (state.phase !== 'betting') return false;

    const activeBoxes = state.boxes.filter(b => b.isActive);
    const totalBet = activeBoxes.reduce((sum, b) => sum + b.bet, 0);

    if (totalBet <= 0 || totalBet > this.balanceService.balance()) return false;
    if (activeBoxes.some(b => b.bet <= 0)) return false;

    if (!this.balanceService.deductBet(totalBet)) return false;

    this._state.update((s) => ({
      ...s,
      message: 'Dealing cards...',
    }));

    this.dealInitialCards();
    return true;
  }

  // Legacy method for compatibility
  placeBet(amount: number): boolean {
    this.setBoxBet('center', amount);
    return this.placeBets();
  }

  private dealInitialCards(): void {
    const state = this._state();
    let shoe = [...state.shoe];

    if (shoe.length < 52) {
      shoe = this.cardService.createShoe(this.settingsService.numberOfDecks());
    }

    // Get active boxes in order: left, center, right
    const boxOrder: BoxPosition[] = ['left', 'center', 'right'];
    const activePositions = boxOrder.filter(pos => 
      state.boxes.find(b => b.position === pos)?.isActive
    );

    // Deal first card to each active box
    const boxes = state.boxes.map(box => {
      if (!box.isActive) return box;
      const card1 = { ...shoe.pop()!, faceUp: true };
      const hand = this.cardService.createEmptyHand(box.bet);
      hand.cards = [card1];
      return { ...box, hands: [hand], activeHandIndex: 0, isResolved: false };
    });

    // Deal first card to dealer
    const dealerCard1 = { ...shoe.pop()!, faceUp: true };

    // Deal second card to each active box
    const boxesWithSecondCard = boxes.map(box => {
      if (!box.isActive) return box;
      const card2 = { ...shoe.pop()!, faceUp: true };
      const hand = { ...box.hands[0] };
      hand.cards = [...hand.cards, card2];
      return { ...box, hands: [hand] };
    });

    // Deal second card to dealer (face down)
    const dealerCard2 = { ...shoe.pop()!, faceUp: false };

    const dealerHand = this.cardService.createEmptyHand();
    dealerHand.cards = [dealerCard1, dealerCard2];

    // Find first active box for play order
    const firstActiveIndex = boxesWithSecondCard.findIndex(b => b.isActive);

    // Check if dealer shows an Ace and insurance is allowed
    const dealerShowsAce = dealerCard1.rank === 'A';
    const insuranceAllowed = this.settingsService.insuranceAllowed();
    const totalBet = activePositions.reduce((sum, pos) => {
      const box = boxesWithSecondCard.find(b => b.position === pos);
      return sum + (box?.bet || 0);
    }, 0);
    const canAffordInsurance = this.balanceService.balance() >= totalBet / 2;

    if (dealerShowsAce && insuranceAllowed && canAffordInsurance) {
      this._state.update((s) => ({
        ...s,
        shoe,
        boxes: boxesWithSecondCard,
        activeBoxIndex: firstActiveIndex,
        dealerHand,
        phase: 'insurance',
        message: 'Dealer shows Ace. Insurance?',
      }));
    } else {
      this._state.update((s) => ({
        ...s,
        shoe,
        boxes: boxesWithSecondCard,
        activeBoxIndex: firstActiveIndex,
        dealerHand,
        phase: 'playing',
        message: 'Your turn',
      }));

      // Check for blackjacks on all hands
      this.checkInitialBlackjacks();
    }
  }

  takeInsurance(): void {
    const state = this._state();
    if (state.phase !== 'insurance') return;

    const totalBet = this.currentBet();
    const insuranceAmount = totalBet / 2;
    if (!this.balanceService.deductBet(insuranceAmount)) return;

    this._state.update((s) => ({
      ...s,
      insuranceBet: insuranceAmount,
      phase: 'playing',
      message: 'Insurance taken. Your turn.',
    }));

    this.checkInitialBlackjacks();
  }

  declineInsurance(): void {
    const state = this._state();
    if (state.phase !== 'insurance') return;

    this._state.update((s) => ({
      ...s,
      phase: 'playing',
      message: 'Your turn',
    }));

    this.checkInitialBlackjacks();
  }

  private checkInitialBlackjacks(): void {
    const state = this._state();
    const dealerCards = [...state.dealerHand.cards];
    dealerCards[1] = { ...dealerCards[1], faceUp: true };
    const dealerHasBlackjack = this.cardService.isBlackjack(dealerCards);

    // Handle insurance payout first
    if (state.insuranceBet > 0 && dealerHasBlackjack) {
      this.balanceService.addWinnings(state.insuranceBet * 3);
    }

    // Check each box for blackjack
    let allResolved = true;
    const boxes = state.boxes.map(box => {
      if (!box.isActive) return box;
      
      const hand = box.hands[0];
      const playerHasBlackjack = this.cardService.isBlackjack(hand.cards);

      if (playerHasBlackjack) {
        if (dealerHasBlackjack) {
          // Push - return bet
          this.balanceService.addWinnings(hand.bet);
          return { ...box, hands: [{ ...hand, result: 'push' as const }], isResolved: true };
        } else {
          // Player blackjack wins
          const winnings = hand.bet + hand.bet * this.settingsService.blackjackPays();
          this.balanceService.addWinnings(winnings);
          return { ...box, hands: [{ ...hand, result: 'blackjack' as const }], isResolved: true };
        }
      } else if (dealerHasBlackjack) {
        // Dealer blackjack wins
        return { ...box, hands: [{ ...hand, result: 'lose' as const }], isResolved: true };
      }

      allResolved = false;
      return box;
    });

    if (dealerHasBlackjack || allResolved) {
      // Reveal dealer cards and resolve
      this._state.update((s) => ({
        ...s,
        boxes,
        dealerHand: { ...s.dealerHand, cards: dealerCards },
        phase: 'resolved',
        result: allResolved ? 'blackjack' : 'lose',
        message: dealerHasBlackjack 
          ? (state.insuranceBet > 0 ? 'Dealer Blackjack! Insurance paid.' : 'Dealer Blackjack!')
          : 'Blackjack!',
      }));
    } else {
      // Find first non-resolved active box
      const firstPlayableIndex = boxes.findIndex(b => b.isActive && !b.isResolved);
      this._state.update((s) => ({
        ...s,
        boxes,
        activeBoxIndex: firstPlayableIndex >= 0 ? firstPlayableIndex : s.activeBoxIndex,
      }));
    }
  }

  hit(): void {
    if (!this.canHit()) return;

    const state = this._state();
    let shoe = [...state.shoe];
    const boxes = [...state.boxes];
    const box = { ...boxes[state.activeBoxIndex] };
    const hands = [...box.hands];
    const hand = { ...hands[box.activeHandIndex] };

    const newCard = { ...shoe.pop()!, faceUp: true };
    hand.cards = [...hand.cards, newCard];

    if (this.cardService.isBusted(hand.cards)) {
      hand.isBusted = true;
      hand.result = 'lose';
    }

    hands[box.activeHandIndex] = hand;
    box.hands = hands;
    boxes[state.activeBoxIndex] = box;

    this._state.update((s) => ({
      ...s,
      shoe,
      boxes,
      message: hand.isBusted ? 'Busted!' : 'Your turn',
    }));

    if (hand.isBusted) {
      this.moveToNextHand();
    }
  }

  stand(): void {
    if (!this.canStand()) return;

    const state = this._state();
    const boxes = [...state.boxes];
    const box = { ...boxes[state.activeBoxIndex] };
    const hands = [...box.hands];
    const hand = { ...hands[box.activeHandIndex] };
    
    hand.isStanding = true;
    hands[box.activeHandIndex] = hand;
    box.hands = hands;
    boxes[state.activeBoxIndex] = box;

    this._state.update((s) => ({
      ...s,
      boxes,
    }));

    this.moveToNextHand();
  }

  doubleDown(): void {
    if (!this.canDoubleDown()) return;

    const state = this._state();
    const hand = this.activeHand();
    if (!hand) return;

    if (!this.balanceService.deductBet(hand.bet)) return;

    let shoe = [...state.shoe];
    const boxes = [...state.boxes];
    const box = { ...boxes[state.activeBoxIndex] };
    const hands = [...box.hands];
    const updatedHand = { ...hands[box.activeHandIndex] };

    updatedHand.bet *= 2;
    updatedHand.isDoubledDown = true;

    const newCard = { ...shoe.pop()!, faceUp: true };
    updatedHand.cards = [...updatedHand.cards, newCard];

    if (this.cardService.isBusted(updatedHand.cards)) {
      updatedHand.isBusted = true;
      updatedHand.result = 'lose';
    }
    updatedHand.isStanding = true;

    hands[box.activeHandIndex] = updatedHand;
    box.hands = hands;
    boxes[state.activeBoxIndex] = box;

    this._state.update((s) => ({
      ...s,
      shoe,
      boxes,
      message: updatedHand.isBusted ? 'Busted!' : 'Doubled down',
    }));

    this.moveToNextHand();
  }

  split(): void {
    if (!this.canSplit()) return;

    const state = this._state();
    const hand = this.activeHand();
    if (!hand) return;

    if (!this.balanceService.deductBet(hand.bet)) return;

    let shoe = [...state.shoe];
    const boxes = [...state.boxes];
    const box = { ...boxes[state.activeBoxIndex] };

    const currentHand = box.hands[box.activeHandIndex];

    // Create two new hands from the split
    const hand1 = this.cardService.createEmptyHand(currentHand.bet);
    hand1.cards = [currentHand.cards[0], { ...shoe.pop()!, faceUp: true }];
    hand1.isSplit = true;

    const hand2 = this.cardService.createEmptyHand(currentHand.bet);
    hand2.cards = [currentHand.cards[1], { ...shoe.pop()!, faceUp: true }];
    hand2.isSplit = true;

    // Replace current hand with two split hands
    const hands = [...box.hands];
    hands.splice(box.activeHandIndex, 1, hand1, hand2);
    box.hands = hands;
    boxes[state.activeBoxIndex] = box;

    this._state.update((s) => ({
      ...s,
      shoe,
      boxes,
      message: 'Split! Playing first hand.',
    }));
  }

  private moveToNextHand(): void {
    const state = this._state();
    const box = state.boxes[state.activeBoxIndex];
    const nextHandIndex = box.activeHandIndex + 1;

    if (nextHandIndex < box.hands.length) {
      // Move to next hand in current box
      const boxes = [...state.boxes];
      boxes[state.activeBoxIndex] = { ...box, activeHandIndex: nextHandIndex };
      this._state.update((s) => ({
        ...s,
        boxes,
        message: 'Next hand',
      }));
    } else {
      // Mark current box as resolved and move to next active box
      this.moveToNextBox();
    }
  }

  private moveToNextBox(): void {
    const state = this._state();
    const boxes = [...state.boxes];
    boxes[state.activeBoxIndex] = { ...boxes[state.activeBoxIndex], isResolved: true };

    // Find next active, non-resolved box
    let nextBoxIndex = -1;
    for (let i = state.activeBoxIndex + 1; i < boxes.length; i++) {
      if (boxes[i].isActive && !boxes[i].isResolved) {
        nextBoxIndex = i;
        break;
      }
    }

    if (nextBoxIndex >= 0) {
      this._state.update((s) => ({
        ...s,
        boxes,
        activeBoxIndex: nextBoxIndex,
        message: 'Next box',
      }));
    } else {
      this._state.update((s) => ({
        ...s,
        boxes,
      }));
      this.dealerTurn();
    }
  }

  private dealerTurn(): void {
    const state = this._state();

    // Check if all player hands busted
    const allBusted = state.boxes
      .filter(b => b.isActive)
      .every(b => b.hands.every(h => h.isBusted));

    if (allBusted) {
      this.resolveGame('lose', 'All hands busted. Dealer wins.');
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
    let wins = 0;
    let losses = 0;
    let pushes = 0;

    const boxes = state.boxes.map(box => {
      if (!box.isActive) return box;

      const hands = box.hands.map(hand => {
        if (hand.isBusted || hand.result) return hand;

        const playerValue = this.cardService.calculateHandValue(hand.cards).value;
        const updatedHand = { ...hand };

        if (dealerBusted) {
          totalWinnings += hand.bet * 2;
          updatedHand.result = 'win';
          wins++;
        } else if (playerValue > dealerValue) {
          totalWinnings += hand.bet * 2;
          updatedHand.result = 'win';
          wins++;
        } else if (playerValue === dealerValue) {
          totalWinnings += hand.bet;
          updatedHand.result = 'push';
          pushes++;
        } else {
          updatedHand.result = 'lose';
          losses++;
        }

        return updatedHand;
      });

      return { ...box, hands };
    });

    if (totalWinnings > 0) {
      this.balanceService.addWinnings(totalWinnings);
    }

    let resultMessage = '';
    if (dealerBusted) {
      resultMessage = 'Dealer busted!';
    } else if (wins > 0 && losses === 0) {
      resultMessage = 'You win!';
    } else if (losses > 0 && wins === 0) {
      resultMessage = 'Dealer wins';
    } else if (pushes > 0 && wins === 0 && losses === 0) {
      resultMessage = 'Push';
    } else {
      resultMessage = `${wins} win${wins !== 1 ? 's' : ''}, ${losses} loss${losses !== 1 ? 'es' : ''}, ${pushes} push${pushes !== 1 ? 'es' : ''}`;
    }

    const result: GameResult = wins > losses ? 'win' : wins < losses ? 'lose' : 'push';

    this._state.update((s) => ({
      ...s,
      boxes,
    }));

    this.resolveGame(result, resultMessage);
  }

  private resolveGame(result: GameResult, message: string): void {
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

  getHandValue(hand: Hand): number {
    return this.cardService.calculateHandValue(hand.cards).value;
  }

  newGame(): void {
    const currentShoe = this._state().shoe;
    const shoe = currentShoe.length > 52
      ? currentShoe
      : this.cardService.createShoe(this.settingsService.numberOfDecks());

    // Preserve active boxes and their bet amounts
    const previousBoxes = this._state().boxes;
    const boxes = createInitialBoxes().map((box, index) => ({
      ...box,
      isActive: previousBoxes[index].isActive,
      bet: previousBoxes[index].bet,
    }));

    this._state.set({
      ...INITIAL_STATE,
      shoe,
      boxes,
    });
  }
}
