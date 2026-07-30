import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { WordSafeHeaderText } from '@/components/navigation/word-safe-header-text';
import { useChurch } from '@/hooks/useChurch';
import { colors } from '@/styles/commonStyles';

export function ChurchSwitcher() {
  const router = useRouter();
  const {
    churches,
    churchAccess,
    currentChurch,
    sessionStatus,
    switchChurch,
  } = useChurch();
  const [switchingChurchId, setSwitchingChurchId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const accessByChurch = useMemo(
    () => new Map(churchAccess.map(access => [access.churchId, access])),
    [churchAccess],
  );
  const isSwitching = sessionStatus === 'selecting-church';

  const selectChurch = async (churchId: string) => {
    if (
      isSwitching
      || churchId === currentChurch?.id
    ) return;

    setSwitchError(null);
    setSwitchingChurchId(churchId);
    const result = await switchChurch(churchId);
    if (result.status === 'error') {
      setSwitchError(result.error);
    } else if (result.status === 'no-membership') {
      setSwitchError('You no longer have access to that church.');
    }
    setSwitchingChurchId(null);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <IconSymbol
            ios_icon_name="building.2.fill"
            android_material_icon_name="business"
            size={22}
            color={colors.primary}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Your Churches
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {churches.length === 1
              ? '1 church connected to this account'
              : `${churches.length} churches connected to this account`}
          </Text>
        </View>
      </View>

      <View style={styles.churchList}>
        {churches.map(church => {
          const selected = church.id === currentChurch?.id;
          const access = accessByChurch.get(church.id);
          const rowBusy = switchingChurchId === church.id && isSwitching;

          return (
            <Pressable
              key={church.id}
              accessibilityRole="button"
              accessibilityLabel={`${church.name}, ${access?.roleLabel ?? 'Member'}`}
              accessibilityHint={selected ? 'Currently selected church' : 'Switch to this church'}
              accessibilityState={{
                selected,
                busy: rowBusy,
                disabled: isSwitching,
              }}
              disabled={isSwitching}
              onPress={() => {
                void selectChurch(church.id);
              }}
              style={({ pressed }) => [
                styles.churchRow,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected
                    ? colors.backgroundAlt
                    : colors.card,
                },
                pressed && !selected && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.selectionIcon,
                  {
                    backgroundColor: selected ? colors.primary : colors.inputBackground,
                  },
                ]}
              >
                {rowBusy ? (
                  <ActivityIndicator
                    size="small"
                    color={selected ? colors.headerText : colors.primary}
                  />
                ) : (
                  <IconSymbol
                    ios_icon_name={selected ? 'checkmark' : 'building.2'}
                    android_material_icon_name={selected ? 'check' : 'business'}
                    size={18}
                    color={selected ? colors.headerText : colors.primary}
                  />
                )}
              </View>

              <View style={styles.churchCopy}>
                <WordSafeHeaderText
                  accessible={false}
                  maxFontSizeMultiplier={1.35}
                  style={[styles.churchName, { color: colors.text }]}
                  text={church.name}
                />
                {selected ? (
                  <Text style={[styles.currentLabel, { color: colors.primary }]}>
                    Current church
                  </Text>
                ) : null}
              </View>

              <View
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor: access?.isAdmin
                      ? colors.navyLight
                      : colors.inputBackground,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    { color: access?.isAdmin ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {access?.roleLabel ?? 'Member'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {switchError ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {switchError}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Join another church"
        disabled={isSwitching}
        onPress={() => {
          router.push({
            pathname: '/onboarding',
            params: { mode: 'join' },
          });
        }}
        style={({ pressed }) => [
          styles.joinButton,
          { borderColor: colors.primary },
          pressed && styles.pressed,
          isSwitching && styles.disabled,
        ]}
      >
        <IconSymbol
          ios_icon_name="person.badge.plus"
          android_material_icon_name="group-add"
          size={20}
          color={colors.primary}
        />
        <Text style={[styles.joinButtonText, { color: colors.primary }]}>
          Join Another Church
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 14,
  },
  headerIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  churchList: {
    gap: 8,
  },
  churchRow: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  selectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  churchCopy: {
    flex: 1,
    minWidth: 0,
  },
  churchName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  currentLabel: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  roleBadge: {
    minWidth: 62,
    minHeight: 28,
    paddingHorizontal: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  joinButton: {
    minHeight: 48,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  joinButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 10,
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.55,
  },
});
