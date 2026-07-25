import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const PlansModalContext = createContext(null);

export function PlansModalProvider({ children }) {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  const value = useMemo(() => ({ visible, open, close }), [visible, open, close]);

  return (
    <PlansModalContext.Provider value={value}>
      {children}
    </PlansModalContext.Provider>
  );
}

export function usePlansModal() {
  const ctx = useContext(PlansModalContext);
  if (!ctx) throw new Error('usePlansModal must be used within a PlansModalProvider');
  return ctx;
}

export default PlansModalContext;
