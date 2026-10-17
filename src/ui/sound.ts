import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useSettingsStore } from '../state/settingsStore';

const SOURCES = {
  roll: require('../../assets/sounds/roll.wav'),
  hold: require('../../assets/sounds/hold.wav'),
  score: require('../../assets/sounds/score.wav'),
  yatzy: require('../../assets/sounds/yatzy.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let modeSet = false;

/**
 * Plays a short effect if Sound is on. Respects the iPhone silent switch
 * (specs.md F12) and never throws: sound must not block play.
 */
export function playSound(name: SoundName): void {
  if (!useSettingsStore.getState().settings.sound) return;
  try {
    if (!modeSet) {
      modeSet = true;
      setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false }).catch(() => {});
    }
    const player = (players[name] ??= createAudioPlayer(SOURCES[name]));
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // Ignore: a missing audio session must never interrupt a game.
  }
}
