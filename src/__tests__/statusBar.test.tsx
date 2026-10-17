import '../i18n/i18n';
import { act } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import FinalScreen from '../../app/final';
import GameScreen from '../../app/game';
import HomeScreen from '../../app/index';
import OnboardingScreen from '../../app/onboarding';
import { setAdProvider } from '../ads';
import { CLASSIC } from '../engine/rules/presets';
import { useGameStore } from '../state/gameStore';
import { createFakeAds } from '../testing/fakeAds';
import { scriptDice, setUpAppData } from '../testing/appData';

// Records the styles of every <StatusBar> currently mounted.
const mockMounted: string[] = [];
jest.mock('expo-status-bar', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('expo-status-bar'),
    StatusBar: ({ style }: { style: string }) => {
      useEffect(() => {
        mockMounted.push(style);
        return () => void mockMounted.splice(mockMounted.indexOf(style), 1);
      }, [style]);
      return null;
    },
  };
});

const routes = { index: HomeScreen, game: GameScreen, final: FinalScreen, onboarding: OnboardingScreen };

beforeEach(() => {
  mockMounted.length = 0;
  setUpAppData();
  setAdProvider(createFakeAds());
  useGameStore.setState({ game: null, rollSeq: 0, newUnlocks: [] });
});

// Regression: on Android the status bar text was dark on the dark felt.
describe('Status bar over the felt', () => {
  it('is light on the game table and released on the final scorecard', async () => {
    await renderRouter(routes, { initialUrl: '/game' });
    expect(mockMounted).toEqual(['light']);

    scriptDice([4, 4, 4, 4, 4]);
    await act(async () => {
      for (const box of CLASSIC.boxes) {
        useGameStore.getState().roll();
        useGameStore.getState().score(box);
      }
    });
    expect(mockMounted).toEqual([]);
  });

  it('is light on the first-run tutorial', async () => {
    await renderRouter(routes, { initialUrl: '/onboarding' });
    expect(mockMounted).toEqual(['light']);
  });
});
