import { computed } from '@angular/core';
import {
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
  patchState,
} from '@ngrx/signals';
import { BalanceState } from '../models';

const INITIAL_BALANCE_STATE: BalanceState = {
  balance: 0,
};

export function withBalance() {
  return signalStoreFeature(
    withState(INITIAL_BALANCE_STATE),

    withComputed((store) => ({
      canPlay: computed(() => store.balance() > 0),
    })),

    withMethods((store) => ({
      deposit(amount: number): boolean {
        if (amount <= 0) return false;
        patchState(store, { balance: store.balance() + amount });
        return true;
      },

      withdraw(amount: number): boolean {
        if (amount <= 0 || amount > store.balance()) return false;
        patchState(store, { balance: store.balance() - amount });
        return true;
      },

      deductBet(amount: number): boolean {
        if (amount <= 0 || amount > store.balance()) return false;
        patchState(store, { balance: store.balance() - amount });
        return true;
      },

      addWinnings(amount: number): void {
        if (amount > 0) {
          patchState(store, { balance: store.balance() + amount });
        }
      },

      setBalance(amount: number): void {
        if (amount >= 0) {
          patchState(store, { balance: amount });
        }
      },
    })),
  );
}
