/**
 * Ads and in-app purchases, switched off for now. With it off the app shows no ads,
 * no consent or tracking prompts and nothing to buy; earned dice and tables still work.
 * Build with EXPO_PUBLIC_MONETIZATION=1 to turn everything back on.
 */
export const MONETIZATION_ENABLED = process.env.EXPO_PUBLIC_MONETIZATION === '1';
