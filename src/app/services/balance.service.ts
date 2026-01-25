import { Injectable, computed, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class BalanceService {
  private readonly _balance = signal<number>(0);

  readonly balance = this._balance.asReadonly();
  readonly canPlay = computed(() => this._balance() > 0);

  constructor() {
    this.loadFromStorage();
  }

  deposit(amount: number): boolean {
    if (amount <= 0) return false;
    this._balance.update((b) => b + amount);
    this.saveToStorage();
    return true;
  }

  withdraw(amount: number): boolean {
    if (amount <= 0 || amount > this._balance()) return false;
    this._balance.update((b) => b - amount);
    this.saveToStorage();
    return true;
  }

  deductBet(amount: number): boolean {
    if (amount <= 0 || amount > this._balance()) return false;
    this._balance.update((b) => b - amount);
    this.saveToStorage();
    return true;
  }

  addWinnings(amount: number): void {
    if (amount > 0) {
      this._balance.update((b) => b + amount);
      this.saveToStorage();
    }
  }

  private loadFromStorage(): void {
    // TODO: Implement localStorage loading
    // Placeholder: start with 0 balance
  }

  private saveToStorage(): void {
    // TODO: Implement localStorage saving
  }
}
