/**
 * Feature flags for gradual feature rollout.
 * 
 * USE_SOFT_BAND_CONTROLLER: When enabled, uses the new config-driven soft-control system:
 *   - RUN_COMPILE_SALES_EFFECTS: Compiles daily sales effects per listing
 *   - RUN_SHOWCASE_SIM_V2: Natural simulation using compiled effects and tuner (no targetOrders/scaleApplied)
 *   - RUN_UPDATE_TRAFFIC_TUNER: Soft controller that adjusts traffic for tomorrow based on today's orders vs band
 * 
 * When disabled, uses legacy RUN_SHOWCASE_SIM with targetOrders/scaleApplied forcing.
 * 
 * Currently OFF by default. Set USE_SOFT_BAND_CONTROLLER=true in env to enable.
 */
export const featureFlags = {
  USE_SOFT_BAND_CONTROLLER: process.env.USE_SOFT_BAND_CONTROLLER === 'true',
} as const;
