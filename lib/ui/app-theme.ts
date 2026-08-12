export type AppThemeMode = 'light' | 'dark';

export interface AppThemeStatusTokens {
  surface: string;
  foreground: string;
  border: string;
}

export interface AppTheme {
  mode: AppThemeMode;
  colors: {
    canvas: string;
    surface: string;
    surfaceMuted: string;
    surfaceElevated: string;
    surfaceStrong: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    borderSubtle: string;
    borderStrong: string;
    accent: string;
    accentSoft: string;
    navigationSurface: string;
    navigationOpaqueSurface: string;
    navigationSelected: string;
    navigationSelectedForeground: string;
    navigationInactive: string;
    navigationBorder: string;
    navigationAccent: string;
  };
  status: {
    success: AppThemeStatusTokens;
    warning: AppThemeStatusTokens;
    error: AppThemeStatusTokens;
    info: AppThemeStatusTokens;
  };
  strongSurface: {
    foreground: string;
    mutedForeground: string;
  };
  serviceMetadata: {
    surface: string;
    foreground: string;
    mutedForeground: string;
  };
  modalHeader: {
    surface: string;
    foreground: string;
    mutedForeground: string;
    accent: string;
  };
  modal: {
    backdrop: string;
    surface: string;
    footerSurface: string;
    border: string;
  };
  input: {
    surface: string;
    foreground: string;
    placeholder: string;
    border: string;
  };
  button: {
    primarySurface: string;
    primaryForeground: string;
    secondarySurface: string;
    secondaryForeground: string;
    secondaryBorder: string;
    destructiveSurface: string;
    destructiveForeground: string;
  };
  inputHighlight: {
    surface: string;
    foreground: string;
    border: string;
  };
  brandMark: {
    surface: string;
    foreground: string;
  };
  header: {
    gradient: readonly [string, string, string];
    title: string;
    subtitle: string;
    eyebrow: string;
    accentPanel: string;
    accentLine: string;
    controlSurface: string;
    controlBorder: string;
    shadow: string;
  };
  spacing: {
    xxs: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radii: {
    compact: number;
    control: number;
    surface: number;
    modal: number;
    header: number;
    pill: number;
  };
  divider: {
    color: string;
    strongColor: string;
    width: number;
  };
  elevation: {
    low: string;
    medium: string;
    header: string;
  };
  iconTile: {
    size: number;
    radius: number;
    surface: string;
    foreground: string;
  };
  interaction: {
    pressedOpacity: number;
    disabledOpacity: number;
    focusRing: string;
  };
}

const sharedStructure = {
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radii: {
    compact: 6,
    control: 8,
    surface: 8,
    modal: 8,
    header: 24,
    pill: 999,
  },
  interaction: {
    pressedOpacity: 0.72,
    disabledOpacity: 0.5,
    focusRing: '#4F7ED8',
  },
} as const;

export const lightAppTheme: AppTheme = {
  mode: 'light',
  colors: {
    canvas: '#F4F7FB',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F5FA',
    surfaceElevated: '#FFFFFF',
    surfaceStrong: '#102E52',
    textPrimary: '#1A202C',
    textSecondary: '#52627A',
    textTertiary: '#66758C',
    borderSubtle: '#D9E3EF',
    borderStrong: '#B7C6D8',
    accent: '#1E3A8A',
    accentSoft: '#E8F0FF',
    navigationSurface: 'rgba(248, 251, 255, 0.84)',
    navigationOpaqueSurface: '#F8FBFF',
    navigationSelected: '#E3EEFF',
    navigationSelectedForeground: '#173A70',
    navigationInactive: '#52627A',
    navigationBorder: '#C9D9EC',
    navigationAccent: '#4F8EF7',
  },
  status: {
    success: {
      surface: '#E9F7EF',
      foreground: '#17603A',
      border: '#A7DCC0',
    },
    warning: {
      surface: '#FFF5D9',
      foreground: '#714700',
      border: '#E9CA7A',
    },
    error: {
      surface: '#FDECEC',
      foreground: '#A92828',
      border: '#F2B7B7',
    },
    info: {
      surface: '#EAF3FF',
      foreground: '#174F8F',
      border: '#B7D3F5',
    },
  },
  strongSurface: {
    foreground: '#FFFFFF',
    mutedForeground: '#DCEAFF',
  },
  serviceMetadata: {
    surface: '#102E52',
    foreground: '#FFFFFF',
    mutedForeground: '#DCEAFF',
  },
  modalHeader: {
    surface: '#EAF2FC',
    foreground: '#17345D',
    mutedForeground: '#526B8C',
    accent: '#2D63C8',
  },
  modal: {
    backdrop: 'rgba(15, 23, 42, 0.62)',
    surface: '#FFFFFF',
    footerSurface: '#F8FBFF',
    border: '#B7C6D8',
  },
  input: {
    surface: '#FFFFFF',
    foreground: '#1A202C',
    placeholder: '#66758C',
    border: '#B7C6D8',
  },
  button: {
    primarySurface: '#1E3A8A',
    primaryForeground: '#FFFFFF',
    secondarySurface: '#F0F5FA',
    secondaryForeground: '#1A202C',
    secondaryBorder: '#B7C6D8',
    destructiveSurface: '#A92828',
    destructiveForeground: '#FFFFFF',
  },
  inputHighlight: {
    surface: '#EEF5FF',
    foreground: '#17345D',
    border: '#5184DE',
  },
  brandMark: {
    surface: '#091C35',
    foreground: '#F8FBFF',
  },
  header: {
    gradient: ['#0F172A', '#1E3A8A', '#2563EB'],
    title: '#FFFFFF',
    subtitle: '#EFF6FF',
    eyebrow: '#EFF6FF',
    accentPanel: 'rgba(255, 255, 255, 0.09)',
    accentLine: '#60A5FA',
    controlSurface: 'rgba(255, 255, 255, 0.16)',
    controlBorder: 'rgba(255, 255, 255, 0.28)',
    shadow: '0 8px 14px rgba(15, 23, 42, 0.18)',
  },
  ...sharedStructure,
  divider: {
    color: '#D9E3EF',
    strongColor: '#B7C6D8',
    width: 1,
  },
  elevation: {
    low: '0 1px 3px rgba(15, 23, 42, 0.08)',
    medium: '0 6px 16px rgba(15, 23, 42, 0.12)',
    header: '0 8px 14px rgba(15, 23, 42, 0.18)',
  },
  iconTile: {
    size: 48,
    radius: 8,
    surface: '#EAF3FF',
    foreground: '#1E3A8A',
  },
};

export const futureDarkAppTheme: AppTheme = {
  mode: 'dark',
  colors: {
    canvas: '#0B111B',
    surface: '#131C29',
    surfaceMuted: '#182536',
    surfaceElevated: '#1D2A3B',
    surfaceStrong: '#123A69',
    textPrimary: '#F7FAFC',
    textSecondary: '#C1CCDA',
    textTertiary: '#98A8BC',
    borderSubtle: '#2C3B4E',
    borderStrong: '#43556D',
    accent: '#8FB8FF',
    accentSoft: '#1B3150',
    navigationSurface: 'rgba(21, 33, 50, 0.88)',
    navigationOpaqueSurface: '#152132',
    navigationSelected: '#294D7C',
    navigationSelectedForeground: '#F1F6FF',
    navigationInactive: '#B9C7D8',
    navigationBorder: '#43556D',
    navigationAccent: '#78B7FF',
  },
  status: {
    success: {
      surface: '#123524',
      foreground: '#9CE2B9',
      border: '#286947',
    },
    warning: {
      surface: '#3B2D12',
      foreground: '#F6D88B',
      border: '#765B25',
    },
    error: {
      surface: '#3A1D25',
      foreground: '#FFB3BE',
      border: '#7B3544',
    },
    info: {
      surface: '#173252',
      foreground: '#B8D8FF',
      border: '#376492',
    },
  },
  strongSurface: {
    foreground: '#FFFFFF',
    mutedForeground: '#DCEAFF',
  },
  serviceMetadata: {
    surface: '#123A69',
    foreground: '#FFFFFF',
    mutedForeground: '#D5E7FF',
  },
  modalHeader: {
    surface: '#1B2B40',
    foreground: '#F3F7FC',
    mutedForeground: '#B7C6D8',
    accent: '#8FB8FF',
  },
  modal: {
    backdrop: 'rgba(0, 0, 0, 0.72)',
    surface: '#131C29',
    footerSurface: '#182536',
    border: '#43556D',
  },
  input: {
    surface: '#182536',
    foreground: '#F7FAFC',
    placeholder: '#98A8BC',
    border: '#43556D',
  },
  button: {
    primarySurface: '#8FB8FF',
    primaryForeground: '#091426',
    secondarySurface: '#182536',
    secondaryForeground: '#F7FAFC',
    secondaryBorder: '#43556D',
    destructiveSurface: '#FFB3BE',
    destructiveForeground: '#3A1D25',
  },
  inputHighlight: {
    surface: '#1A2C44',
    foreground: '#F3F7FC',
    border: '#709BE0',
  },
  brandMark: {
    surface: '#091C35',
    foreground: '#F8FBFF',
  },
  header: {
    gradient: ['#091426', '#123A69', '#1D56A8'],
    title: '#FFFFFF',
    subtitle: '#E5F0FF',
    eyebrow: '#E5F0FF',
    accentPanel: 'rgba(255, 255, 255, 0.08)',
    accentLine: '#78B7FF',
    controlSurface: 'rgba(255, 255, 255, 0.13)',
    controlBorder: 'rgba(255, 255, 255, 0.25)',
    shadow: '0 8px 18px rgba(0, 0, 0, 0.34)',
  },
  ...sharedStructure,
  interaction: {
    ...sharedStructure.interaction,
    focusRing: '#8FB8FF',
  },
  divider: {
    color: '#2C3B4E',
    strongColor: '#43556D',
    width: 1,
  },
  elevation: {
    low: '0 1px 3px rgba(0, 0, 0, 0.24)',
    medium: '0 7px 18px rgba(0, 0, 0, 0.3)',
    header: '0 8px 18px rgba(0, 0, 0, 0.34)',
  },
  iconTile: {
    size: 48,
    radius: 8,
    surface: '#1B3150',
    foreground: '#A8C8FF',
  },
};

function channelValue(hex: string, offset: number): number {
  return Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
}

function relativeLuminance(hex: string): number {
  const normalized = hex.trim();
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Contrast colors must use six-digit hex values: ${hex}`);
  }

  const channels = [1, 3, 5].map(offset => {
    const value = channelValue(normalized, offset);
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (
    0.2126 * channels[0]
    + 0.7152 * channels[1]
    + 0.0722 * channels[2]
  );
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function createNavigationThemeColors(theme: AppTheme) {
  return {
    primary: theme.colors.accent,
    background: theme.colors.canvas,
    card: theme.colors.surface,
    text: theme.colors.textPrimary,
    border: theme.colors.borderSubtle,
    notification: theme.status.error.foreground,
  };
}
