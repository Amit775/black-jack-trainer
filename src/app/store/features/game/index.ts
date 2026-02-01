/**
 * Game Feature Module Exports
 * 
 * This module contains the game state management split into focused, testable units:
 * 
 * - game-helpers.ts: Pure utility functions for game state manipulation
 * - game-actions.ts: Player action implementations (hit, stand, double, split)
 * - dealing-logic.ts: Initial card dealing logic
 * - dealer-logic.ts: Dealer turn mechanics
 * - card-reveal-logic.ts: Animation card reveal handling
 * - game.feature.ts: Main NgRx Signal Store feature (orchestrator)
 */

// Re-export pure functions for testing
export * from './game-helpers';
export * from './game-actions';
export * from './dealing-logic';
export * from './dealer-logic';
export * from './card-reveal-logic';

// Re-export the main feature
export { withGame } from './game.feature';
