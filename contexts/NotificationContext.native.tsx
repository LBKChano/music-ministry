/**
 * OneSignal Push Notification Context
 *
 * Provides push notification management for Expo + React Native apps.
 * Reads OneSignal App ID from app.json (expo.extra) automatically.
 *
 * Supports:
 * - Native iOS/Android via OneSignal SDK
 * - Permission management
 * - Notification event handling
 * - User ID linking for targeted notifications
 *
 * SETUP:
 * 1. Wrap your app with <NotificationProvider> inside <AuthProvider>
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
import { AppState, Linking, Platform } from "react-native";
import { OneSignal, NotificationWillDisplayEvent } from "react-native-onesignal";
import Constants from "expo-constants";
import {
  readNotificationPermissionOnboardingState,
  saveNotificationPermissionDecision,
} from "@/lib/notifications/permission-onboarding-storage";

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
  /** Whether the operating system can still show its native permission prompt */
  canRequestPermission: boolean;
  /** Loading state during initialization */
  loading: boolean;
  /** Whether running on web (notifications not available) */
  isWeb: boolean;
  /** Request notification permission from the user */
  requestPermission: () => Promise<boolean>;
  /** Open this app's native notification settings */
  openNotificationSettings: () => Promise<void>;
  /** Set a tag for user segmentation */
  sendTag: (key: string, value: string) => void;
  /** Remove a tag */
  deleteTag: (key: string) => void;
  /** Last received notification data */
  lastNotification: Record<string, unknown> | null;
  /** OneSignal push subscription ID (UUID) for backend targeting */
  onesignalSubscriptionId: string | null;
  /** Exact church membership currently linked to OneSignal */
  linkedIdentity: LinkedNotificationIdentity | null;
  /** Link OneSignal only after Auth and church startup are fully ready */
  linkIdentity: (identity: LinkedNotificationIdentity) => Promise<boolean>;
  /** Clear the local OneSignal identity and its readiness state */
  clearIdentity: () => void;
}

