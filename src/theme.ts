/**
 * EnZIME Theme System — Nocturnal Teal Palette
 *
 * Single design-token source reconciled 1:1 with LIBS/UI/STITCH/DESIGN.md (UI-3).
 * Dark mode is the default and only fully-realized mode; light mode is structurally
 * present but not primary.
 */

export const theme = {
  dark: {
    // Surface colors (deep nocturnal blues)
    surface: '#051424',
    surfaceDim: '#051424',
    surfaceBright: '#2c3a4c',
    surfaceContainerLowest: '#010f1f',
    surfaceContainerLow: '#0d1c2d',
    surfaceContainer: '#122131',
    surfaceContainerHigh: '#1c2b3c',
    surfaceContainerHighest: '#273647',

    // On-surface colors (high lightness for contrast)
    onSurface: '#d4e4fa',
    onSurfaceVariant: '#bbcac6',

    // Primary colors (teal-emerald for high-signal actions)
    primary: '#4fdbc8',
    onPrimary: '#003731',
    primaryContainer: '#14b8a6',
    onPrimaryContainer: '#00423b',

    // Inverse colors
    inverseSurface: '#d4e4fa',
    inverseOnSurface: '#233143',
    inversePrimary: '#006b5f',

    // Secondary colors
    secondary: '#44e2cd',
    onSecondary: '#003731',
    secondaryContainer: '#03c6b2',
    onSecondaryContainer: '#004d44',

    // Tertiary colors
    tertiary: '#bec6e0',
    onTertiary: '#283044',
    tertiaryContainer: '#9ca4bd',
    onTertiaryContainer: '#323a4f',

    // Error colors
    error: '#ffb4ab',
    onError: '#690005',
    errorContainer: '#93000a',
    onErrorContainer: '#ffdad6',

    // Background
    background: '#051424',
    onBackground: '#d4e4fa',

    // Outline/border
    outline: '#859490',
    outlineVariant: '#3c4947',

    // Surface tint
    surfaceTint: '#4fdbc8',

    // Surface variant
    surfaceVariant: '#273647',
  },
  light: {
    // Light mode structurally present but not primary
    surface: '#ffffff',
    surfaceDim: '#d4e4fa',
    surfaceBright: '#f8fafc',
    surfaceContainerLowest: '#f8fafc',
    surfaceContainerLow: '#f1f5f9',
    surfaceContainer: '#e2e8f0',
    surfaceContainerHigh: '#cbd5e1',
    surfaceContainerHighest: '#94a3b8',

    onSurface: '#0f172a',
    onSurfaceVariant: '#475569',

    primary: '#14b8a6',
    onPrimary: '#ffffff',
    primaryContainer: '#ccfbf1',
    onPrimaryContainer: '#004d44',

    inverseSurface: '#1e293b',
    inverseOnSurface: '#f8fafc',
    inversePrimary: '#006b5f',

    secondary: '#64748b',
    onSecondary: '#ffffff',
    secondaryContainer: '#e2e8f0',
    onSecondaryContainer: '#1e293b',

    tertiary: '#64748b',
    onTertiary: '#ffffff',
    tertiaryContainer: '#e2e8f0',
    onTertiaryContainer: '#1e293b',

    error: '#dc2626',
    onError: '#ffffff',
    errorContainer: '#fee2e2',
    onErrorContainer: '#7f1d1d',

    background: '#ffffff',
    onBackground: '#0f172a',

    outline: '#94a3b8',
    outlineVariant: '#cbd5e1',

    surfaceTint: '#14b8a6',
    surfaceVariant: '#f1f5f9',
  },
};

export type ThemeMode = 'light' | 'dark';

/**
 * Applies theme tokens as CSS custom properties on :root
 *
 * @param mode - 'dark' or 'light' theme mode
 */
export function applyTheme(mode: ThemeMode): void {
  const tokens = theme[mode];
  const root = document.documentElement;

  // Apply color tokens
  (Object.keys(tokens) as Array<keyof typeof tokens>).forEach((key) => {
    const value = tokens[key];
    if (typeof value === 'string') {
      root.style.setProperty(`--${key}`, value);
    }
  });

  // Apply spacing (8px grid base)
  root.style.setProperty('--spacing-base', '8px');

  // Apply roundness (ROUND_FOUR: buttons/inputs 4px, cards/progress 8px, chips pill)
  root.style.setProperty('--radius-sm', '4px');   // buttons, inputs
  root.style.setProperty('--radius-md', '8px');   // cards, progress containers
  root.style.setProperty('--radius-lg', '9999px'); // pill chips

  // Apply font stacks
  root.style.setProperty(
    '--font-display',
    'Space Grotesk, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif'
  );
  root.style.setProperty(
    '--font-body',
    'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif'
  );
  root.style.setProperty(
    '--font-reading',
    'Literata, Georgia, Cambria, "Times New Roman", Times, serif'
  );

  // Apply font family aliases
  root.style.setProperty('--font-heading', 'var(--font-display)');
  root.style.setProperty('--font-label', 'var(--font-display)');
  root.style.setProperty('--font-chrome', 'var(--font-display)');
  root.style.setProperty('--font-metadata', 'var(--font-body)');
}
