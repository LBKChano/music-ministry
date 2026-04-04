/**
 * OneSignal Push Notification Context (Anonymous Mode)
 *
 * Provides push notification management for Expo + React Native apps.
 * Reads OneSignal App ID from app.json (expo.extra) automatically.
 *
 * SETUP:
 * 1. Wrap your app with <NotificationProvider>
 * 2. Run: npx expo install onesignal-expo-plugin react-native-onesignal && npx expo prebuild
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
import { OneSignal, NotificationWillDisplayEvent } from "react-native-onesignal";
import Constants from "expo-constants";

// Read App ID from app.json (expo.extra)
const extra = Constants.expoConfig?.extra || {};
const ONESIGNAL_APP_ID = extra.oneSignalAppId || "";

// Check if running on web
const isWeb = Platform.OS === "web";

interface NotificationContextType {
  /** Whether the user has granted notification permission */
  hasPermission: boolean;
  /** Whether permission has been requested but not yet granted */
  permissionDenied: boolean;
  /** Loading state during initialization */
  loading: boolean;
  /** Whether running on web (notifications not available) */
  isWeb: boolean;
  /** OneSignal subscription/player ID for the current device */
  oneSignalPlayerId: string | null;
  /** Request notification permission from the user */
  requestPermission: () => Promise<boolean>;
  /** Set a tag for user segmentation */
  sendTag: (key: string, value: string) => void;
  /** Remove a tag */
  deleteTag: (key: string) => void;
  /** Last received notification data */
  lastNotification: Record<string, unknown> | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [oneSignalPlayerId, setOneSignalPlayerId] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Record<string, unknown> | null>(null);

  // Initialize OneSignal on mount
  useEffect(() => {
    if (isWeb) {
      setLoading(false);
      return;
    }

    if (!ONESIGNAL_APP_ID) {
      console.warn(
        "[OneSignal] App ID not provided. " +
        "Please add oneSignalAppId to app.json extra."
      );
      setLoading(false);
      return;
    }

    try {
      // Initialize OneSignal
      OneSignal.initialize(ONESIGNAL_APP_ID);

      if (__DEV__) {
        console.log("[OneSignal] Initialized with App ID:", ONESIGNAL_APP_ID.substring(0, 8) + "...");
      }

      // Check current permission status
      const permissionStatus = OneSignal.Notifications.hasPermission();
      setHasPermission(permissionStatus);

      // Read the subscription ID (player ID) immediately if available
      const currentId = OneSignal.User.pushSubscription.id;
      if (currentId) {
        console.log("[OneSignal] Subscription ID available on init:", currentId.substring(0, 8) + "...");
        setOneSignalPlayerId(currentId);
      }

      // Listen for subscription changes to capture the player ID
      const subscriptionHandler = (event: { current: { id: string | null; token: string | null; optedIn: boolean } }) => {
        const newId = event.current?.id ?? null;
        console.log("[OneSignal] Subscription changed. Player ID:", newId ? newId.substring(0, 8) + "..." : "null");
        setOneSignalPlayerId(newId);
      };
      OneSignal.User.pushSubscription.addEventListener("change", subscriptionHandler);

      // Listen for foreground notification events
      const foregroundHandler = (event: NotificationWillDisplayEvent) => {
        event.getNotification().display();
        const notification = event.getNotification();
        console.log("[OneSignal] Foreground notification received:", notification.title);
        setLastNotification({
          title: notification.title,
          body: notification.body,
          additionalData: notification.additionalData,
        });
      };
      OneSignal.Notifications.addEventListener("foregroundWillDisplay", foregroundHandler);

      // Listen for permission changes
      const permissionHandler = (granted: boolean) => {
        console.log("[OneSignal] Permission changed:", granted);
        setHasPermission(granted);
        setPermissionDenied(!granted);

        // After permission is granted, try to read the player ID
        if (granted) {
          const id = OneSignal.User.pushSubscription.id;
          if (id) {
            console.log("[OneSignal] Player ID after permission grant:", id.substring(0, 8) + "...");
            setOneSignalPlayerId(id);
          }
        }
      };
      OneSignal.Notifications.addEventListener("permissionChange", permissionHandler);

      return () => {
        OneSignal.User.pushSubscription.removeEventListener("change", subscriptionHandler);
        OneSignal.Notifications.removeEventListener("foregroundWillDisplay", foregroundHandler);
        OneSignal.Notifications.removeEventListener("permissionChange", permissionHandler);
      };
    } catch (error) {
      console.error("[OneSignal] Failed to initialize:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isWeb) return false;

    try {
      console.log("[OneSignal] Requesting notification permission...");
      const granted = await OneSignal.Notifications.requestPermission(true);
      console.log("[OneSignal] Permission request result:", granted);
      setHasPermission(granted);
      setPermissionDenied(!granted);

      // After permission grant, read the player ID
      if (granted) {
        const id = OneSignal.User.pushSubscription.id;
        if (id) {
          console.log("[OneSignal] Player ID after requestPermission:", id.substring(0, 8) + "...");
          setOneSignalPlayerId(id);
        }
      }

      return granted;
    } catch (error) {
      console.error("[OneSignal] Permission request failed:", error);
      return false;
    }
  }, []);

  const sendTag = useCallback((key: string, value: string) => {
    if (isWeb) return;
    try {
      OneSignal.User.addTag(key, value);
    } catch (error) {
      console.error("[OneSignal] Failed to send tag:", error);
    }
  }, []);

  const deleteTag = useCallback((key: string) => {
    if (isWeb) return;
    try {
      OneSignal.User.removeTag(key);
    } catch (error) {
      console.error("[OneSignal] Failed to delete tag:", error);
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        hasPermission,
        permissionDenied,
        loading,
        isWeb,
        oneSignalPlayerId,
        requestPermission,
        sendTag,
        deleteTag,
        lastNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access notification state and methods.
 *
 * @example
 * const { hasPermission, requestPermission, oneSignalPlayerId } = useNotifications();
 */
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
}
