// Fern Design System Tokens
// Single source of truth — matches web app exactly

export const Colors = {
  forest:    '#1C3A1A',
  bright:    '#2D5A27',
  sage:      '#A8D5A2',
  sageFaint: 'rgba(168,213,162,0.12)',
  orange:    '#E8651A',
  orangeDeep:'#CF560F',
  parch:     '#FDFAF6',
  paper:     '#F5EFE6',
  paper2:    '#EFE7D9',
  border:    '#D8C8B0',
  ink:       '#1A0E05',
  ink2:      '#2C1A0A',
  brown:     '#7A5C3A',
  brownSoft: '#9C835F',
  onFern:    '#F3EEE4',
  muted:     '#B7C7AE',
  voiceRed:  '#C73E2E',
  white:     '#FFFFFF',
};

export const Fonts = {
  serif:  'Georgia',   // Playfair Display fallback
  sans:   'System',    // Lato fallback
};

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 999,
};

export const Shadow = {
  card: {
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  nav: {
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
};
