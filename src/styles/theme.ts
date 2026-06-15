export const theme = {
  brand: {
    primary: '#c72025',
    primaryHover: '#a61b1f',
    primaryActive: '#8f171b',

    primaryLight: '#FEF2F2',
    primaryBorder: '#FECACA',
    primaryMuted: '#FCA5A5',
  },

  neutral: {
    background: '#F8FAFC',
    surface: '#FFFFFF',

    border: '#E5EAF1',
    borderStrong: '#CBD5E1',

    text: '#0B1220',
    textSecondary: '#475569',
    textMuted: '#64748B',
  },

  sidebar: {
    background: '#0B1220',
    border: '#172033',

    text: '#E2E8F0',
    textMuted: '#94A3B8',

    activeBackground: '#3B0A0C',
    activeText: '#FFFFFF',

    hoverBackground: '#172033',
    hoverText: '#E2E8F0',
  },

  risk: {
    high: '#DC2626',
    medium: '#F59E0B',
    low: '#15803D',
  },

  status: {
    success: '#15803D',
    successLight: '#F0FDF4',

    warning: '#F59E0B',
    warningLight: '#FFFBEB',

    error: '#DC2626',
    errorLight: '#FEF2F2',

    // More trustworthy than bright cyan
    info: '#1E40AF',
    infoLight: '#EFF6FF',
  },

  charts: {
    primary: '#c72025',

    // Trust
    secondary: '#1E3A5F',

    // Neutral analytics
    tertiary: '#64748B',

    // Action / Attention
    accent1: '#F59E0B',

    // Positive outcome
    accent2: '#15803D',

    // Intelligence / Trust
    accent3: '#2563EB',
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
      'linear-gradient(135deg, #0B1220 0%, #1E3A5F 100%)',
  },

  shadow: {
    card: '0 2px 8px rgba(15, 23, 42, 0.06)',
    modal: '0 24px 48px rgba(15, 23, 42, 0.16)',

    brand:
      '0 10px 25px rgba(199, 32, 37, 0.20)',
  },
} as const;