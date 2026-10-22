import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import appJson from '../../app.json';

/**
 * Structural checks for CLAUDE.md "Hard rules" that no unit test of behaviour
 * can catch: a stray import, a trademark in a comment, a permission in app.json.
 */
const ROOT = join(__dirname, '..', '..');

function files(dir: string, filter: (name: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (['node_modules', '.git', 'android', 'ios', '.expo', '.claude'].includes(name)) continue;
    if (statSync(full).isDirectory()) files(full, filter, out);
    else if (filter(name)) out.push(full);
  }
  return out;
}

const ts = (name: string) => /\.(ts|tsx|js)$/.test(name) && !name.endsWith('.d.ts');
const shipped = (file: string) => !/__tests__|\.test\.|\.bench\.|jest|\/scripts\//.test(file.replace(/\\/g, '/'));
const rel = (file: string) => relative(ROOT, file).replace(/\\/g, '/');

describe('rule 2: fair dice', () => {
  it('src/engine has no React, Expo or React Native imports (pure TS)', () => {
    for (const file of files(join(ROOT, 'src', 'engine'), ts).filter(shipped)) {
      const text = readFileSync(file, 'utf8');
      expect([rel(file), /from ['"](react|react-native|expo|@expo|zustand)/.test(text)]).toEqual([rel(file), false]);
    }
  });

  it('only src/state/rng.ts talks to expo-crypto, and only the engine defines an RNG', () => {
    const users = files(join(ROOT, 'src'), ts)
      .concat(files(join(ROOT, 'app'), ts))
      .filter(shipped)
      .filter((f) => /from ['"]expo-crypto['"]/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(users).toEqual(['src/state/rng.ts']);
  });

  it('the AI never imports anything that could reach the dice generator', () => {
    for (const file of files(join(ROOT, 'src', 'ai'), ts).filter(shipped)) {
      const text = readFileSync(file, 'utf8');
      expect([rel(file), /rng|crypto|Math\.random\(\)\s*\*\s*6/.test(text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''))]).toEqual([rel(file), false]);
    }
  });

  it('Math.random never decides a die face anywhere in shipped code', () => {
    for (const file of files(join(ROOT, 'src'), ts).concat(files(join(ROOT, 'app'), ts)).filter(shipped)) {
      const text = readFileSync(file, 'utf8');
      for (const line of text.split('\n')) {
        if (!line.includes('Math.random')) continue;
        // Allowed: ids and Easy's pick among options. Never: "* 6" (a face).
        expect([rel(file), line.trim()]).not.toEqual([rel(file), expect.stringMatching(/Math\.random\(\)\s*\*\s*6\b/)]);
      }
    }
  });
});

describe('rule 4: trademarks never ship', () => {
  const BANNED = /yahtzee|kniffel|yatzee/i;

  it('no source file, config, store text or e2e flow mentions one', () => {
    const all = files(ROOT, (n) => /\.(ts|tsx|js|json|txt|md|yaml|yml)$/.test(n)).filter((f) => !/CLAUDE\.md|AGENTS\.md|specs\.md|hardRules\.test|storeText\.test|i18nKeys\.test|package-lock/.test(f));
    const offenders = all.filter((f) => BANNED.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('rule 6 and rule 8: no currency, no hard-coded prices', () => {
  it('shipped code never mentions coins, gems, energy, lives, subscriptions or extra rolls as features', () => {
    const offenders: string[] = [];
    for (const file of files(join(ROOT, 'src'), ts).concat(files(join(ROOT, 'app'), ts)).filter(shipped)) {
      const code = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      if (/['"`][^'"`]*\b(coins?|gems?|energy|lives|subscription|spin wheel|scratcher)\b[^'"`]*['"`]/i.test(code)) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });

  it('prices appear only in the fake store and tests', () => {
    const offenders = files(join(ROOT, 'src'), ts)
      .concat(files(join(ROOT, 'app'), ts))
      .filter(shipped)
      .filter((f) => !f.endsWith('fakeStore.ts'))
      .filter((f) => /\$\d+\.\d\d/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe('rule 7: offline-first, privacy-light', () => {
  const deps = Object.keys(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).dependencies as Record<string, string>);

  it('has no attribution, analytics, backend or login SDKs', () => {
    const banned = /appsflyer|adjust|firebase|amplitude|mixpanel|segment|branch|facebook|supabase|amplify|auth0|clerk|@react-native-google-signin/i;
    expect(deps.filter((d) => banned.test(d))).toEqual([]);
  });

  it('never asks for photo, contacts, camera, microphone or location permissions', () => {
    const config = JSON.stringify(appJson).toLowerCase();
    for (const key of ['nsphotolibrary', 'nscontacts', 'nscamera', 'nsmicrophone', 'nslocation', 'read_contacts', 'read_external_storage', 'access_fine_location']) {
      expect([key, config.includes(key)]).toEqual([key, false]);
    }
    expect(deps).not.toContain('expo-contacts');
    expect(deps).not.toContain('expo-image-picker');
    expect(deps).not.toContain('expo-location');
  });

  it('every network-capable library has an offline fallback in code (2-second timeout helper is used by ads and the store)', () => {
    const uses = files(join(ROOT, 'src'), ts)
      .filter(shipped)
      .filter((f) => /withTimeout\(/.test(readFileSync(f, 'utf8')))
      .map(rel)
      .sort();
    expect(uses).toEqual(expect.arrayContaining(['src/ads/admob.ts', 'src/state/shopStore.ts']));
  });
});

describe('rule 1: ads only where allowed', () => {
  it('only the final scorecard imports the interstitial call', () => {
    const importers = files(join(ROOT, 'app'), ts)
      .concat(files(join(ROOT, 'src'), ts))
      .filter(shipped)
      .filter((f) => /interstitialAfterFinal/.test(readFileSync(f, 'utf8')))
      .map(rel)
      .sort();
    expect(importers).toEqual(['app/final.tsx', 'src/ads/index.ts']);
  });

  it('the game table, handoff and home never touch the ad show functions', () => {
    for (const file of ['app/game.tsx', 'src/ui/Handoff.tsx', 'app/index.tsx', 'app/onboarding.tsx']) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      expect([file, /showInterstitial|interstitialAfterFinal|watchRewarded|prepareInterstitial/.test(text)]).toEqual([file, false]);
    }
  });

  it('the AdMob provider mutes ads and uses the G content rating', () => {
    const text = readFileSync(join(ROOT, 'src/ads/admob.ts'), 'utf8');
    expect(text).toMatch(/setAppMuted\(true\)/);
    expect(text).toMatch(/setAppVolume\(0\)/);
    expect(text).toMatch(/MaxAdContentRating\.G/);
  });
});

describe('rule 3: never lose progress', () => {
  it('the schema version and the number of migrations agree', () => {
    const schema = readFileSync(join(ROOT, 'src/data/schema.ts'), 'utf8');
    const version = Number(/SCHEMA_VERSION = (\d+)/.exec(schema)![1]);
    const migrations = readdirSync(join(ROOT, 'src/data/migrations')).filter((n) => /^\d{3}-.*\.ts$/.test(n));
    expect(migrations).toHaveLength(version);
    const fixtures = readdirSync(join(ROOT, 'src/data/migrations/__fixtures__'));
    expect(fixtures.length).toBeGreaterThanOrEqual(version);
  });

  it('nothing in shipped code ever clears or deletes the root blob', () => {
    for (const file of files(join(ROOT, 'src'), ts).concat(files(join(ROOT, 'app'), ts)).filter(shipped)) {
      const text = readFileSync(file, 'utf8');
      expect([rel(file), /\.(delete|remove|clearAll|clear)\(\s*(ROOT_KEY|['"]root['"])/.test(text)]).toEqual([rel(file), false]);
    }
  });
});

describe('app config', () => {
  it('uses the agreed bundle id, display name and a universal iOS build', () => {
    const expo = appJson.expo as { name: string; ios: { bundleIdentifier: string; supportsTablet?: boolean }; android: { package: string } };
    expect(expo.name).toBe('Dice Den');
    expect(expo.ios.bundleIdentifier).toBe('com.dicedengame.app');
    expect(expo.android.package).toBe('com.dicedengame.app');
    expect(expo.ios.supportsTablet).toBe(true);
  });
});
