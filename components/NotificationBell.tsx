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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/contexts/NotificationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useChurchSession } from "@/hooks/useChurch";
import { IconSymbol } from "@/components/IconSymbol";
import { queryKeys } from "@/lib/query/keys";
import {
  createRealtimeChannel,
  logRealtimeStatus,
  realtimeChannelNames,
  removeRealtimeChannel,
} from "@/lib/realtime/channels";
import { applyNotificationRealtimePayload } from "@/lib/realtime/cache-updates";
import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

type MemberNotification = Tables<"member_notifications">;

async function fetchMemberNotifications(memberId: string): Promise<MemberNotification[]> {
  const { data, error } = await supabase
    .from("member_notifications")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data ?? [];
}

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
  const { session } = useAuth();
  const { currentMember } = useChurchSession();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = React.useState(false);

  const memberId = currentMember?.id ?? null;
  const accountId = session?.user?.id ?? null;
  const notificationQueryKey = React.useMemo(
    () => queryKeys.memberNotifications(accountId ?? "signed-out", memberId ?? "none"),
    [accountId, memberId]
  );
  const notificationsQuery = useQuery({
    queryKey: notificationQueryKey,
    queryFn: () => fetchMemberNotifications(memberId as string),
    enabled: !loading && !isWeb && Boolean(accountId && memberId),
    staleTime: 60_000,
  });
  const notifications = React.useMemo(
    () => notificationsQuery.data ?? [],
    [notificationsQuery.data]
  );
  const unreadCount = React.useMemo(
    () => notifications.filter(row => !row.read_at).length,
    [notifications]
  );
  const loadingHistory = notificationsQuery.isFetching && notifications.length === 0;

  const markVisibleNotificationsRead = React.useCallback(async (rows: MemberNotification[]) => {
    const unreadIds = rows.filter(row => !row.read_at).map(row => row.id);
    if (unreadIds.length === 0 || !memberId) return;

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("member_notifications")
      .update({ read_at: readAt })
      .in("id", unreadIds);

    if (error) {
      console.error("Error marking notifications read:", error);
      return;
    }

    queryClient.setQueryData<MemberNotification[]>(
      notificationQueryKey,
      previous => (previous ?? []).map(row =>
        unreadIds.includes(row.id) ? { ...row, read_at: readAt } : row
      )
    );
  }, [memberId, notificationQueryKey, queryClient]);

  React.useEffect(() => {
    if (isWeb || !accountId || !memberId) return;

    const channelLabel = `member notifications ${memberId}`;
    const channel = createRealtimeChannel(
      realtimeChannelNames.memberNotifications(accountId, memberId),
      channelLabel
    );
    const handleNotificationPayload = (payload: Parameters<
      typeof applyNotificationRealtimePayload
    >[1]) => {
      if (queryClient.getQueryData(notificationQueryKey) === undefined) return;
      queryClient.setQueryData<MemberNotification[]>(
        notificationQueryKey,
        previous => applyNotificationRealtimePayload(previous, payload)
      );
    };

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "member_notifications",
          filter: `member_id=eq.${memberId}`,
        },
        handleNotificationPayload
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "member_notifications",
          filter: `member_id=eq.${memberId}`,
        },
        handleNotificationPayload
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "member_notifications",
        },
        handleNotificationPayload
      )
      .subscribe(logRealtimeStatus(channelLabel));

    return () => {
      void removeRealtimeChannel(channel, channelLabel).catch(error => {
        console.warn(`[Realtime] ${channelLabel} cleanup failed`, error);
      });
    };
  }, [accountId, isWeb, memberId, notificationQueryKey, queryClient]);

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
    if (!memberId) return [];

    try {
      return await queryClient.fetchQuery({
        queryKey: notificationQueryKey,
        queryFn: () => fetchMemberNotifications(memberId),
        staleTime: 60_000,
      });
    } catch (error) {
      console.error("Error fetching member notifications:", error);
      Alert.alert("Error", "Could not load notifications");
      return [];
    }
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
