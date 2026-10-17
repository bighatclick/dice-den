import i18n from '../i18n/i18n';
import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import DailyScreen from '../../app/daily';
import FairnessScreen from '../../app/fairness';
import FinalScreen from '../../app/final';
import GameScreen from '../../app/game';
import HomeScreen from '../../app/index';
import NewGameScreen from '../../app/new-game';
import OnboardingScreen from '../../app/onboarding';
import SettingsScreen from '../../app/settings';
import ShopScreen from '../../app/shop';
import StatsScreen from '../../app/stats';
import en from '../i18n/en.json';
import { pseudoLocalize, pseudoString } from '../i18n/pseudo';
import { CLASSIC } from '../engine/rules/presets';
import { useGameStore } from '../state/gameStore';
import { setGameRng } from '../state/rng';
import { scriptDice, setUpAppData } from '../testing/appData';

type Tree = { [key: string]: string | Tree };
const routes = {
  index: HomeScreen,
  game: GameScreen,
  final: FinalScreen,
  daily: DailyScreen,
  stats: StatsScreen,
  settings: SettingsScreen,
  shop: ShopScreen,
  fairness: FairnessScreen,
  onboarding: OnboardingScreen,
  'new-game': NewGameScreen,
};

function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v]] : leaves(v, `${prefix}${k}.`)));
}

describe('pseudo-locale generator', () => {
  it('accents letters, keeps placeholders and adds ~40% length', () => {
    expect(pseudoString('Turn {{turn}} of 3')).toBe('[Ţúŕñ {{turn}} óƒ 3~~~~~~~~]');
  });

  it('covers every key in en.json with the same placeholders', () => {
    const xx = leaves(pseudoLocalize(en as Tree));
    const source = leaves(en as Tree);
    expect(xx.map(([k]) => k)).toEqual(source.map(([k]) => k));
    for (const [i, [, text]] of source.entries()) {
      expect(xx[i][1].match(/\{\{\w+\}\}/g)).toEqual(text.match(/\{\{\w+\}\}/g));
    }
  });
});

/** Every rendered string, so hard-coded English can be caught. */
function renderedText(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(renderedText);
  return (node.children ?? []).flatMap((c) => (typeof c === 'string' ? [c] : renderedText(c)));
}

// Dates come from the system formatter in the device language, not from en.json.
const DATE_WORDS = /^(?:[A-Z]{3}|[A-Z]|(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day.*|\w+ \d+|\d+ \w+)$/;

describe('no hard-coded UI text (pseudo-locale pass)', () => {
  beforeAll(async () => {
    i18n.addResourceBundle('xx', 'translation', pseudoLocalize(en as Tree));
    await i18n.changeLanguage('xx');
  });
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });
  beforeEach(() => {
    setUpAppData();
    setGameRng(null);
    useGameStore.setState({ game: null, rollSeq: 0 });
  });

  it.each(['/', '/settings', '/shop', '/stats', '/daily', '/fairness', '/new-game?opponents=pass', '/game', '/onboarding'])(
    '%s shows only translated text',
    async (url) => {
      await renderRouter(routes, { initialUrl: url });
      const plain = renderedText(screen.toJSON() as ReactTestRendererJSON).filter(
        (s) => /[A-Za-z]{2,}/.test(s) && !DATE_WORDS.test(s.trim()) && !/^\[(?:ion|[a-z-]+)\]$/.test(s),
      );
      expect(plain).toEqual([]);
    },
  );

  it('the final scorecard shows only translated text', async () => {
    scriptDice([4, 4, 4, 4, 4]);
    const { start, roll, score } = useGameStore.getState();
    start({ players: [{ id: 'p1', name: 'Mom', kind: 'human', color: '#000' }] });
    for (const box of CLASSIC.boxes) {
      roll();
      score(box);
    }
    await renderRouter(routes, { initialUrl: '/final' });
    // "Mom" is a player name the person typed, not UI text.
    const plain = renderedText(screen.toJSON() as ReactTestRendererJSON).filter(
      (s) => /[A-Za-z]{2,}/.test(s) && s !== 'Mom' && s !== 'M' && !DATE_WORDS.test(s.trim()) && !/^\[[a-z-]+\]$/.test(s),
    );
    expect(plain).toEqual([]);
  });
});
