import '../i18n/i18n';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { setUpAppData } from '../testing/appData';
import { Die, DieFace } from '../ui/Die';

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

  // Regression: every die shared one gradient id, so on the web the pips pointed at a die
  // on a hidden screen and rendered blank.
  it('gives every die face its own gradient ids', async () => {
    await render(
      <View>
        <DieFace value={5} size={40} />
        <DieFace value={5} size={40} />
      </View>,
    );
    const ids = JSON.stringify(screen.toJSON()).match(/"name":"(face|pip)-[^"]*"/g) ?? [];
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
});
