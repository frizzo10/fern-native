import { Platform } from 'react-native';

// Ten ready-made "stationery" looks for the shopping list. The person only picks one; the phrase and
// colours are fixed (no typing, no colour picking). Titles come from translations `stat_<id>_t` (with
// {name}), `stat_<id>_tn` (no name known), `stat_<id>_s` (sub line) and `stat_<id>_label` (style name).
// Device-only choice, AsyncStorage `fern_stationery` (a style id; missing = plain peach list).
const SERIF = Platform.select({ ios: 'Georgia-Italic', android: 'serif', default: 'serif' });
const SCRIPT = Platform.select({ ios: 'SnellRoundhand-Bold', android: 'cursive', default: 'cursive' });
const HAND = Platform.select({ ios: 'Noteworthy-Bold', android: 'cursive', default: 'cursive' });

export const STATIONERY_KEY = 'fern_stationery';

export const STATIONERY = [
  { id: 'blush', icon: '✿', bg: '#ECF2E6', ink: '#2F4535', title: '#3F6845', sub: '#4F6455', accent: '#4E7A54', font: SERIF, frame: { borderWidth: 2, borderColor: '#4E7A54' } },
  { id: 'sage', icon: '', bg: '#FFFDF8', ink: '#2F4A3A', title: '#2F4A3A', sub: '#6B8F77', accent: '#7FA58B', font: SERIF, frame: { borderLeftWidth: 22, borderLeftColor: '#7FA58B' } },
  { id: 'navy', icon: '◆', bg: '#FFF6E3', ink: '#3B3A5C', title: '#3B3A5C', sub: '#8A86B0', accent: '#C9A24B', font: SERIF, frame: { borderTopWidth: 26, borderTopColor: '#3B3A5C' } },
  { id: 'card', icon: '🌿', bg: '#FFFFFF', ink: '#2F4535', title: '#3F5645', sub: '#4F6455', accent: '#B5C7AB', font: SCRIPT, frame: { borderWidth: 6, borderColor: '#DDE7D5' } },
  { id: 'lemon', icon: '🍋', bg: '#FFF9D6', ink: '#5E4A00', title: '#8A6A00', sub: '#9A8225', accent: '#E0B83A', font: SERIF, frame: { borderBottomWidth: 10, borderBottomColor: '#F2C94C' } },
  { id: 'sky', icon: '☁', bg: '#EEF5FB', ink: '#24475F', title: '#2E5A7D', sub: '#5F86A6', accent: '#6FA3CF', font: SERIF, frame: { borderWidth: 2, borderColor: '#8DB8DC', borderStyle: 'dashed' } },
  { id: 'lavender', icon: '❀', bg: '#F5EEFB', ink: '#46306A', title: '#5E3F85', sub: '#8A72AA', accent: '#A584CE', font: SCRIPT, frame: { borderWidth: 2, borderColor: '#D7C4EA' } },
  { id: 'terra', icon: '▲', bg: '#FBEDE3', ink: '#5E2A14', title: '#8F3F22', sub: '#A8684A', accent: '#D98159', font: SERIF, frame: { borderLeftWidth: 8, borderLeftColor: '#D98159', borderRightWidth: 8, borderRightColor: '#D98159' } },
  { id: 'chalk', icon: '✎', bg: '#2F3B36', ink: '#F4F1E8', title: '#F4F1E8', sub: '#B8C4BC', accent: '#E7DFC8', font: HAND, frame: { borderWidth: 5, borderColor: '#8A6B4A' } },
  { id: 'garden', icon: '🌱', bg: '#F1F8EC', ink: '#2E4D22', title: '#3F6B2F', sub: '#6F9560', accent: '#7FB36B', font: SERIF, frame: { borderWidth: 2, borderColor: '#9CC98A' } },
];

export function stationeryById(id) {
  return STATIONERY.find((s) => s.id === id) || null;
}

export function firstName(profile, user) {
  const raw = String((profile && (profile.userName || profile.name)) || (user && user.name) || '').trim();
  return raw.split(/\s+/)[0] || '';
}
