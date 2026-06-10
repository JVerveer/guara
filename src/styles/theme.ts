export const theme = {
  brand: {
    // Main Guara color
    primary: '#c72025',
    primaryHover: '#a61b1f',
    primaryActive: '#8f171b',

    // Light variants
    primaryLight: '#FEF2F2',
    primaryBorder: '#FECACA',
    primaryMuted: '#FCA5A5',
  },

  neutral: {
    background: '#F8FAFC',
    surface: '#FFFFFF',

    border: '#E2E8F0',
    borderStrong: '#CBD5E1',

    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
  },

  sidebar: {
    background: '#0F172A',
    border: '#1E293B',

    text: '#CBD5E1',
    textMuted: '#64748B',

    activeBackground: '#3B0A0C',
    activeText: '#FCA5A5',
  },

  risk: {
    high: '#DC2626',
    medium: '#D97706',
    low: '#16A34A',
  },

  status: {
    success: '#16A34A',
    successLight: '#F0FDF4',

    warning: '#D97706',
    warningLight: '#FFF7ED',

    error: '#DC2626',
    errorLight: '#FEF2F2',

    info: '#0284C7',
    infoLight: '#F0F9FF',
  },

  charts: {
    primary: '#c72025',
    secondary: '#0F172A',
    tertiary: '#64748B',

    accent1: '#D97706',
    accent2: '#16A34A',
    accent3: '#0284C7',
  },

  cloud: {
    aws: '#FF9900',
    azure: '#0078D4',
    gcp: '#4285F4',
  },

  gradients: {
    brand:
      'linear-gradient(135deg, #c72025 0%, #a61b1f 100%)',

    hero:
      'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
  },

  shadow: {
    card: '0 1px 3px rgba(15, 23, 42, 0.08)',
    modal: '0 20px 40px rgba(15, 23, 42, 0.15)',

    brand:
      '0 10px 25px rgba(199, 32, 37, 0.20)',
  },
} as const;