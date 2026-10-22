// Security audit: the release build must not ask for permissions it doesn't use.
const appJson = require('../../app.json');

type Plugin = string | [string, Record<string, unknown>];

function resolve(env: Record<string, string | undefined>) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  try {
    let makeConfig!: (ctx: { config: typeof appJson.expo }) => typeof appJson.expo & { plugins: Plugin[] };
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- loads the config fresh for each env
      makeConfig = require('../../app.config.js');
    });
    return makeConfig({ config: JSON.parse(JSON.stringify(appJson.expo)) });
  } finally {
    process.env = saved;
  }
}

const name = (p: Plugin) => (Array.isArray(p) ? p[0] : p);
const adsOptions = (plugins: Plugin[]) => (plugins.find((p) => name(p) === 'react-native-google-mobile-ads') as [string, Record<string, unknown>])[1];

describe('app.config.js', () => {
  it('blocks the overlay, ad and billing permissions while monetization is off', () => {
    const config = resolve({ EXPO_PUBLIC_MONETIZATION: undefined });
    expect(config.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.SYSTEM_ALERT_WINDOW',
        'com.google.android.gms.permission.AD_ID',
        'android.permission.ACCESS_ADSERVICES_AD_ID',
        'com.android.vending.BILLING',
      ]),
    );
    expect(config.plugins.map(name)).not.toContain('expo-tracking-transparency');
  });

  it('keeps ad and billing permissions when monetization is on, but never the overlay', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const config = resolve({ EXPO_PUBLIC_MONETIZATION: '1' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('test ids'));
    warn.mockRestore();
    expect(config.android.blockedPermissions).toEqual(['android.permission.SYSTEM_ALERT_WINDOW']);
    expect(config.plugins.map(name)).toContain('expo-tracking-transparency');
  });

  it('takes the AdMob app ids from the environment', () => {
    const config = resolve({ ADMOB_ANDROID_APP_ID: 'ca-app-pub-1~1', ADMOB_IOS_APP_ID: 'ca-app-pub-1~2' });
    expect(adsOptions(config.plugins)).toMatchObject({ androidAppId: 'ca-app-pub-1~1', iosAppId: 'ca-app-pub-1~2' });
  });

  it('signs release builds with the upload key', () => {
    expect((appJson.expo.plugins as Plugin[]).map(name)).toContain('./plugins/withReleaseSigning');
  });
});
