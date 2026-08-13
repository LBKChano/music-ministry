import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { ProfileFocusedHeader } from '@/components/profile/profile-focused-header';
import { ProfileStatus } from '@/components/profile/profile-primitives';
import {
  useAppAppearance,
  useAppTheme,
} from '@/contexts/AppThemeContext';
import type { AppearancePreference } from '@/lib/ui/appearance-preference';
import type { AppTheme } from '@/lib/ui/app-theme';
import { resolveSurfaceOpacity } from '@/lib/ui/surface-system';

const APPEARANCE_OPTIONS: readonly {
  value: AppearancePreference;
  label: string;
  description: string;
  iosIcon: string;
  androidIcon: React.ComponentProps<typeof IconSymbol>['android_material_icon_name'];
}[] = [
  {
    value: 'system',
    label: 'System',
    description: 'Follow this device’s appearance setting.',
    iosIcon: 'circle.lefthalf.filled',
    androidIcon: 'settings-brightness',
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Always use the light appearance.',
    iosIcon: 'sun.max.fill',
    androidIcon: 'light-mode',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Always use the dark appearance.',
    iosIcon: 'moon.stars.fill',
    androidIcon: 'dark-mode',
  },
] as const;

export function ProfileAppearanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const {
    preference,
    resolvedMode,
    setPreference,
  } = useAppAppearance();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<'success' | 'error'>('success');

  const selectAppearance = async (nextPreference: AppearancePreference) => {
    if (saving || nextPreference === preference) return;
    setSaving(true);
    setMessage(null);
    const saved = await setPreference(nextPreference);
    setTone(saved ? 'success' : 'error');
    setMessage(saved
      ? `${APPEARANCE_OPTIONS.find(option => option.value === nextPreference)?.label} appearance selected.`
      : 'Appearance could not be saved. Your previous setting was restored.');
    setSaving(false);
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProfileFocusedHeader
        disabled={saving}
        onBack={() => router.back()}
        subtitle={`Currently displaying ${resolvedMode} mode on this device`}
        title="Appearance"
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 32 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <ProfileStatus message={message} tone={tone} />
        <View
          accessibilityLabel="Appearance options"
          accessibilityRole="radiogroup"
          style={styles.optionGroup}
        >
          {APPEARANCE_OPTIONS.map((option, index) => {
            const selected = preference === option.value;
            return (
              <React.Fragment key={option.value}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  accessibilityHint={option.description}
                  accessibilityLabel={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: saving }}
                  disabled={saving}
                  onPress={() => void selectAppearance(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.selectedOption,
                    {
                      opacity: resolveSurfaceOpacity({
                        disabled: saving,
                        pressed,
                        theme,
                      }),
                    },
                  ]}
                >
                  <View style={[
                    styles.iconTile,
                    selected && styles.selectedIconTile,
                  ]}>
                    <IconSymbol
                      android_material_icon_name={option.androidIcon}
                      color={selected
                        ? theme.button.primaryForeground
                        : theme.iconTile.foreground}
                      ios_icon_name={option.iosIcon}
                      size={23}
                    />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle}>{option.label}</Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                  <View style={[
                    styles.radio,
                    selected && styles.selectedRadio,
                  ]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>
        <Text style={styles.footnote}>
          This preference is stored only on this device and does not affect your account or other devices.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.canvas,
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 720,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: '100%',
  },
  optionGroup: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderSubtle,
    borderRadius: theme.radii.surface,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: {
    backgroundColor: theme.divider.color,
    height: StyleSheet.hairlineWidth,
    marginLeft: 76,
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  selectedOption: {
    backgroundColor: theme.inputHighlight.surface,
  },
  iconTile: {
    alignItems: 'center',
    backgroundColor: theme.iconTile.surface,
    borderRadius: theme.iconTile.radius,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  selectedIconTile: {
    backgroundColor: theme.button.primarySurface,
  },
  optionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  optionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  optionDescription: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  radio: {
    alignItems: 'center',
    borderColor: theme.colors.borderStrong,
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  selectedRadio: {
    borderColor: theme.colors.accent,
  },
  radioDot: {
    backgroundColor: theme.colors.accent,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  footnote: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
});
