import '../i18n/i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { createRef } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { createGame, gameReducer, type GameState, type PlayerState } from '../engine/game';
import { CLASSIC, SCANDINAVIAN } from '../engine/rules/presets';
import { useSettingsStore } from '../state/settingsStore';
import { setUpAppData } from '../testing/appData';
import { Button } from '../ui/Button';
import { Avatar, CardTabs, PlayerBar, RollButton, RollPips, SkipButton } from '../ui/GameParts';
import { Handoff } from '../ui/Handoff';
import { ScoreGrid } from '../ui/ScoreGrid';
import { bestOption, ScorePad } from '../ui/ScorePad';
import { Segmented } from '../ui/Segmented';
import { holdFeedback, rollFeedback, scoreFeedback } from '../ui/feedback';
import { shareCard } from '../ui/share';
import { ShareCard, shareDataFor, type ShareCardRef } from '../ui/ShareCard';
import { light, dark } from '../ui/tokens';
import { resolveScheme, ThemeProvider } from '../ui/theme';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

beforeEach(() => {
  setUpAppData();
  jest.clearAllMocks();
});

const player = (over: Partial<PlayerState> = {}): PlayerState => ({ id: 'p', name: 'You', kind: 'human', color: '#000', card: {}, extraYatzyCount: 0, ...over });

describe('bestOption', () => {
  it('picks the highest value, the first on a tie, and null for nothing', () => {
    expect(bestOption({ ones: 3, chance: 20, threeKind: 20 })).toBe('chance');
    expect(bestOption({ ones: 0, twos: 0 })).toBe('ones');
    expect(bestOption({})).toBeNull();
  });
});

