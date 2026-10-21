import '../i18n/i18n';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import HelpScreen from '../../app/help';
import HomeScreen from '../../app/index';
import SettingsScreen from '../../app/settings';
import { useGameStore } from '../state/gameStore';
import { useSettingsStore } from '../state/settingsStore';
import { setUpAppData } from '../testing/appData';

const routes = { index: HomeScreen, settings: SettingsScreen, help: HelpScreen };

beforeEach(() => {
  setUpAppData();
  useGameStore.setState({ game: null, rollSeq: 0 });
});

describe('How to play and FAQ', () => {
  it('opens from the home screen and explains a turn', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(screen.getByRole('button', { name: 'How to play' }));
    expect(await screen.findByText('Roll the five dice. You get up to 3 rolls.')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Questions' })).toBeTruthy();
    expect(screen.getByText('Are the dice fair?')).toBeTruthy();
  });

  it('opens from Settings', async () => {
    await renderRouter(routes, { initialUrl: '/settings' });
    await fireEvent.press(screen.getByRole('link', { name: 'How to play and FAQ' }));
    expect(await screen.findByRole('header', { name: 'What each box scores' })).toBeTruthy();
  });

  it('shows the boxes of the rules you play, and switches between them', async () => {
    await renderRouter(routes, { initialUrl: '/help' });
    // Classic by default: no pairs, a 35-point bonus and extra Yatzys.
    expect(screen.queryByText(/2 different pairs/)).toBeNull();
    expect(await screen.findByText('3 of one number and 2 of another. You get 25.')).toBeTruthy();
    expect(screen.getByText(/you get 35 extra points/)).toBeTruthy();
    expect(screen.getByText(/gives you 100 extra points/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: /Scandinavian/ }));
    expect(screen.getByText('2 different pairs. You get those 4 dice added up.')).toBeTruthy();
    expect(screen.getByText(/you get 50 extra points/)).toBeTruthy();
    expect(screen.queryByText(/gives you 100 extra points/)).toBeNull();
  });

  it('starts on the rules chosen in Settings', async () => {
    useSettingsStore.getState().update({ preset: 'scandinavian' });
    await renderRouter(routes, { initialUrl: '/help' });
    expect(await screen.findByText('Exactly 1-2-3-4-5. You get 15.')).toBeTruthy();
  });
});
