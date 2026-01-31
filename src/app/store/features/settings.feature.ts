import { computed } from '@angular/core';
import {
  signalStoreFeature,
  withComputed,
  withMethods,
  withState,
  patchState,
} from '@ngrx/signals';
import { GameSettings, SettingsState, DEFAULT_SETTINGS } from '../models';

const INITIAL_SETTINGS_STATE: SettingsState = {
  settings: DEFAULT_SETTINGS,
};

export function withSettings() {
  return signalStoreFeature(
    withState(INITIAL_SETTINGS_STATE),

    withComputed((store) => ({
      numberOfDecks: computed(() => store.settings().numberOfDecks),
      dealerHitsSoft17: computed(() => store.settings().dealerHitsSoft17),
      blackjackPays: computed(() => store.settings().blackjackPays),
      doubleDownAllowed: computed(() => store.settings().doubleDownAllowed),
      splitAllowed: computed(() => store.settings().splitAllowed),
      insuranceAllowed: computed(() => store.settings().insuranceAllowed),
      surrenderAllowed: computed(() => store.settings().surrenderAllowed),
    })),

    withMethods((store) => ({
      updateSettings(partial: Partial<GameSettings>): void {
        patchState(store, {
          settings: { ...store.settings(), ...partial },
        });
      },

      resetSettings(): void {
        patchState(store, { settings: DEFAULT_SETTINGS });
      },
    })),
  );
}