describe('ScorePad', () => {
  it('reads every row state to a screen reader: scored, option with hint, option without hint, empty', async () => {
    const onScore = jest.fn();
    await render(<ScorePad preset={CLASSIC} card={{ ones: 3 }} extraYatzyCount={0} options={{ twos: 4, chance: 15 }} hints onScore={onScore} />);
    expect(screen.getByLabelText('Ones, scored 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Twos, score 4 here' })).toBeTruthy();
    expect(screen.getByLabelText('Threes, empty')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Chance, score 15 here' }));
    expect(onScore).toHaveBeenCalledWith('chance');
    expect(screen.getByLabelText('Upper bonus 35: 3 of 63')).toBeTruthy();
  });

  it('without hints the option label omits the points and no number is drawn', async () => {
    await render(<ScorePad preset={CLASSIC} card={{}} extraYatzyCount={0} options={{ twos: 4 }} hints={false} onScore={() => {}} />);
    expect(screen.getByRole('button', { name: 'Twos, score here' })).toBeTruthy();
    expect(screen.queryByTestId('hint-twos')).toBeNull();
  });

  it('without onScore (viewing another card) nothing is a button', async () => {
    await render(<ScorePad preset={CLASSIC} card={{}} extraYatzyCount={0} options={{ twos: 4 }} hints />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Twos, empty')).toBeTruthy();
  });

  it('shows the extra Yatzy row only once a bonus exists, with the plural', async () => {
    const { rerender } = await render(<ScorePad preset={CLASSIC} card={{ yatzy: 50 }} extraYatzyCount={0} options={{}} hints />);
    expect(screen.queryByText(/Extra Yatzy/)).toBeNull();
    await rerender(<ScorePad preset={CLASSIC} card={{ yatzy: 50 }} extraYatzyCount={3} options={{}} hints />);
    expect(screen.getByText('3 extra Yatzys')).toBeTruthy();
    expect(screen.getByText('+300')).toBeTruthy();
  });

  it('lists the Scandinavian boxes in pad order with the 50 bonus', async () => {
    await render(<ScorePad preset={SCANDINAVIAN} card={{}} extraYatzyCount={0} options={{}} hints />);
    for (const box of ['One pair', 'Two pairs', 'Small straight', 'Large straight', 'Full house', 'Chance', 'Yatzy']) expect(screen.getByText(box)).toBeTruthy();
    expect(screen.getByText('Bonus +50')).toBeTruthy();
  });
});

describe('ScoreGrid', () => {
  const players = [player({ id: 'a', name: 'Ann', card: { ones: 3 } }), player({ id: 'b', name: 'Ben', card: { yatzy: 50 }, extraYatzyCount: 1 })];

  it("only the current player's cells are buttons; other columns are read with the player's name", async () => {
    const onScore = jest.fn();
    await render(<ScoreGrid preset={CLASSIC} players={players} current={0} options={{ twos: 6 }} hints onScore={onScore} />);
    expect(screen.getByRole('button', { name: 'Twos, score 6 here' })).toBeTruthy();
    expect(screen.getByLabelText('Ben: Twos, empty')).toBeTruthy();
    expect(screen.getByLabelText('Ben: Yatzy, scored 50')).toBeTruthy();
    expect(screen.getByLabelText('Ann: Upper bonus 35: 3 of 63')).toBeTruthy();
    expect(screen.getByLabelText('Ben: +100')).toBeTruthy();
    expect(screen.getByLabelText('Ann, 3 points')).toBeTruthy();
    expect(screen.getByLabelText('Ben, 150 points')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('grid-twos'));
    expect(onScore).toHaveBeenCalledWith('twos');
  });

  it('hides the extra Yatzy row when nobody has one', async () => {
    await render(<ScoreGrid preset={CLASSIC} players={[players[0]]} current={0} options={{}} hints />);
    expect(screen.queryByText('Extra Yatzys')).toBeNull();
  });
});

describe('Segmented and Button', () => {
  it('Segmented marks the selected radio and reports changes', async () => {
    const onChange = jest.fn();
    await render(<Segmented label="Rules" value="a" onChange={onChange} options={[{ value: 'a', label: 'A', subtitle: 'first' }, { value: 'b', label: 'B' }]} />);
    expect(screen.getByLabelText('Rules').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'A, first' }).props.accessibilityState).toMatchObject({ selected: true, checked: true });
    await fireEvent.press(screen.getByRole('radio', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('Button: disabled blocks presses, subtitle joins the label, accessibilityLabel overrides both', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button label="Go" subtitle="now" onPress={onPress} disabled />);
    const b = screen.getByRole('button', { name: 'Go, now' });
    expect(b).toBeDisabled();
    await fireEvent.press(b);
    expect(onPress).not.toHaveBeenCalled();
    await rerender(<Button label="Go" onPress={onPress} accessibilityLabel="Go now please" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Go now please' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Game parts', () => {
  it('RollButton reads rolls left, and "Pick a box" when none are', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<RollButton rollsLeft={2} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Roll, 2 rolls left' }));
    expect(onPress).toHaveBeenCalled();
    await rerender(<RollButton rollsLeft={0} onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Pick a box' })).toBeDisabled();
    await rerender(<RollButton rollsLeft={1} onPress={onPress} disabled label="Wait" />);
    expect(screen.getByRole('button', { name: 'Wait, 1 rolls left' })).toBeDisabled();
  });

  it('RollPips lights 3 - rollsUsed pips', async () => {
    const { toJSON } = await render(<RollPips rollsUsed={1} />);
    const json = JSON.stringify(toJSON());
    expect((json.match(/rgba\(255,255,255,0\.2\)/g) ?? []).length).toBe(1);
  });

  it('PlayerBar says who is playing now and CardTabs says whose card is shown', async () => {
    const ps = [player({ id: 'a', name: 'You' }), player({ id: 'b', name: 'Computer (Easy)', kind: 'ai' })];
    await render(<PlayerBar players={ps} current={1} totals={[12, 30]} />);
    expect(screen.getByLabelText('You, 12 points')).toBeTruthy();
    expect(screen.getByLabelText('Computer (Easy), 30 points, playing now')).toBeTruthy();
    const onSelect = jest.fn();
    await render(<CardTabs players={ps} viewed={0} onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'Show your card' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('tab', { name: "Show Computer (Easy)'s card" }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('SkipButton and Avatar', async () => {
    const onPress = jest.fn();
    await render(<SkipButton name="Computer (Expert)" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: "Skip Computer (Expert)'s turn" }));
    expect(onPress).toHaveBeenCalled();
    await render(<Avatar player={player({ name: 'mom' })} />);
    expect(screen.getByText('M')).toBeTruthy();
  });
});

describe('Handoff', () => {
  it('is modal for screen readers, shows standings scaled to the leader and the optional undo', async () => {
    const ps = [player({ id: 'a', name: 'Ann' }), player({ id: 'b', name: 'Ben' })];
    const onStart = jest.fn();
    const onUndo = jest.fn();
    const { rerender } = await render(<Handoff next={ps[1]} previous={ps[0]} players={ps} totals={[40, 20]} turn={3} turns={13} onStart={onStart} onUndo={onUndo} />);
    expect(screen.getByText("Ann's dice hidden · Turn 3 of 13")).toBeTruthy();
    expect(screen.getByLabelText('Scores so far: Ann 40, Ben 20')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "Start Ben's turn" }));
    await fireEvent.press(screen.getByRole('button', { name: "Undo Ann's last score" }));
    expect(onStart).toHaveBeenCalled();
    expect(onUndo).toHaveBeenCalled();
    await rerender(<Handoff next={ps[1]} previous={ps[0]} players={ps} totals={[0, 0]} turn={1} turns={13} onStart={onStart} />);
    expect(screen.queryByRole('button', { name: /Undo/ })).toBeNull();
  });
});

describe('ShareCard (S8, F11)', () => {
  function finished(): GameState {
    let g = createGame({ id: 'g', preset: 'classic', players: [{ id: 'c', name: 'Computer (Easy)', kind: 'ai', aiLevel: 'easy', color: '#000' }, { id: 'p', name: 'Private Name', kind: 'human', color: '#000' }] });
    g = gameReducer(g, { type: 'roll', faces: [1, 1, 1, 1, 1] });
    g = gameReducer(g, { type: 'score', box: 'chance' });
    g = gameReducer(g, { type: 'roll', faces: [6, 6, 6, 6, 6] });
    g = gameReducer(g, { type: 'score', box: 'yatzy' });
    g = gameReducer(g, { type: 'roll', faces: [6, 6, 6, 6, 6] });
    g = gameReducer(g, { type: 'score', box: 'ones' });
    g = gameReducer(g, { type: 'roll', faces: [6, 6, 6, 6, 6] });
    g = gameReducer(g, { type: 'score', box: 'sixes' });
    return g;
  }

  it("shareDataFor uses the first person's score (not the computer's) and counts Yatzys", () => {
    const data = shareDataFor(finished(), 'October 17');
    expect(data).toEqual({ daily: false, score: 50 + 30 + 100, date: 'October 17', breakdown: { upper: 30, bonus: 0, lower: 150, yatzys: 2 } });
  });

  it('renders no player name, only the score, date, breakdown and site', async () => {
    const { toJSON } = await render(<ShareCard data={shareDataFor(finished(), 'October 17')} />);
    const text = JSON.stringify(toJSON());
    expect(text).not.toContain('Private Name');
    expect(text).not.toContain('Computer');
    expect(screen.getByText('180')).toBeTruthy();
    expect(screen.getByText('October 17')).toBeTruthy();
    expect(screen.getByText('dicedengame.com')).toBeTruthy();
    expect(screen.getByText('FINAL SCORE')).toBeTruthy();
  });

  it('the daily variant shows the streak instead of the breakdown', async () => {
    await render(<ShareCard data={{ daily: true, score: 212, date: 'Today', streak: 4 }} />);
    expect(screen.getByText("TODAY'S DICE")).toBeTruthy();
    expect(screen.getByText('4-day streak')).toBeTruthy();
    expect(screen.queryByText('UPPER')).toBeNull();
  });

  it('shareCard captures at 1080×1350 and returns false when sharing is unavailable or the ref is empty', async () => {
    const ref = createRef<ShareCardRef>();
    await render(<View ref={ref} />);
    await expect(shareCard(ref)).resolves.toBe(true);
    expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ width: 1080, height: 1350, format: 'png' }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/share.png', expect.objectContaining({ mimeType: 'image/png' }));
    await expect(shareCard({ current: null })).resolves.toBe(false);
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    await expect(shareCard(ref)).resolves.toBe(false);
    (captureRef as jest.Mock).mockRejectedValueOnce(new Error('no view'));
    await expect(shareCard(ref)).resolves.toBe(false);
  });
});

describe('feedback (F12)', () => {
  it('haptics follow the Haptics setting; sound follows the Sound setting', () => {
    rollFeedback();
    holdFeedback();
    scoreFeedback(true);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    useSettingsStore.getState().update({ haptics: false });
    rollFeedback();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('a rejected haptic call never throws', () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error('no motor'));
    expect(() => rollFeedback()).not.toThrow();
  });
});

describe('theme', () => {
  it('light and dark palettes have the same tokens, a light and a dark background, and only hex or rgba colours', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(luminance(light.bg)).toBeGreaterThan(200);
    expect(luminance(dark.bg)).toBeLessThan(60);
    expect(luminance(light.ink)).toBeLessThan(luminance(light.bg));
    expect(luminance(dark.ink)).toBeGreaterThan(luminance(dark.bg));
    for (const palette of [light, dark]) {
      for (const [key, value] of Object.entries(palette)) expect([key, value]).toEqual([key, expect.stringMatching(/^#[0-9A-Fa-f]{6}$|^rgba?\(/)]);
    }
  });

  it('ThemeProvider follows the chosen mode', async () => {
    expect(resolveScheme('dark', 'light')).toBe('dark');
    await render(
      <ThemeProvider mode="dark">
        <Button label="x" onPress={() => {}} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'x' })).toBeTruthy();
  });
});
