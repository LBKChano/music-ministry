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
    border: string;
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

const lightBrand = {
  navy: '#102E52',
  accent: '#1E3A8A',
  bright: '#2563EB',
} as const;

const darkBrand = {
  navy: '#081B32',
  accent: '#0D2F5B',
  bright: '#154A8A',
} as const;

export const lightAppTheme: AppTheme = {
  mode: 'light',
  colors: {
    canvas: '#F4F7FB',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F5FA',
    surfaceElevated: '#FFFFFF',
    surfaceStrong: lightBrand.navy,
    textPrimary: '#1A202C',
    textSecondary: '#52627A',
    textTertiary: '#66758C',
    borderSubtle: '#D9E3EF',
    borderStrong: '#B7C6D8',
    accent: lightBrand.accent,
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
    surface: lightBrand.accent,
    border: '#60A5FA',
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
    primarySurface: lightBrand.accent,
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
    surface: lightBrand.navy,
    foreground: '#F8FBFF',
  },
  header: {
    gradient: [lightBrand.navy, lightBrand.accent, lightBrand.bright],
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
    foreground: lightBrand.accent,
  },
};

export const futureDarkAppTheme: AppTheme = {
  mode: 'dark',
  colors: {
    canvas: '#07111E',
    surface: '#0D1A29',
    surfaceMuted: '#122235',
    surfaceElevated: '#16293D',
    surfaceStrong: darkBrand.navy,
    textPrimary: '#F7FAFC',
    textSecondary: '#B6C2D2',
    textTertiary: '#8E9EB2',
    borderSubtle: '#283D54',
    borderStrong: '#3B5570',
    accent: '#6FA7FF',
    accentSoft: '#142B47',
    navigationSurface: 'rgba(10, 25, 42, 0.88)',
    navigationOpaqueSurface: '#0B1B2E',
    navigationSelected: '#102C52',
    navigationSelectedForeground: '#81B3FF',
    navigationInactive: '#9AA9BD',
    navigationBorder: '#32485F',
    navigationAccent: '#4A91FF',
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
      surface: '#102D4D',
      foreground: '#B8D8FF',
      border: '#315F8C',
    },
  },
  strongSurface: {
    foreground: '#FFFFFF',
    mutedForeground: '#D5E4F7',
  },
  serviceMetadata: {
    surface: darkBrand.accent,
    border: '#4D8FEA',
    foreground: '#FFFFFF',
    mutedForeground: '#BBD4F6',
  },
  modalHeader: {
    surface: '#0B2037',
    foreground: '#F3F7FC',
    mutedForeground: '#B2C5DA',
    accent: '#6FA7FF',
  },
  modal: {
    backdrop: 'rgba(0, 0, 0, 0.72)',
    surface: '#0D1A29',
    footerSurface: '#102033',
    border: '#3B5570',
  },
  input: {
    surface: '#102033',
    foreground: '#F7FAFC',
    placeholder: '#8E9EB2',
    border: '#3B5570',
  },
  button: {
    primarySurface: '#6FA7FF',
    primaryForeground: '#071426',
    secondarySurface: '#102033',
    secondaryForeground: '#F7FAFC',
    secondaryBorder: '#3B5570',
    destructiveSurface: '#FFB3BE',
    destructiveForeground: '#3A1D25',
  },
  inputHighlight: {
    surface: '#102B4B',
    foreground: '#F3F7FC',
    border: '#4B7FC6',
  },
  brandMark: {
    surface: darkBrand.navy,
    foreground: '#F8FBFF',
  },
  header: {
    gradient: [darkBrand.navy, darkBrand.accent, darkBrand.bright],
    title: '#FFFFFF',
    subtitle: '#DDEBFA',
    eyebrow: '#C7DAF3',
    accentPanel: 'rgba(111, 167, 255, 0.07)',
    accentLine: '#4D8FEA',
    controlSurface: 'rgba(255, 255, 255, 0.08)',
    controlBorder: 'rgba(183, 208, 240, 0.22)',
    shadow: '0 8px 20px rgba(0, 0, 0, 0.42)',
  },
  ...sharedStructure,
  interaction: {
    ...sharedStructure.interaction,
    focusRing: '#6FA7FF',
  },
  divider: {
    color: '#283D54',
    strongColor: '#3B5570',
    width: 1,
  },
  elevation: {
    low: '0 1px 3px rgba(0, 0, 0, 0.28)',
    medium: '0 7px 18px rgba(0, 0, 0, 0.36)',
    header: '0 8px 20px rgba(0, 0, 0, 0.42)',
  },
  iconTile: {
    size: 48,
    radius: 8,
    surface: '#122B48',
    foreground: '#8EB7FF',
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
