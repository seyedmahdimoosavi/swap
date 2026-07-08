import { ethers } from 'ethers';
import { PAIR_ABI } from '../config/abis';
import { WDOTO_ADDRESS, TOKEN_LIST } from '../config/contracts';
import { CURATED_TOKENS, TOKEN_LIST_URL } from '../config/tokenList';
import { getTokenInfoWithProvider } from './tokens';
import type { TokenInfo } from '../types';

type Provider = ethers.providers.Provider;

/** Fetch an optional remote token list (array or {items|tokens:[...]}). */
async function loadRemoteTokens(): Promise<TokenInfo[]> {
  if (!TOKEN_LIST_URL) return [];
  try {
    const res = await fetch(TOKEN_LIST_URL);
    const data = await res.json();
    const arr: unknown[] = Array.isArray(data)
      ? data
      : (data?.items ?? data?.tokens ?? []);
    return arr
      .map((raw) => {
        const t = raw as Record<string, unknown>;
        const address = (t.address ?? t.contractAddress ?? t.contract_address) as string;
        const symbol = t.symbol as string;
        return {
          address,
          symbol,
          decimals: Number(t.decimals ?? 18),
          name: (t.name as string) ?? symbol,
        } as TokenInfo;
      })
      .filter((t) => !!t.address && !!t.symbol && ethers.utils.isAddress(t.address));
  } catch (e) {
    console.error('loadRemoteTokens: failed to fetch TOKEN_LIST_URL', e);
    return [];
  }
}

/**
 * Discover the tradeable token list.
 *
 * WHICH tokens exist is discovered from chain state (factory pairs) — a JSON-RPC
 * node has no "list all tokens" call. But token DISPLAY metadata (symbol / name
 * / decimals) is taken from the curated list (CURATED_TOKENS + optional
 * TOKEN_LIST_URL) whenever available, because the current RPC's symbol() call
 * fails for these tokens. Curated tokens always appear with their proper symbol
 * even if the RPC can't resolve them; on-chain reads are only a fallback for
 * addresses not in the curated list.
 */
export async function discoverTokens(
  provider: Provider,
  factory: ethers.Contract,
): Promise<TokenInfo[]> {
  // Authoritative metadata map (lower address -> TokenInfo).
  const curated = new Map<string, TokenInfo>();
  for (const t of [...CURATED_TOKENS, ...(await loadRemoteTokens())]) {
    curated.set(t.address.toLowerCase(), {
      address: t.address,
      symbol: t.symbol,
      decimals: Number(t.decimals ?? 18),
      name: t.name ?? t.symbol,
    });
  }

  // Candidate addresses: WDOTO + every curated token + every token in a pair.
  const addrSet = new Map<string, string>(); // lower -> checksum/original
  addrSet.set(WDOTO_ADDRESS.toLowerCase(), WDOTO_ADDRESS);
  for (const [lower, t] of curated) addrSet.set(lower, t.address);

  try {
    const total: number = (await factory.allPairsLength()).toNumber();
    const pairAddrs = await Promise.all(
      Array.from({ length: total }, (_, i) => factory.allPairs(i).catch(() => null)),
    );
    const pairs = pairAddrs.filter(
      (a): a is string => !!a && a !== ethers.constants.AddressZero,
    );
    const tokenPairs = await Promise.all(
      pairs.map(async (pairAddr) => {
        try {
          const c = new ethers.Contract(pairAddr, PAIR_ABI, provider);
          const [t0, t1] = await Promise.all([c.token0(), c.token1()]);
          return [t0 as string, t1 as string] as const;
        } catch {
          return null;
        }
      }),
    );
    for (const tp of tokenPairs) {
      if (!tp) continue;
      addrSet.set(tp[0].toLowerCase(), tp[0]);
      addrSet.set(tp[1].toLowerCase(), tp[1]);
    }
  } catch (e) {
    console.error('discoverTokens: failed to enumerate factory pairs', e);
  }

  // Resolve metadata: prefer curated, fall back to on-chain reads.
  const infos = await Promise.all(
    Array.from(addrSet.values()).map(async (addr) => {
      const cur = curated.get(addr.toLowerCase());
      if (cur) return cur;
      return getTokenInfoWithProvider(addr, provider);
    }),
  );

  const seen = new Set<string>();
  const list: TokenInfo[] = [];
  for (const info of infos) {
    const key = info.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(info);
    TOKEN_LIST[info.address] = {
      symbol: info.symbol,
      decimals: info.decimals,
      name: info.name ?? info.symbol,
    };
  }

  // WDOTO first, then alphabetical by symbol.
  const wdoto = WDOTO_ADDRESS.toLowerCase();
  list.sort((a, b) => {
    if (a.address.toLowerCase() === wdoto) return -1;
    if (b.address.toLowerCase() === wdoto) return 1;
    return a.symbol.localeCompare(b.symbol);
  });

  return list;
}