interface LinkedNotificationIdentity {
  memberId: string;
  churchId: string;
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
  const [canRequestPermission, setCanRequestPermission] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastNotification, setLastNotification] = useState<Record<string, unknown> | null>(null);
  const [onesignalSubscriptionId, setOnesignalSubscriptionId] = useState<string | null>(null);
  const [linkedIdentity, setLinkedIdentity] = useState<LinkedNotificationIdentity | null>(null);

  const refreshPermissionState = useCallback(async () => {
    if (isWeb || !ONESIGNAL_APP_ID) {
      return { granted: false, canRequest: false };
    }

    const [granted, canRequest, storedState] = await Promise.all([
      OneSignal.Notifications.getPermissionAsync(),
      OneSignal.Notifications.canRequestPermission(),
      readNotificationPermissionOnboardingState(),
    ]);
    const wasPreviouslyRequested = (
      storedState?.decision === "enabled"
      || storedState?.decision === "denied"
    );

    setHasPermission(granted);
    setCanRequestPermission(canRequest);
    setPermissionDenied(!granted && (!canRequest || wasPreviouslyRequested));

    if (granted && storedState?.decision !== "enabled") {
      void saveNotificationPermissionDecision("enabled");
    }

    return { granted, canRequest };
  }, []);

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

      // Get the push subscription ID for backend targeting.
      OneSignal.User.pushSubscription.getIdAsync().then((subscriptionId) => {
        if (subscriptionId) {
          setOnesignalSubscriptionId(subscriptionId);
        }
      }).catch((err) => {
        console.warn("[OneSignal] Failed to get subscription ID:", err);
      });

      // Listen for subscription ID changes (e.g. after permission granted)
      const subscriptionChangeHandler = (subscription: { current: { id?: string } }) => {
        setOnesignalSubscriptionId(subscription.current.id ?? null);
      };
      OneSignal.User.pushSubscription.addEventListener("change", subscriptionChangeHandler);

      // Listen for notification events
      const foregroundHandler = (event: NotificationWillDisplayEvent) => {
        const notification = event.getNotification();
        setLastNotification({
          title: notification.title,
          body: notification.body,
          additionalData: notification.additionalData,
        });
      };
      OneSignal.Notifications.addEventListener("foregroundWillDisplay", foregroundHandler);

      // Listen for permission changes
      const permissionHandler = (granted: boolean) => {
        setHasPermission(granted);
        if (granted) {
          setPermissionDenied(false);
          void saveNotificationPermissionDecision("enabled");
        } else {
          setPermissionDenied(true);
          void saveNotificationPermissionDecision("denied");
        }
        void OneSignal.Notifications.canRequestPermission().then(setCanRequestPermission);
      };
      OneSignal.Notifications.addEventListener("permissionChange", permissionHandler);

      const appStateSubscription = AppState.addEventListener("change", nextState => {
        if (nextState === "active") {
          void refreshPermissionState();
        }
      });

      void refreshPermissionState()
        .catch(error => {
          console.warn("[OneSignal] Failed to read notification permission:", error);
        })
        .finally(() => {
          setLoading(false);
        });

      return () => {
        appStateSubscription.remove();
        OneSignal.Notifications.removeEventListener("foregroundWillDisplay", foregroundHandler);
        OneSignal.Notifications.removeEventListener("permissionChange", permissionHandler);
        OneSignal.User.pushSubscription.removeEventListener("change", subscriptionChangeHandler);
      };
    } catch (error) {
      console.error("[OneSignal] Failed to initialize:", error);
      setLoading(false);
    }
  }, [refreshPermissionState]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isWeb) return false;

    try {
      const currentPermission = await OneSignal.Notifications.getPermissionAsync();
      if (currentPermission) {
        setHasPermission(true);
        setPermissionDenied(false);
        void saveNotificationPermissionDecision("enabled");
        return true;
      }

      const canRequest = await OneSignal.Notifications.canRequestPermission();
      setCanRequestPermission(canRequest);
      if (!canRequest) {
        setPermissionDenied(true);
        void saveNotificationPermissionDecision("denied");
        return false;
      }

      const granted = await OneSignal.Notifications.requestPermission(false);
      setHasPermission(granted);
      setPermissionDenied(!granted);
      setCanRequestPermission(
        granted
          ? false
          : await OneSignal.Notifications.canRequestPermission()
      );
      if (granted) {
        OneSignal.User.pushSubscription.optIn();
        const subscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
        if (subscriptionId) {
          setOnesignalSubscriptionId(subscriptionId);
        }
      }
      void saveNotificationPermissionDecision(granted ? "enabled" : "denied");
      return granted;
    } catch (error) {
      console.error("[OneSignal] Permission request failed:", error);
      void refreshPermissionState();
      throw error;
    }
  }, [refreshPermissionState]);

  const openNotificationSettings = useCallback(async () => {
    if (isWeb) return;
    try {
      await Linking.openSettings();
    } catch (error) {
      console.warn("[OneSignal] Could not open notification settings:", error);
    }
  }, []);

  const linkIdentity = useCallback(async (
    identity: LinkedNotificationIdentity,
  ): Promise<boolean> => {
    if (isWeb || !ONESIGNAL_APP_ID) return false;

    try {
      if (hasPermission) {
        OneSignal.User.pushSubscription.optIn();
      }
      OneSignal.login(identity.memberId);
      OneSignal.User.addTags({
        member_id: identity.memberId,
        church_id: identity.churchId,
      });
      setLinkedIdentity(identity);
      return true;
    } catch (error) {
      console.warn("[OneSignal] Failed to link the current membership:", error);
      setLinkedIdentity(null);
      return false;
    }
  }, [hasPermission]);

  const clearIdentity = useCallback(() => {
    setLinkedIdentity(null);
    if (isWeb) return;

    try {
      OneSignal.User.removeTag("member_id");
      OneSignal.User.removeTag("church_id");
      OneSignal.logout();
    } catch (error) {
      console.warn("[OneSignal] Failed to clear the current membership:", error);
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
        canRequestPermission,
        loading,
        isWeb,
        requestPermission,
        openNotificationSettings,
        sendTag,
        deleteTag,
        lastNotification,
        onesignalSubscriptionId,
        linkedIdentity,
        linkIdentity,
        clearIdentity,
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
 * const { hasPermission, requestPermission } = useNotifications();
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
