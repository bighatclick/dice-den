import appJson from '../../app.json';

// Regression: the minified Android release build crashed on launch because R8 removed
// WorkManager's Room database class, which is created by reflection at app start.
describe('Android release config', () => {
  const plugins = appJson.expo.plugins as unknown[];
  const buildProperties = plugins.find((p) => Array.isArray(p) && p[0] === 'expo-build-properties') as
    | [string, { android: { extraProguardRules: string } }]
    | undefined;

  it('keeps the classes WorkManager creates by reflection', () => {
    const rules = buildProperties?.[1].android.extraProguardRules ?? '';
    expect(rules).toContain('-keep class * extends androidx.room.RoomDatabase { <init>(); }');
    expect(rules).toContain('-keep class androidx.work.impl.WorkDatabase_Impl');
  });
});
