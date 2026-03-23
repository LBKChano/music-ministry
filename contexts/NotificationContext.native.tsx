/**
 * OneSignal Push Notification Context
 *
 * Provides push notification management via OneSignal for iOS and Android.
 * Reads OneSignal App ID from app.json (expo.extra) automatically.
 * Exposes the OneSignal push subscription ID (player ID) so it can be
 * stored in the push_tokens table for server-side targeting.
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
import { OneSignal, NotificationWillDisplayEvent, NotificationClickEvent } from "react-native-onesignal";
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
  /**
   * The OneSignal push subscription ID (player ID).
   * Use this to store in push_tokens table for server-side targeting.
   * Will be null until OneSignal is initialized and permission granted.
   */
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
  const [lastNotification, setLastNotification] = useState<Record<string, unknown> | null>(null);
  const [oneSignalPlayerId, setOneSignalPlayerId] = useState<string | null>(null);

  // Helper to read the current push subscription ID from OneSignal
  const refreshPlayerId = useCallback(() => {
    if (isWeb) return;
    try {
      const id = OneSignal.User.pushSubscription.id;
      if (id && id !== oneSignalPlayerId) {
        console.log('[OneSignal] Push subscription ID (player ID):', id);
        setOneSignalPlayerId(id);
      }
    } catch (err) {
      // Not yet available — will be set via subscription change listener
    }
  }, [oneSignalPlayerId]);

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
      console.log("[OneSignal] Initialized with App ID:", ONESIGNAL_APP_ID.substring(0, 8) + "...");



      // Check current permission status
      const permissionStatus = OneSignal.Notifications.hasPermission();
      setHasPermission(permissionStatus);

      // Read player ID immediately if already available
      const existingId = OneSignal.User.pushSubscription.id;
      if (existingId) {
        console.log('[OneSignal] Existing push subscription ID:', existingId);
        setOneSignalPlayerId(existingId);
      }

      // Listen for push subscription changes (fires when player ID becomes available)
      const subscriptionChangeHandler = (event: any) => {
        const newId = event?.current?.id || event?.id || null;
        if (newId) {
          console.log('[OneSignal] Push subscription ID updated:', newId);
          setOneSignalPlayerId(newId);
        }
      };
      OneSignal.User.pushSubscription.addEventListener('change', subscriptionChangeHandler);

      // Listen for foreground notification events
      const foregroundHandler = (event: NotificationWillDisplayEvent) => {
        event.getNotification().display();
        const notification = event.getNotification();
        console.log('[OneSignal] Foreground notification received:', notification.title);
        setLastNotification({
          title: notification.title,
          body: notification.body,
          additionalData: notification.additionalData,
        });
      };
      OneSignal.Notifications.addEventListener("foregroundWillDisplay", foregroundHandler);

      // Listen for notification click events
      const clickHandler = (event: NotificationClickEvent) => {
        const notification = event.notification;
        console.log('[OneSignal] User tapped notification:', notification.title);
        setLastNotification({
          title: notification.title,
          body: notification.body,
          additionalData: notification.additionalData,
          tapped: true,
        });
      };
      OneSignal.Notifications.addEventListener("click", clickHandler);

      // Listen for permission changes
      const permissionHandler = (granted: boolean) => {
        console.log('[OneSignal] Permission changed:', granted);
        setHasPermission(granted);
        setPermissionDenied(!granted);
        // Refresh player ID after permission granted
        if (granted) {
          setTimeout(() => {
            try {
              const id = OneSignal.User.pushSubscription.id;
              if (id) {
                console.log('[OneSignal] Push subscription ID after permission grant:', id);
                setOneSignalPlayerId(id);
              }
            } catch (_) {}
          }, 1000);
        }
      };
      OneSignal.Notifications.addEventListener("permissionChange", permissionHandler);

      return () => {
        OneSignal.User.pushSubscription.removeEventListener('change', subscriptionChangeHandler);
        OneSignal.Notifications.removeEventListener("foregroundWillDisplay", foregroundHandler);
        OneSignal.Notifications.removeEventListener("click", clickHandler);
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
      console.log('[OneSignal] Requesting notification permission...');
      const granted = await OneSignal.Notifications.requestPermission(true);
      console.log('[OneSignal] Permission request result:', granted);
      setHasPermission(granted);
      setPermissionDenied(!granted);
      // Give OneSignal a moment to register and get the player ID
      if (granted) {
        setTimeout(refreshPlayerId, 1500);
      }
      return granted;
    } catch (error) {
      console.error("[OneSignal] Permission request failed:", error);
      return false;
    }
  }, [refreshPlayerId]);

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

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
}
