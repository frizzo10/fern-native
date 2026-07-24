import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AccountModalContext = createContext(null);

export function AccountModalProvider({ children }) {
  const [visible, setVisible] = useState(false);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  const value = useMemo(() => ({ visible, open, close }), [visible, open, close]);

  return (
    <AccountModalContext.Provider value={value}>
      {children}
    </AccountModalContext.Provider>
  );
}

export function useAccountModal() {
  const ctx = useContext(AccountModalContext);
  if (!ctx) throw new Error('useAccountModal must be used within an AccountModalProvider');
  return ctx;
}

export default AccountModalContext;
