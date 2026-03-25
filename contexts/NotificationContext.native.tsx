/**
 * OneSignal Push Notification Context (Anonymous Mode)
 *
 * Provides push notification management for Expo + React Native apps.
 * Reads OneSignal App ID from app.json (expo.extra) automatically.
 *
 * NOTE: Running in anonymous mode - notifications won't be linked to a user ID.
 * To enable user targeting:
 * 1. Set up authentication with setup_auth
 * 2. Re-run setup_onesignal to upgrade this file
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
import { OneSignal, NotificationWillDisplayEvent, PushSubscriptionChangedState } from "react-native-onesignal";
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
  /** Request notification permission from the user */
  requestPermission: () => Promise<boolean>;
  /** Set a tag for user segmentation */
  sendTag: (key: string, value: string) => void;
  /** Remove a tag */
  deleteTag: (key: string) => void;
  /** Last received notification data */
  lastNotification: Record<string, unknown> | null;
  /** OneSignal player/subscription ID — used to register push tokens in the database */
  oneSignalPlayerId: string | null;
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

    try {
      // Initialize OneSignal
      OneSignal.initialize(ONESIGNAL_APP_ID);

      if (__DEV__) {
        console.log("[OneSignal] Initialized with App ID:", ONESIGNAL_APP_ID.substring(0, 8) + "...");
      }

      // Check current permission status
      const permissionStatus = OneSignal.Notifications.hasPermission();
      console.log("[OneSignal] Current permission status:", permissionStatus);
      setHasPermission(permissionStatus);

      // Read current player ID if already subscribed
      const currentId = OneSignal.User.pushSubscription.id;
      if (currentId) {
        console.log("[OneSignal] Existing player ID found:", currentId.substring(0, 8) + "...");
        setOneSignalPlayerId(currentId);
      } else {
        console.log("[OneSignal] No existing player ID yet");
      }

      // Listen for subscription changes to capture the player ID
      const subscriptionChangeHandler = (state: PushSubscriptionChangedState) => {
        const newId = state.current?.id ?? null;
        const isSubscribed = state.current?.optedIn ?? false;
        console.log("[OneSignal] Subscription changed — id:", newId ? newId.substring(0, 8) + "..." : "null", "optedIn:", isSubscribed);
        if (newId) {
          setOneSignalPlayerId(newId);
        }
        if (isSubscribed) {
          setHasPermission(true);
          setPermissionDenied(false);
        }
      };
      OneSignal.User.pushSubscription.addEventListener("change", subscriptionChangeHandler);

      // Display notifications received while app is in foreground
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
      };
      OneSignal.Notifications.addEventListener("permissionChange", permissionHandler);

      // Listen for notification clicks
      const clickHandler = (event: any) => {
        console.log("[OneSignal] Notification clicked:", event?.notification?.title);
      };
      OneSignal.Notifications.addEventListener("click", clickHandler);

      return () => {
        console.log("[OneSignal] Cleaning up event listeners");
        try {
          OneSignal.User.pushSubscription.removeEventListener("change", subscriptionChangeHandler);
          OneSignal.Notifications.removeEventListener("foregroundWillDisplay", foregroundHandler);
          OneSignal.Notifications.removeEventListener("permissionChange", permissionHandler);
          OneSignal.Notifications.removeEventListener("click", clickHandler);
        } catch (err) {
          console.error("[OneSignal] Error during listener cleanup:", err);
        }
      };
    } catch (error) {
      console.error("[OneSignal] Failed to initialize:", error);
    } finally {
      setLoading(false);
    }
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

      // After permission is granted, try to read the player ID immediately
      if (granted) {
        const playerId = OneSignal.User.pushSubscription.id;
        if (playerId) {
          console.log("[OneSignal] Player ID available after permission grant:", playerId.substring(0, 8) + "...");
          setOneSignalPlayerId(playerId);
        } else {
          console.log("[OneSignal] Player ID not yet available after permission grant — will arrive via subscription change event");
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
        requestPermission,
        sendTag,
        deleteTag,
        lastNotification,
        oneSignalPlayerId,
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
 *
 * if (!hasPermission) {
 *   return <Button onPress={requestPermission}>Enable Notifications</Button>;
 * }
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
