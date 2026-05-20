import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Base dimensions (iPhone 14 Pro)
const BASE_W = 393;
const BASE_H = 852;

export const wp = (percent: number) => (SCREEN_W * percent) / 100;
export const hp = (percent: number) => (SCREEN_H * percent) / 100;

export const scale = (size: number) => (SCREEN_W / BASE_W) * size;
export const verticalScale = (size: number) => (SCREEN_H / BASE_H) * size;
export const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

export const fs = (size: number) =>
  Math.round(moderateScale(size) / PixelRatio.getFontScale());

export const SCREEN = { W: SCREEN_W, H: SCREEN_H };
