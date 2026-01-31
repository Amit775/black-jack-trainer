/**
 * Centralized animation timing configuration
 * All animation durations and delays are defined here for consistency
 */

// ============================================================================
// Card Animation Timings (in milliseconds)
// ============================================================================

/** Duration for a card to slide in from the shoe */
export const CARD_DEAL_DURATION = 400;

/** Duration for the card flip animation (revealing face-down cards) */
export const CARD_FLIP_DURATION = 500;

/** Delay between dealing consecutive cards during initial deal */
export const DEAL_STAGGER_DELAY = 200;

/** Duration for split card movement animation */
export const SPLIT_ANIMATION_DURATION = 300;

/** Small buffer after animations complete before next action */
export const ANIMATION_BUFFER = 50;

// ============================================================================
// Game Flow Animation Timings
// ============================================================================

/** Delay before dealer starts playing after all player hands complete */
export const DEALER_TURN_DELAY = 400;

/** Delay between dealer drawing cards */
export const DEALER_HIT_DELAY = 600;

/** Delay before revealing hole card */
export const HOLE_CARD_REVEAL_DELAY = 300;

/** Duration to show result state before allowing new game */
export const RESULT_DISPLAY_DELAY = 1000;

// ============================================================================
// Visual Effect Timings
// ============================================================================

/** Duration for result badge fade-in */
export const RESULT_FADE_DURATION = 300;

/** Duration for hand value counter animation */
export const VALUE_UPDATE_DURATION = 200;

/** Duration for chip stack animations */
export const CHIP_ANIMATION_DURATION = 200;

// ============================================================================
// Easing Functions (CSS timing functions)
// ============================================================================

export const EASE_OUT_CUBIC = 'cubic-bezier(0.33, 1, 0.68, 1)';
export const EASE_IN_OUT_CUBIC = 'cubic-bezier(0.65, 0, 0.35, 1)';
export const EASE_OUT_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
export const EASE_SPRING = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';

// ============================================================================
// Animation State Types
// ============================================================================

export type AnimationPhase =
  | 'idle'
  | 'dealing-initial'
  | 'dealing-player'
  | 'dealing-dealer'
  | 'revealing-hole-card'
  | 'player-hit'
  | 'dealer-hit'
  | 'resolving';

// ============================================================================
// CSS Custom Properties Configuration
// ============================================================================

export const CSS_ANIMATION_VARS = {
  '--card-deal-duration': `${CARD_DEAL_DURATION}ms`,
  '--card-flip-duration': `${CARD_FLIP_DURATION}ms`,
  '--deal-stagger-delay': `${DEAL_STAGGER_DELAY}ms`,
  '--ease-out-cubic': EASE_OUT_CUBIC,
  '--ease-spring': EASE_SPRING,
} as const;
