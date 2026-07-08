import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useWeb3 } from './Web3Context';
import { discoverTokens } from '../lib/tokenList';
import type { TokenInfo } from '../types';

interface TokenListContextValue {
  tokens: TokenInfo[];
  loading: boolean;
  refresh: () => void;
}

const TokenListContext = createContext<TokenListContextValue | null>(null);

/**
 * Discovers the tradeable token list from RPC once (and again whenever the
 * connected provider/factory changes or refresh() is called), and shares it
 * with every consumer. Replaces the old static TOKEN_LIST-based lists.
 */
export function TokenListProvider({ children }: { children: ReactNode }) {
  const { readOnlyProvider, readOnlyFactoryContract, provider, factoryContract } =
    useWeb3();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  const refresh = useCallback(() => setKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const p = provider ?? readOnlyProvider;
    const f = factoryContract ?? readOnlyFactoryContract;
    discoverTokens(p, f)
      .then((list) => {
        if (!cancelled) {
          setTokens(list);
          setLoading(false);
        }
      })
      .catch((e) => {
        console.error('TokenListProvider: discovery failed', e);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readOnlyProvider, readOnlyFactoryContract, provider, factoryContract, key]);

  return (
    <TokenListContext.Provider value={{ tokens, loading, refresh }}>
      {children}
    </TokenListContext.Provider>
  );
}

export function useTokenList(): TokenListContextValue {
  const ctx = useContext(TokenListContext);
  if (!ctx) throw new Error('useTokenList must be used within a TokenListProvider');
  return ctx;
}
