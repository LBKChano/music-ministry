/**
 * NotificationBell Component
 *
 * A reusable notification bell icon that shows permission status.
 * Prompts user to enable notifications if not yet granted.
 *
 * Usage:
 *   import { NotificationBell } from "@/components/NotificationBell";
 *
 *   // In header
 *   <NotificationBell />
 *
 *   // Compact for tight spaces
 *   <NotificationBell variant="compact" />
 */

import React from "react";
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Alert,
  Platform,
  Linking,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNotifications } from "@/contexts/NotificationContext";
import { useChurch } from "@/hooks/useChurch";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

type MemberNotification = Tables<"member_notifications">;

interface NotificationBellProps {
  /** Button style variant */
  variant?: "default" | "compact";
  /** Custom size for the bell icon */
  size?: number;
}

export function NotificationBell({
  variant = "default",
  size = 24,
}: NotificationBellProps) {
  const { hasPermission, permissionDenied, loading, isWeb, requestPermission } =
    useNotifications();
  const { currentMember } = useChurch();
  const [modalVisible, setModalVisible] = React.useState(false);
  const [notifications, setNotifications] = React.useState<MemberNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  const fetchNotifications = React.useCallback(async () => {
    if (!currentMember?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("member_notifications")
      .select("*")
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching member notifications:", error);
      Alert.alert("Error", "Could not load notifications");
      setLoadingHistory(false);
      return;
    }

    const rows = data ?? [];
    setNotifications(rows);
    setUnreadCount(rows.filter(row => !row.read_at).length);
    setLoadingHistory(false);
  }, [currentMember?.id]);

  const markVisibleNotificationsRead = React.useCallback(async (rows: MemberNotification[]) => {
    const unreadIds = rows.filter(row => !row.read_at).map(row => row.id);
    if (unreadIds.length === 0) return;

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("member_notifications")
      .update({ read_at: readAt })
      .in("id", unreadIds);

    if (error) {
      console.error("Error marking notifications read:", error);
      return;
    }

    setNotifications(prev => prev.map(row => unreadIds.includes(row.id) ? { ...row, read_at: readAt } : row));
    setUnreadCount(0);
  }, []);

  React.useEffect(() => {
    if (!loading && !isWeb && currentMember?.id) {
      fetchNotifications();
    }
  }, [currentMember?.id, fetchNotifications, isWeb, loading]);

  React.useEffect(() => {
    if (loading || isWeb || !currentMember?.id) return;

    const channel = supabase
      .channel(`member-notifications-${currentMember.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "member_notifications",
          filter: `member_id=eq.${currentMember.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMember?.id, fetchNotifications, isWeb, loading]);

  if (loading || isWeb) return null;

  const handlePress = async () => {
    if (hasPermission) {
      setModalVisible(true);
      const rows = await loadNotificationsForOpen();
      await markVisibleNotificationsRead(rows);
      return;
    }

    if (permissionDenied) {
      // Permission was denied - direct to settings
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

    // Request permission
    await requestPermission();
  };

  const loadNotificationsForOpen = async (): Promise<MemberNotification[]> => {
    if (!currentMember?.id) return [];

    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("member_notifications")
      .select("*")
      .eq("member_id", currentMember.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setLoadingHistory(false);
    if (error) {
      console.error("Error fetching member notifications:", error);
      Alert.alert("Error", "Could not load notifications");
      return [];
    }

    const rows = data ?? [];
    setNotifications(rows);
    setUnreadCount(rows.filter(row => !row.read_at).length);
    return rows;
  };

  const renderNotificationCenter = () => (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          {loadingHistory ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color="#3B82F6" />
            </View>
          ) : notifications.length === 0 ? (
            <Text style={styles.emptyText}>No notifications yet</Text>
          ) : (
            <ScrollView style={styles.notificationList}>
              {notifications.map(notification => (
                <View
                  key={notification.id}
                  style={[
                    styles.notificationItem,
                    !notification.read_at && styles.unreadNotificationItem,
                  ]}
                >
                  <View style={styles.notificationItemHeader}>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    {!notification.read_at && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notificationBody}>{notification.body}</Text>
                  <Text style={styles.notificationTime}>{formatNotificationTime(notification.created_at)}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  if (variant === "compact") {
    return (
      <>
        <TouchableOpacity onPress={handlePress} style={styles.compactButton}>
          <View style={styles.bellContainer}>
            <IconSymbol
              ios_icon_name={hasPermission ? "bell.fill" : "bell.slash.fill"}
              android_material_icon_name={hasPermission ? "notifications" : "notifications-off"}
              size={Math.round(size * 0.82)}
              color="#FFFFFF"
            />
            {hasPermission && unreadCount > 0 && <NotificationBadge count={unreadCount} />}
          </View>
        </TouchableOpacity>
        {renderNotificationCenter()}
      </>
    );
  }

  return (
    <>
      <TouchableOpacity onPress={handlePress} style={styles.button}>
        <View style={styles.bellContainer}>
          <IconSymbol
            ios_icon_name={hasPermission ? "bell.fill" : "bell.slash.fill"}
            android_material_icon_name={hasPermission ? "notifications" : "notifications-off"}
            size={size}
            color="#FFFFFF"
          />
          {hasPermission && unreadCount > 0 ? (
            <NotificationBadge count={unreadCount} />
          ) : !hasPermission ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>!</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
      {renderNotificationCenter()}
    </>
  );
}

function NotificationBadge({ count }: { count: number }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? "9+" : String(count)}</Text>
    </View>
  );
}

function formatNotificationTime(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

const styles = StyleSheet.create({
  button: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  compactButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  bellContainer: {
    position: "relative",
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -7,
    right: -8,
    backgroundColor: "#FF3B30",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 8,
    maxHeight: "75%",
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeButtonText: {
    color: "#2563EB",
    fontWeight: "600",
  },
  loadingState: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#6B7280",
    paddingVertical: 28,
    textAlign: "center",
  },
  notificationList: {
    maxHeight: 460,
  },
  notificationItem: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  unreadNotificationItem: {
    borderColor: "#93C5FD",
    backgroundColor: "#EFF6FF",
  },
  notificationItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  notificationBody: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  notificationTime: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 8,
  },
});

export default NotificationBell;
