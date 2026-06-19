/**
 * NotificationContext — Native (iOS/Android)
 *
 * Uses expo-notifications for push token registration and notification handling.
 * The web fallback lives in NotificationContext.tsx.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationContextType {
  hasPermission: boolean;
  permissionDenied: boolean;
  loading: boolean;
  isWeb: boolean;
  expoPushToken: string | null;
  requestPermission: () => Promise<boolean>;
  lastNotification: Record<string, unknown> | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let notificationListener: Notifications.EventSubscription | null = null;

    async function init() {
      if (!Device.isDevice) {
        console.log("[Notifications] Running on simulator — skipping push token registration");
        setLoading(false);
        return;
      }

      // 1. Android channel setup must happen before token registration
      if (Platform.OS === "android") {
        try {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#1a2332",
          });
          console.log("[Notifications] Android notification channel configured");
        } catch (err) {
          console.warn("[Notifications] Failed to set Android notification channel:", err);
        }
      }

      // 2. Check existing permissions
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        console.log("[Notifications] Current permission status:", existingStatus);

        // 3. If granted, register for push token
        if (existingStatus === "granted") {
          setHasPermission(true);
          await registerForPushToken();
        } else if (existingStatus === "denied") {
          setPermissionDenied(true);
        }
      } catch (err) {
        console.warn("[Notifications] Error checking permissions:", err);
      }

      // 4. Set up notification listener
      notificationListener = Notifications.addNotificationReceivedListener((notification) => {
        console.log("[Notifications] Foreground notification received:", notification.request.content.title);
        setLastNotification({
          title: notification.request.content.title,
          body: notification.request.content.body,
          data: notification.request.content.data,
        });
      });

      // 5. Done loading
      setLoading(false);
    }

    init();

    return () => {
      if (notificationListener) {
        notificationListener.remove();
      }
    };
  }, []);

  async function registerForPushToken() {
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      console.log("[Notifications] Registering push token with projectId:", projectId ?? "(none)");
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      const token = tokenData.data;
      console.log("[Notifications] Expo push token registered:", token.substring(0, 20) + "...");
      setExpoPushToken(token);
    } catch (err) {
      console.warn("[Notifications] Failed to get push token:", err);
    }
  }

  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log("[Notifications] Requesting notification permission...");
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      console.log("[Notifications] Permission request result:", status);
      const granted = status === "granted";
      setHasPermission(granted);
      setPermissionDenied(!granted);

      if (granted) {
        await registerForPushToken();
      }

      return granted;
    } catch (error) {
      console.error("[Notifications] Permission request failed:", error);
      return false;
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        hasPermission,
        permissionDenied,
        loading,
        isWeb: false,
        expoPushToken,
        requestPermission,
        lastNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
