import { nullAdProvider, type AdProvider } from './provider';

/** The browser build has no ad SDK: the AdMob library only runs on phones. */
export function createAdMobProvider(): AdProvider {
  return nullAdProvider;
}
