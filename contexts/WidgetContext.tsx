import * as React from "react";
import { createContext, useCallback, useContext } from "react";
import { reloadScheduleWidgets } from '@/lib/widgets/schedule-widget';

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType>({
  refreshWidget: () => {},
});

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    reloadScheduleWidgets();
  }, []);

  const refreshWidget = useCallback(() => {
    reloadScheduleWidgets();
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
