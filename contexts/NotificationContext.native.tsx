/**
 * OneSignal Push Notification Context (Native — iOS/Android)
 *
 * The real OneSignal implementation. Metro loads this file on iOS/Android.
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
import { OneSignal, NotificationWillDisplayEvent } from "react-native-onesignal";
import Constants from "expo-constants";

// Read App ID from app.json (expo.extra)
const extra = Constants.expoConfig?.extra || {};
const ONESIGNAL_APP_ID: string = extra.oneSignalAppId || "";

// Check if running on web
const isWeb = Platform.OS === "web";

interface NotificationContextType {
  hasPermission: boolean;
  permissionDenied: boolean;
  loading: boolean;
  isWeb: boolean;
  oneSignalPlayerId: string | null;
  requestPermission: () => Promise<boolean>;
  sendTag: (key: string, value: string) => void;
  deleteTag: (key: string) => void;
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

    // Track whether listeners were successfully added so we only remove them
    // if they were actually registered (avoids crashes in cleanup).
    let subscriptionListenerAdded = false;
    let foregroundListenerAdded = false;
    let permissionListenerAdded = false;

    const subscriptionHandler = (event: { current: { id: string | null; token: string | null; optedIn: boolean } }) => {
      const newId = event.current?.id ?? null;
      console.log("[OneSignal] Subscription changed. Player ID:", newId ? newId.substring(0, 8) + "..." : "null");
      setOneSignalPlayerId(newId);
    };

    const foregroundHandler = (event: NotificationWillDisplayEvent) => {
      try {
        event.getNotification().display();
        const notification = event.getNotification();
        console.log("[OneSignal] Foreground notification received:", notification.title);
        setLastNotification({
          title: notification.title,
          body: notification.body,
          additionalData: notification.additionalData,
        });
      } catch (err) {
        console.error("[OneSignal] Error handling foreground notification:", err);
      }
    };

    const permissionHandler = (granted: boolean) => {
      console.log("[OneSignal] Permission changed:", granted);
      setHasPermission(granted);
      setPermissionDenied(!granted);

      if (granted) {
        try {
          const id = OneSignal.User.pushSubscription.id;
          if (id) {
            console.log("[OneSignal] Player ID after permission grant:", id.substring(0, 8) + "...");
            setOneSignalPlayerId(id);
          }
        } catch (err) {
          console.error("[OneSignal] Error reading player ID after permission grant:", err);
        }
      }
    };

    try {
      OneSignal.initialize(ONESIGNAL_APP_ID);

      if (__DEV__) {
        console.log("[OneSignal] Initialized with App ID:", ONESIGNAL_APP_ID.substring(0, 8) + "...");
      }

      // Check current permission status
      try {
        const permissionStatus = OneSignal.Notifications.hasPermission();
        setHasPermission(permissionStatus);
      } catch (err) {
        console.warn("[OneSignal] Could not read permission status:", err);
      }

      // Read the subscription ID (player ID) immediately if available
      try {
        const currentId = OneSignal.User.pushSubscription.id;
        if (currentId) {
          console.log("[OneSignal] Subscription ID available on init:", currentId.substring(0, 8) + "...");
          setOneSignalPlayerId(currentId);
        }
      } catch (err) {
        console.warn("[OneSignal] Could not read initial subscription ID:", err);
      }

      // Register event listeners — track each one so cleanup is safe
      try {
        OneSignal.User.pushSubscription.addEventListener("change", subscriptionHandler);
        subscriptionListenerAdded = true;
      } catch (err) {
        console.warn("[OneSignal] Could not add subscription listener:", err);
      }

      try {
        OneSignal.Notifications.addEventListener("foregroundWillDisplay", foregroundHandler);
        foregroundListenerAdded = true;
      } catch (err) {
        console.warn("[OneSignal] Could not add foreground listener:", err);
      }

      try {
        OneSignal.Notifications.addEventListener("permissionChange", permissionHandler);
        permissionListenerAdded = true;
      } catch (err) {
        console.warn("[OneSignal] Could not add permission listener:", err);
      }
    } catch (error) {
      console.error("[OneSignal] Failed to initialize:", error);
    }

    // Always mark loading as done, regardless of success/failure
    setLoading(false);

    // Return cleanup — only remove listeners that were successfully added
    return () => {
      if (subscriptionListenerAdded) {
        try {
          OneSignal.User.pushSubscription.removeEventListener("change", subscriptionHandler);
        } catch (err) {
          console.warn("[OneSignal] Error removing subscription listener:", err);
        }
      }
      if (foregroundListenerAdded) {
        try {
          OneSignal.Notifications.removeEventListener("foregroundWillDisplay", foregroundHandler);
        } catch (err) {
          console.warn("[OneSignal] Error removing foreground listener:", err);
        }
      }
      if (permissionListenerAdded) {
        try {
          OneSignal.Notifications.removeEventListener("permissionChange", permissionHandler);
        } catch (err) {
          console.warn("[OneSignal] Error removing permission listener:", err);
        }
      }
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isWeb) return false;

    try {
      console.log("[OneSignal] Requesting notification permission...");
      const granted = await OneSignal.Notifications.requestPermission(true);
      console.log("[OneSignal] Permission request result:", granted);
      setHasPermission(granted);
      setPermissionDenied(!granted);

      if (granted) {
        try {
          const id = OneSignal.User.pushSubscription.id;
          if (id) {
            console.log("[OneSignal] Player ID after requestPermission:", id.substring(0, 8) + "...");
            setOneSignalPlayerId(id);
          }
        } catch (err) {
          console.warn("[OneSignal] Could not read player ID after permission:", err);
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

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }
  return context;
}
