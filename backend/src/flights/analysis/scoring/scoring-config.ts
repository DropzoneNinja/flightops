/**
 * Centralized scoring configuration.
 * All thresholds and category weights are defined here.
 * Adjust these constants to tune scoring without touching scorer logic.
 */
export const SCORING_CONFIG = {
  // ---------------------------------------------------------------------------
  // Category weights — must sum to 1.0
  // ---------------------------------------------------------------------------
  WEIGHTS: {
    takeoff: 0.15,
    climb: 0.10,
    level: 0.15,
    turn: 0.15,
    descent: 0.10,
    landing: 0.20,
    smoothness: 0.10,
    safety: 0.05,
  },

  // ---------------------------------------------------------------------------
  // Takeoff
  // ---------------------------------------------------------------------------
  TAKEOFF: {
    // A climb rate at or above this is considered strong
    IDEAL_CLIMB_RATE_MPS: 1.0,
    // Below this is considered a weak initial climb
    MIN_CLIMB_RATE_MPS: 0.3,
    // VS standard deviation at or below this is considered smooth
    SMOOTH_VS_STDDEV: 0.5,
    // VS standard deviation above this is considered erratic
    ERRATIC_VS_STDDEV: 1.5,
  },

  // ---------------------------------------------------------------------------
  // Climb
  // ---------------------------------------------------------------------------
  CLIMB: {
    // VS std dev at or below this is considered consistent
    IDEAL_VS_STDDEV: 0.4,
    // VS std dev above this is considered erratic
    POOR_VS_STDDEV: 1.8,
  },

  // ---------------------------------------------------------------------------
  // Level flight (cruise)
  // ---------------------------------------------------------------------------
  LEVEL: {
    // Altitude variance (std dev in metres) during cruise considered excellent
    IDEAL_ALT_STDDEV_M: 5,
    // Altitude variance considered poor
    POOR_ALT_STDDEV_M: 30,
    // Minimum cruise duration to score positively (seconds)
    MIN_DURATION_SEC: 30,
    // Minimum cruise duration for "excellent" note (seconds)
    EXCELLENT_DURATION_SEC: 120,
  },

  // ---------------------------------------------------------------------------
  // Turns
  // ---------------------------------------------------------------------------
  TURN: {
    // Heading rate std dev at or below this is considered smooth
    IDEAL_HEADING_RATE_STDDEV: 2.0,
    // Altitude loss per turn that is considered acceptable (metres)
    GOOD_ALT_LOSS_M: 5,
    // Altitude loss per turn that triggers a coaching note (metres)
    POOR_ALT_LOSS_M: 15,
  },

  // ---------------------------------------------------------------------------
  // Descent
  // ---------------------------------------------------------------------------
  DESCENT: {
    IDEAL_VS_STDDEV: 0.4,
    POOR_VS_STDDEV: 1.8,
    // Average descent rate above this triggers a note (m/s, negative)
    STEEP_DESCENT_MPS: -3.0,
  },

  // ---------------------------------------------------------------------------
  // Landing
  // ---------------------------------------------------------------------------
  LANDING: {
    // Descent rate on final approach considered good (m/s, negative)
    GOOD_FINAL_DESCENT_MPS: -2.0,
    // Descent rate that triggers a coaching note (m/s, negative)
    HIGH_SINK_MPS: -3.0,
    // Descent rate that triggers a strong warning (m/s, negative)
    VERY_HIGH_SINK_MPS: -5.0,
    // Window before landing in which to assess final descent rate (seconds)
    FINAL_WINDOW_SEC: 30,
  },

  // ---------------------------------------------------------------------------
  // Smoothness
  // ---------------------------------------------------------------------------
  SMOOTHNESS: {
    // Speed standard deviation considered smooth (m/s)
    IDEAL_SPEED_STDDEV: 1.5,
    POOR_SPEED_STDDEV: 5.0,
    // VS standard deviation considered smooth
    IDEAL_VS_STDDEV: 0.5,
    POOR_VS_STDDEV: 2.0,
    // Maximum acceptable fraction of noise-flagged points
    MAX_NOISE_FRACTION: 0.05,
  },

  // ---------------------------------------------------------------------------
  // Safety
  // ---------------------------------------------------------------------------
  SAFETY: {
    // Score penalty per abrupt_change event (max deduction: 40 pts)
    ABRUPT_CHANGE_PENALTY: 10,
    // Descent rate threshold that flags a safety concern (m/s, negative)
    HIGH_DESCENT_THRESHOLD_MPS: -5.0,
  },

  // ---------------------------------------------------------------------------
  // Confidence gate — add disclaimer note below this confidence level
  // ---------------------------------------------------------------------------
  LOW_CONFIDENCE_THRESHOLD: 0.4,
} as const;
