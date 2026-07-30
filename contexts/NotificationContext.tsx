/**
 * NotificationContext — default (web-safe) stub.
 *
 * The real OneSignal implementation lives in NotificationContext.native.tsx,
 * which Metro loads on iOS/Android. This file is the fallback for web where
 * react-native-onesignal would crash at import time.
 */

import React, { createContext, useContext, ReactNode } from "react";

interface NotificationContextType {
  hasPermission: boolean;
  permissionDenied: boolean;
  canRequestPermission: boolean;
  loading: boolean;
  isWeb: boolean;
  requestPermission: () => Promise<boolean>;
  openNotificationSettings: () => Promise<void>;
  sendTag: (key: string, value: string) => void;
  deleteTag: (key: string) => void;
  lastNotification: Record<string, unknown> | null;
  onesignalSubscriptionId: string | null;
  linkedIdentity: LinkedNotificationIdentity | null;
  linkIdentity: (identity: LinkedNotificationIdentity) => Promise<boolean>;
  clearIdentity: () => void;
}

interface LinkedNotificationIdentity {
  memberId: string;
  churchId: string;
}

const NotificationContext = createContext<NotificationContextType>({
  hasPermission: false,
  permissionDenied: false,
  canRequestPermission: false,
  loading: false,
  isWeb: true,
  requestPermission: async () => false,
  openNotificationSettings: async () => {},
  sendTag: () => {},
  deleteTag: () => {},
  lastNotification: null,
  onesignalSubscriptionId: null,
  linkedIdentity: null,
  linkIdentity: async () => false,
  clearIdentity: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  return (
    <NotificationContext.Provider
      value={{
        hasPermission: false,
        permissionDenied: false,
        canRequestPermission: false,
        loading: false,
        isWeb: true,
        requestPermission: async () => false,
        openNotificationSettings: async () => {},
        sendTag: () => {},
        deleteTag: () => {},
        lastNotification: null,
        onesignalSubscriptionId: null,
        linkedIdentity: null,
        linkIdentity: async () => false,
        clearIdentity: () => {},
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
