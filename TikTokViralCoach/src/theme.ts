/**
 * Content Flow Theme
 * Dark tech / cyan glow design tokens
 * Used across all screens for consistency
 */

export const theme = {
  colors: {
    // Core palette
    primary: '#00D4FF',        // Cyan glow
    secondary: '#0099CC',      // Deep cyan
    accent: '#00FFB3',         // Neon mint
    highlight: '#38BDF8',      // Sky blue

    // Backgrounds
    background: '#050810',     // Deep navy black
    surface: '#0C1220',        // Card background
    surfaceAlt: '#111827',     // Alternate surface
    surfaceBorder: '#1E293B',  // Subtle border
    surfaceMuted: '#334155',   // Muted border / inactive

    // Text
    text: '#E2F0FF',           // Primary text (cool white)
    textSecondary: '#94A3B8',  // Secondary text
    textMuted: '#64748B',      // Muted / labels
    textDisabled: '#334155',   // Disabled state

    // Semantic
    success: '#00FFB3',        // Neon mint
    warning: '#F59E0B',        // Amber
    error: '#EF4444',          // Red

    // Gradient pairs
    gradients: {
      primary: ['#00D4FF', '#00FFB3'],
      primaryReverse: ['#00FFB3', '#00D4FF'],
      surface: ['#0C1220', '#111827'],
      dark: ['#050810', '#0C1220'],
      glowOverlay: ['#00D4FF22', '#00D4FF05'],
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  typography: {
    label: {
      fontSize: 11,
      fontWeight: '700' as const,
      letterSpacing: 2,
      color: '#64748B',
    },
    statValue: {
      fontSize: 28,
      fontWeight: '900' as const,
      letterSpacing: -0.5,
    },
    title: {
      fontSize: 32,
      fontWeight: '900' as const,
      color: '#E2F0FF',
    },
    body: {
      fontSize: 14,
      lineHeight: 22,
      color: '#94A3B8',
    },
  },

  shadows: {
    cyan: {
      shadowColor: '#00D4FF',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 20,
      elevation: 10,
    },
    mint: {
      shadowColor: '#00FFB3',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 8,
    },
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
  },

  card: {
    backgroundColor: '#0C1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 20,
  },

  cardAccentBar: {
    height: 2,
    backgroundColor: '#00D4FF',
    opacity: 0.7,
  },
};

export default theme;
