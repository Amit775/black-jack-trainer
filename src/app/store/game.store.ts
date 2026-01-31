import { signalStore, withHooks } from '@ngrx/signals';
import { withBalance } from './features/balance.feature';
import { withSettings } from './features/settings.feature';
import { withShoe } from './features/shoe.feature';
import { withGame } from './features/game.feature';

/**
 * BlackjackStore - Main application store
 *
 * Composed of feature slices:
 * - withBalance: Player bankroll management
 * - withSettings: Game configuration (rules, decks, payouts)
 * - withShoe: Card deck/shoe management
 * - withGame: Core game state and actions
 *
 * Usage:
 * ```typescript
 * const store = inject(BlackjackStore);
 *
 * // Read state
 * store.balance();
 * store.phase();
 * store.canHit();
 *
 * // Actions
 * store.deposit(1000);
 * store.placeBets();
 * store.hit();
 * store.stand();
 * ```
 */
export const BlackjackStore = signalStore(
  { providedIn: 'root' },

  // Feature slices (order matters - game depends on balance, settings, shoe)
  withBalance(),
  withSettings(),
  withShoe(),
  withGame(),

  // Lifecycle hooks
  withHooks({
    onInit(store) {
      // Initialize shoe on first load
      store.initializeShoe(store.numberOfDecks());
    },
  }),
);

// Type export for dependency injection
export type BlackjackStore = InstanceType<typeof BlackjackStore>;
