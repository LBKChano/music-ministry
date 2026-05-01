/**
 * Notification Preferences Screen
 *
 * Shows notification permission status and allows users to manage
 * their notification preferences.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
  ScrollView,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useNotifications } from "@/contexts/NotificationContext";

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { hasPermission, permissionDenied, isWeb, requestPermission } =
    useNotifications();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const dynamicColors = {
    background: isDark ? '#1C1C1E' : '#F2F2F7',
    card: isDark ? '#2C2C2E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    secondaryText: '#8E8E93',
    separator: isDark ? '#3A3A3C' : '#E5E5EA',
  };

  const handleEnableNotifications = async () => {
    if (permissionDenied) {
      Alert.alert(
        "Notifications Disabled",
        "To receive notifications, please enable them in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open Settings",
            onPress: () => {
              if (Platform.OS === "ios") {
                Linking.openURL("app-settings:");
              } else {
                Linking.openSettings();
              }
            },
          },
        ]
      );
      return;
    }

    await requestPermission();
  };

  if (isWeb) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: dynamicColors.background }]}>
        <View style={[styles.header, { backgroundColor: dynamicColors.card, borderBottomColor: dynamicColors.separator }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: dynamicColors.text }]}>Notifications</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.centeredContent}>
          <Text style={[styles.webMessage, { color: dynamicColors.secondaryText }]}>
            Push notifications are available in the mobile app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: dynamicColors.background }]}>
      <View style={[styles.header, { backgroundColor: dynamicColors.card, borderBottomColor: dynamicColors.separator }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: dynamicColors.text }]}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Permission Status */}
        <View style={styles.section}>
          <View style={[styles.permissionCard, { backgroundColor: dynamicColors.card }]}>
            <View style={styles.permissionHeader}>
              <Text style={styles.permissionIcon}>
                {hasPermission ? "🔔" : "🔕"}
              </Text>
              <View style={styles.permissionTextContainer}>
                <Text style={[styles.permissionTitle, { color: dynamicColors.text }]}>
                  {hasPermission
                    ? "Notifications Enabled"
                    : "Notifications Disabled"}
                </Text>
                <Text style={[styles.permissionDescription, { color: dynamicColors.secondaryText }]}>
                  {hasPermission
                    ? "You'll receive push notifications"
                    : "Enable notifications to stay updated"}
                </Text>
              </View>
            </View>
            {!hasPermission && (
              <TouchableOpacity
                style={styles.enableButton}
                onPress={handleEnableNotifications}
              >
                <Text style={styles.enableButtonText}>Enable Notifications</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: 16,
    color: "#007AFF",
    width: 60,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  webMessage: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
  },
  section: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  permissionCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  permissionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  permissionIcon: {
    fontSize: 32,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  permissionDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  enableButton: {
    marginTop: 16,
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  enableButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
