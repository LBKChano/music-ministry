import * as React from "react";
import { createContext, useCallback, useContext } from "react";
import { Platform } from "react-native";

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType>({
  refreshWidget: () => {},
});

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    try {
      // Dynamically require so Android never loads the module
      const { ExtensionStorage } = require("@bacons/apple-targets");
      ExtensionStorage.reloadWidget();
    } catch (e) {
      console.warn('[WidgetContext] reloadWidget failed on mount:', e);
    }
  }, []);

  const refreshWidget = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    try {
      const { ExtensionStorage } = require("@bacons/apple-targets");
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
  return useContext(WidgetContext);
};
