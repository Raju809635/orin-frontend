export const FEATURE_FLAGS = {
  networking: true,
  dailyEngagement: true,
  reputation: true,
  smartSuggestions: true,
  collegeNetwork: true,
  directMessagingExpansion: true
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
