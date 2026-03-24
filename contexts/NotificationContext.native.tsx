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
const ONESIGNAL_APP_ID: string = extra.oneSignalAppId || "";

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
        console.log("[OneSignal] Push subscription ID refreshed:", id);
        setOneSignalPlayerId(id);
      }
    } catch (err) {
      console.error("[OneSignal] Failed to read push subscription ID:", err);
    }
  }, [oneSignalPlayerId]);

  // Initialize OneSignal on mount
  useEffect(() => {
    if (isWeb) {
      console.log("[OneSignal] Skipping init — running on web");
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

    // Define handlers outside try so cleanup can always reference them
    let subscriptionChangeHandler: ((event: any) => void) | null = null;
    let foregroundHandler: ((event: NotificationWillDisplayEvent) => void) | null = null;
    let clickHandler: ((event: NotificationClickEvent) => void) | null = null;
    let permissionHandler: ((granted: boolean) => void) | null = null;

    try {
      // Initialize OneSignal
      OneSignal.initialize(ONESIGNAL_APP_ID);
      console.log("[OneSignal] Initialized with App ID:", ONESIGNAL_APP_ID.substring(0, 8) + "...");

      // Check current permission status
      const permissionStatus = OneSignal.Notifications.hasPermission();
      console.log("[OneSignal] Current permission status:", permissionStatus);
      setHasPermission(permissionStatus);

      // Read player ID immediately if already available
      const existingId = OneSignal.User.pushSubscription.id;
      if (existingId) {
        console.log("[OneSignal] Existing push subscription ID:", existingId);
        setOneSignalPlayerId(existingId);
      } else {
        console.log("[OneSignal] No existing push subscription ID yet");
      }

      // Listen for push subscription changes (fires when player ID becomes available)
      subscriptionChangeHandler = (event: any) => {
        const newId = event?.current?.id || event?.id || null;
        console.log("[OneSignal] Push subscription changed, new ID:", newId);
        if (newId) {
          setOneSignalPlayerId(newId);
        }
      };
      OneSignal.User.pushSubscription.addEventListener("change", subscriptionChangeHandler);

      // Listen for foreground notification events
      foregroundHandler = (event: NotificationWillDisplayEvent) => {
        const notification = event.getNotification();
        console.log("[OneSignal] Foreground notification received:", notification.title);
        // Display the notification while app is in foreground
        event.getNotification().display();
        setLastNotification({
          title: notification.title,
          body: notification.body,
          additionalData: notification.additionalData,
        });
      };
      OneSignal.Notifications.addEventListener("foregroundWillDisplay", foregroundHandler);

      // Listen for notification click events
      clickHandler = (event: NotificationClickEvent) => {
        const notification = event.notification;
        console.log("[OneSignal] User tapped notification:", notification.title);
        setLastNotification({
          title: notification.title,
          body: notification.body,
          additionalData: notification.additionalData,
          tapped: true,
        });
      };
      OneSignal.Notifications.addEventListener("click", clickHandler);

      // Listen for permission changes
      permissionHandler = (granted: boolean) => {
        console.log("[OneSignal] Permission changed:", granted);
        setHasPermission(granted);
        setPermissionDenied(!granted);
        // Refresh player ID after permission granted
        if (granted) {
          setTimeout(() => {
            try {
              const id = OneSignal.User.pushSubscription.id;
              if (id) {
                console.log("[OneSignal] Push subscription ID after permission grant:", id);
                setOneSignalPlayerId(id);
              } else {
                console.log("[OneSignal] Push subscription ID not yet available after permission grant, will arrive via subscription change event");
              }
            } catch (err) {
              console.error("[OneSignal] Failed to read push subscription ID after permission grant:", err);
            }
          }, 1000);
        }
      };
      OneSignal.Notifications.addEventListener("permissionChange", permissionHandler);

    } catch (error) {
      console.error("[OneSignal] Failed to initialize:", error);
    } finally {
      setLoading(false);
    }

    // Cleanup — always runs regardless of whether try succeeded or threw
    return () => {
      console.log("[OneSignal] Cleaning up event listeners");
      try {
        if (subscriptionChangeHandler) {
          OneSignal.User.pushSubscription.removeEventListener("change", subscriptionChangeHandler);
        }
        if (foregroundHandler) {
          OneSignal.Notifications.removeEventListener("foregroundWillDisplay", foregroundHandler);
        }
        if (clickHandler) {
          OneSignal.Notifications.removeEventListener("click", clickHandler);
        }
        if (permissionHandler) {
          OneSignal.Notifications.removeEventListener("permissionChange", permissionHandler);
        }
      } catch (err) {
        console.error("[OneSignal] Error during listener cleanup:", err);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isWeb) {
      console.log("[OneSignal] requestPermission called on web — skipping");
      return false;
    }

    try {
      console.log("[OneSignal] Requesting notification permission...");
      const granted = await OneSignal.Notifications.requestPermission(true);
      console.log("[OneSignal] Permission request result:", granted);
      setHasPermission(granted);
      setPermissionDenied(!granted);
      // Give OneSignal a moment to register and get the player ID
      if (granted) {
        console.log("[OneSignal] Permission granted — scheduling player ID refresh");
        setTimeout(refreshPlayerId, 1500);
      } else {
        console.log("[OneSignal] Permission denied by user");
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
      console.log("[OneSignal] Sending tag:", key, "=", value);
      OneSignal.User.addTag(key, value);
      console.log("[OneSignal] Tag sent successfully:", key);
    } catch (error) {
      console.error("[OneSignal] Failed to send tag:", key, error);
    }
  }, []);

  const deleteTag = useCallback((key: string) => {
    if (isWeb) return;
    try {
      console.log("[OneSignal] Deleting tag:", key);
      OneSignal.User.removeTag(key);
      console.log("[OneSignal] Tag deleted successfully:", key);
    } catch (error) {
      console.error("[OneSignal] Failed to delete tag:", key, error);
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
