import { createContext, useContext, ReactNode } from 'react';
import { useUserBalance } from '../hooks/useUserBalance';

interface TokenBalanceContextType {
  balance: number;
  loading: boolean;
  deduct: (amount: number) => Promise<boolean>;
  canAfford: (cost: number) => boolean;
  refetch: () => Promise<void>;
}

const TokenBalanceContext = createContext<TokenBalanceContextType | null>(null);

export function TokenBalanceProvider({ children }: { children: ReactNode }) {
  const value = useUserBalance();
  return (
    <TokenBalanceContext.Provider value={value}>
      {children}
    </TokenBalanceContext.Provider>
  );
}

export function useTokenBalance() {
  const ctx = useContext(TokenBalanceContext);
  if (!ctx) {
    return {
      balance: 0,
      loading: false,
      deduct: async () => false,
      canAfford: () => false,
      refetch: async () => {},
    };
  }
  return ctx;
}
