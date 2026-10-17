import '../i18n/i18n';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { setUpAppData } from '../testing/appData';
import { Die } from '../ui/Die';

const opacityOf = (index: number) => StyleSheet.flatten(screen.getByTestId(`die-body-${index}`).props.style).opacity;

beforeEach(() => setUpAppData());

describe('Die', () => {
  // Regression: the dimming of dice not yet rolled was overridden by the animated style,
  // so the previous player's dice showed at full strength before the next roll.
  it('dims dice that have not been rolled this turn', async () => {
    await render(<Die index={0} value={5} held={false} canHold={false} rolled={false} rollSeq={0} onToggle={() => {}} />);
    expect(opacityOf(0)).toBeCloseTo(0.45);
  });

  it('shows rolled dice at full strength', async () => {
    await render(<Die index={0} value={5} held={false} canHold rolled rollSeq={1} onToggle={() => {}} />);
    expect(opacityOf(0)).toBe(1);
  });
});
