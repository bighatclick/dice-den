/**
 * "Den" design system tokens (specs.md §9, approved v2 look in design/mockups.html).
 * Unique to Dice Den: never copy into another app.
 */
export interface Palette {
  page: string;
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  primary: string;
  primaryHi: string;
  primaryLo: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  mint: string;
  gold: string;
  goldHi: string;
  goldSoft: string;
  danger: string;
  feltHi: string;
  felt: string;
  feltLo: string;
  rim: string;
  sheet: string;
  dieFace: string;
  dieFaceLo: string;
  dieEdge: string;
  pip: string;
  onFelt: string;
  onFelt2: string;
}

export const light: Palette = {
  page: '#EADFCC',
  bg: '#F7F0E4',
  surface: '#FFFDF9',
  surface2: '#F3EBDD',
  ink: '#2B1D14',
  ink2: '#6E5A4B',
  ink3: '#A39080',
  line: '#EADFCF',
  primary: '#8A4520',
  primaryHi: '#B4642F',
  primaryLo: '#5C2D14',
  onPrimary: '#FFF8EE',
  accent: '#2E6B4F',
  accentSoft: '#E2F0E8',
  mint: '#7FE0B0',
  gold: '#C9952B',
  goldHi: '#F4CF73',
  goldSoft: '#F8EDD3',
  danger: '#B23A2E',
  feltHi: '#3C8762',
  felt: '#2A6248',
  feltLo: '#173D2C',
  rim: '#5A2E15',
  sheet: '#FFFDF9',
  dieFace: '#FFFFFD',
  dieFaceLo: '#E8DCC8',
  dieEdge: '#CDBBA0',
  pip: '#2A1A10',
  onFelt: '#F4FBF6',
  onFelt2: '#CDEBDB',
};

export const dark: Palette = {
  ...light,
  page: '#0C0907',
  bg: '#16100C',
  surface: '#221912',
  surface2: '#2B2018',
  ink: '#F5ECDF',
  ink2: '#C4B19D',
  ink3: '#8C7967',
  line: '#35281E',
  primary: '#C97A45',
  primaryHi: '#E39A62',
  primaryLo: '#8A4E26',
  onPrimary: '#1A0F08',
  accent: '#6BC096',
  accentSoft: '#1B3127',
  gold: '#E7BE5E',
  goldSoft: '#3A2D14',
  danger: '#E0705F',
  feltHi: '#2B6A4C',
  felt: '#1C4836',
  feltLo: '#0E2519',
  rim: '#3A1D0C',
  sheet: '#1D1510',
  dieFace: '#F4EDE0',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 24, xxl: 30, pill: 999 } as const;
/** Minimum touch target (CLAUDE.md conventions). */
export const touchTarget = 44;

export const fonts = {
  display: 'Fraunces_700Bold',
  displaySemi: 'Fraunces_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
} as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 30, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.bold, fontSize: 16 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 14 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  /** All scores use tabular numerals. */
  score: { fontFamily: fonts.heavy, fontSize: 16, fontVariant: ['tabular-nums' as const] },
} as const;
