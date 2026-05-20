import { moderateScale, fs, scale } from './utils/responsive';

export const colors = {
  primary: '#1a1a2e',
  primaryLight: '#2d2d4e',
  accent: '#4f8ef7',
  success: '#27ae60',
  warning: '#f39c12',
  danger: '#e74c3c',
  background: '#f0f2f8',
  surface: '#ffffff',
  border: '#e0e0e0',
  textPrimary: '#1a1a2e',
  textSecondary: '#666',
  textMuted: '#aaa',
  pending: '#f39c12',
  approved: '#27ae60',
  rejected: '#e74c3c',
};

export const spacing = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(14),
  lg: moderateScale(20),
  xl: moderateScale(28),
  xxl: moderateScale(36),
};

export const radius = {
  sm: moderateScale(8),
  md: moderateScale(12),
  lg: moderateScale(18),
  xl: moderateScale(24),
  full: moderateScale(50),
};

export const typography = {
  h1: { fontSize: fs(26), fontWeight: '700' as const },
  h2: { fontSize: fs(20), fontWeight: '700' as const },
  h3: { fontSize: fs(17), fontWeight: '600' as const },
  body: { fontSize: fs(14), fontWeight: '400' as const },
  bodyBold: { fontSize: fs(14), fontWeight: '600' as const },
  caption: { fontSize: fs(12), fontWeight: '400' as const },
  tiny: { fontSize: fs(10), fontWeight: '400' as const },
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
};

export const MIN_TOUCH = moderateScale(48);
