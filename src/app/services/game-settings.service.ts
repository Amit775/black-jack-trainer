import { Injectable, signal, computed } from '@angular/core';

export interface GameSettings {
  numberOfDecks: number;
  dealerHitsSoft17: boolean;
  blackjackPays: number; // 1.5 for 3:2, 1.2 for 6:5
  doubleDownAllowed: boolean;
  splitAllowed: boolean;
  insuranceAllowed: boolean;
  surrenderAllowed: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  numberOfDecks: 6,
  dealerHitsSoft17: true,
  blackjackPays: 1.5,
  doubleDownAllowed: true,
  splitAllowed: true,
  insuranceAllowed: true,
  surrenderAllowed: false,
};

@Injectable({
  providedIn: 'root',
})
export class GameSettingsService {
  private readonly _settings = signal<GameSettings>(DEFAULT_SETTINGS);

  readonly settings = this._settings.asReadonly();
  readonly numberOfDecks = computed(() => this._settings().numberOfDecks);
  readonly dealerHitsSoft17 = computed(() => this._settings().dealerHitsSoft17);
  readonly blackjackPays = computed(() => this._settings().blackjackPays);
  readonly doubleDownAllowed = computed(() => this._settings().doubleDownAllowed);
  readonly splitAllowed = computed(() => this._settings().splitAllowed);
  readonly insuranceAllowed = computed(() => this._settings().insuranceAllowed);
  readonly surrenderAllowed = computed(() => this._settings().surrenderAllowed);

  constructor() {
    this.loadFromStorage();
  }

  updateSettings(partial: Partial<GameSettings>): void {
    this._settings.update((current) => ({
      ...current,
      ...partial,
    }));
    this.saveToStorage();
  }

  resetToDefaults(): void {
    this._settings.set(DEFAULT_SETTINGS);
    this.saveToStorage();
  }

  private loadFromStorage(): void {
    // TODO: Implement localStorage loading
  }

  private saveToStorage(): void {
    // TODO: Implement localStorage saving
  }
}
