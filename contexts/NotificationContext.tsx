/**
 * NotificationContext — default (web-safe) stub.
 *
 * The real expo-notifications implementation lives in NotificationContext.native.tsx,
 * which Metro loads on iOS/Android. This file is the fallback for web.
 */

import React, { createContext, useContext, ReactNode } from "react";

interface NotificationContextType {
  hasPermission: boolean;
  permissionDenied: boolean;
  loading: boolean;
  isWeb: boolean;
  expoPushToken: string | null;
  requestPermission: () => Promise<boolean>;
  lastNotification: Record<string, unknown> | null;
}

const NotificationContext = createContext<NotificationContextType>({
  hasPermission: false,
  permissionDenied: false,
  loading: false,
  isWeb: true,
  expoPushToken: null,
  requestPermission: async () => false,
  lastNotification: null,
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  return (
    <NotificationContext.Provider
      value={{
        hasPermission: false,
        permissionDenied: false,
        loading: false,
        isWeb: true,
        expoPushToken: null,
        requestPermission: async () => false,
        lastNotification: null,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
