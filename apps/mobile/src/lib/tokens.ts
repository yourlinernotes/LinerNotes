/**
 * @linernotes/core/tokens
 *
 * Brand design tokens shared across web and mobile.
 * Based on Claude Design handoff (LinerNotes Mobile.html)
 */

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const colors = {
  /** App background - #0c0b0a (dark mode) */
  bg: '#0c0b0a',
  bgLight: '#f3ede1', // light mode

  /** Primary text - #f1ebe0 (cream) */
  fg: '#f1ebe0',
  fgLight: '#23201b', // light mode
  fgRgb: '241,235,224', // for rgba()

  /** Line/border color */
  lineRgb: '255,255,255', // for rgba()

  /** Muted text */
  muted: '#aaa298',

  /** Gold accents */
  gold: '#d9b25a',
  goldBright: '#c8a45c',

  /** Reaction colors */
  flame: '#e0762f',
  love: '#d98aa0',
  skip: '#7a7468',

  /** Confirm green (for connected states) */
  confirmGreen: '#7fcf9b',

  /** Near-black for Experience overlay */
  nearBlack: '#0a0908',

  /** Elevated card surface (subtly lighter than bg) */
  surface: '#141210',
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  /** Font families (from Claude Design) */
  fonts: {
    /** Display/headlines - Newsreader or Hanken Grotesk */
    display: 'Newsreader',
    /** Body text - Hanken Grotesk */
    body: 'Hanken Grotesk',
    /** Monospace - Space Mono for labels/timestamps */
    mono: 'Space Mono',
    /** Preview line (italic quotes) - EB Garamond */
    preview: 'EB Garamond',
  },

  /** Font sizes (from design) */
  sizes: {
    // App chrome
    appTitle: 23,
    betaBadge: 8.5,

    // Card
    cardTitle: 21,
    cardArtist: 13.5,
    previewLine: 17.5,
    momentNote: 12.5,

    // Feed
    userName: 13.5,
    userHandle: 10.5,
    actionButton: 12,

    // Experience
    experienceTitle: 27,
    experienceArtist: 15,
    experienceQuote: 20,
    experienceBody: 14.5,

    // General
    body: 13.5,
    caption: 10.5,
    label: 11.5,
  },

  /** Font weights */
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

// ============================================================================
// LAYOUT
// ============================================================================

export const layout = {
  /** Spacing (from design) */
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 18,
    xl: 24,
    xxl: 32,
  },

  /** Border radius */
  radius: {
    card: 18,
    pill: 999,
    button: 12,
    sm: 6,
    md: 10,
    lg: 14,
  },

  /** Feed spacing */
  feedGap: 30,
  feedPadding: 16,

  /** Card padding by depth */
  cardPadding: {
    full: { vertical: 18, horizontal: 18 },
    caption: { vertical: 15, horizontal: 17 },
    floor: { vertical: 16, horizontal: 17 },
  },
} as const;

// ============================================================================
// CARD LAYOUT
// ============================================================================

export const card = {
  /** Album art placement */
  artworkPosition: {
    /** Album Art Dominant: top 60% */
    dominant: {
      top: 0,
      height: '60%',
    },
    /** Balanced: top 40% */
    balanced: {
      top: 0,
      height: '40%',
    },
  },

  /** Content overlay (bottom 40% or 60%) */
  overlayGradient: {
    /** For Album Art Dominant variant */
    dominant: 'linear-gradient(180deg, rgba(10, 10, 10, 0) 0%, rgba(10, 10, 10, 0.85) 40%, rgba(10, 10, 10, 1) 100%)',
    /** For balanced variant */
    balanced: 'linear-gradient(180deg, rgba(10, 10, 10, 0.6) 0%, rgba(10, 10, 10, 1) 60%)',
  },

  /** Timestamp notch positioning */
  notch: {
    /** Distance from top of content area */
    offsetY: -12,
    /** Width */
    width: 120,
    /** Height */
    height: 40,
    /** Background */
    background: colors.gold,
    /** Text color */
    color: colors.nearBlack,
  },
} as const;

// ============================================================================
// ICONS & REACTIONS
// ============================================================================

export const reactions = {
  flame: {
    icon: '🔥',
    label: 'Standout',
    color: '#FF6B35',
  },
  love: {
    icon: '❤️',
    label: 'Love',
    color: '#FF3366',
  },
  skip: {
    icon: '⏭️',
    label: 'Skip',
    color: '#6B7280',
  },
} as const;

// ============================================================================
// EXPORT ALL
// ============================================================================

export const tokens = {
  colors,
  typography,
  layout,
  card,
  reactions,
} as const;

export default tokens;
