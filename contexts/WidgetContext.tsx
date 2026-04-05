import * as React from "react";
import { createContext, useCallback, useContext } from "react";
import { ExtensionStorage } from "@bacons/apple-targets";

// App Group ID derived from the iOS bundle identifier in app.json
const APP_GROUP_ID = "group.com.a500e23ed75d44a5bf0c6baaf4d67839.app";

// Initialize storage with the correct app group ID, wrapped in try/catch
// so an invalid group ID doesn't crash the app on non-iOS platforms.
let storage: ExtensionStorage | null = null;
try {
  storage = new ExtensionStorage(APP_GROUP_ID);
} catch (e) {
  console.warn('[WidgetContext] Failed to initialize ExtensionStorage:', e);
}

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  // Reload widget on mount
  React.useEffect(() => {
    try {
      ExtensionStorage.reloadWidget();
    } catch (e) {
      console.warn('[WidgetContext] reloadWidget failed on mount:', e);
    }
  }, []);

  const refreshWidget = useCallback(() => {
    try {
      ExtensionStorage.reloadWidget();
    } catch (e) {
      console.warn('[WidgetContext] reloadWidget failed:', e);
    }
  }, []);

  return (
    <WidgetContext.Provider value={{ refreshWidget }}>
      {children}
    </WidgetContext.Provider>
  );
}

export const useWidget = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidget must be used within a WidgetProvider");
  }
  return context;
};
