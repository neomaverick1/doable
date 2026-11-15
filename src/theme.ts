import { Platform, type TextStyle } from 'react-native';

export const colors = {
  bg: '#F6F4EF',
  card: '#FFFFFF',
  ink: '#16161D',
  text: '#26262F',
  muted: '#6E6E7A',
  faint: '#A3A3AD',
  border: '#E8E4DB',
  accent: '#FF5A36',
  accentSoft: '#FFE9E2',
  accentDark: '#D9401F',
  ai: '#6D4DFF',
  aiSoft: '#EEEAFF',
  aiPink: '#E14BB8',
  done: '#13A383',
  doneSoft: '#DCF4EC',
  warn: '#D98A1C',
  warnSoft: '#FFF2DC',
  danger: '#E5484D',
  dangerSoft: '#FDE8E8',
  white: '#FFFFFF',
};

export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

const display = Platform.select({ ios: 'System', default: undefined });

export const type: Record<'hero' | 'title' | 'h2' | 'body' | 'label' | 'small', TextStyle> = {
  hero: { fontSize: 34, fontWeight: '800', color: colors.ink, letterSpacing: -0.8, fontFamily: display },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5, fontFamily: display },
  h2: { fontSize: 17, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.text, lineHeight: 21 },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  small: { fontSize: 13, color: colors.muted },
};

/** Stable colour for a tag name. */
const TAG_COLORS = ['#2F80ED', '#13A383', '#D98A1C', '#9B51E0', '#E14B8A', '#0F9BB5', '#6B7A2F', '#E5484D'];
export function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}
