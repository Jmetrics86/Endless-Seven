/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Environment theme for accessibility (3D scene + UI). */
export type EnvironmentTheme = 'dark' | 'light';

/** Hex colors for the 3D scene per theme. Dark: slate gray + deep red. Light: white + blues. */
export const ENV_THEME_COLORS = {
  dark: {
    sceneBg: 0x1e293b,      /* slate-800 */
    sceneFog: 0x1e293b,
    floor: 0x334155,        /* slate-700 */
    sealBase: 0x475569,     /* slate-600 */
    sealEmissive: 0x334155,
    slotFill: 0x475569,
    slotOpacity: 0.25,
    pileBase: 0x1e293b,
    pileBaseOpacity: 0.75,
    pileDeckLayer: 0x334155,
  },
  light: {
    sceneBg: 0xf8fafc,      /* slate-50 / white */
    sceneFog: 0xf8fafc,
    floor: 0xe2e8f0,        /* slate-200 */
    sealBase: 0xcbd5e1,     /* slate-300 */
    sealEmissive: 0xf1f5f9, /* slate-100 */
    slotFill: 0x94a3b8,     /* slate-400 */
    slotOpacity: 0.4,
    pileBase: 0xe2e8f0,
    pileBaseOpacity: 0.5,
    pileDeckLayer: 0xf1f5f9,
  },
} as const;

export const THEME_STORAGE_KEY = 'endless-seven-environment-theme';
