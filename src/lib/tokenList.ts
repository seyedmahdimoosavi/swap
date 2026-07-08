import { ethers } from 'ethers';
import { PAIR_ABI } from '../config/abis';
import { WDOTO_ADDRESS, TOKEN_LIST } from '../config/contracts';
import { getTokenInfoWithProvider } from './tokens';
import type { TokenInfo } from '../types';

type Provider = ethers.providers.Provider;

/**
 * Discover the set of tradeable tokens directly from chain state.
 *
 * A JSON-RPC node has no "list all tokens" method, so for a DEX the honest
 * on-chain source of a token list is the factory's own pairs: we enumerate
 * `allPairs(i)` and collect every unique token0 / token1, then resolve
 * metadata (symbol / decimals / name) via ERC20 calls. WDOTO is always
 * included so the native wrapper is selectable even before any pool exists.
 *
 * This replaces the old static T1/T2 TOKEN_LIST. Tokens that exist ONLY in a
 * V3 pool (and were never paired in V2) are not auto-discovered here — users
 * can still add them through the "Custom Token" address field.
 */
export async function discoverTokens(
  provider: Provider,
  factory: ethers.Contract,
): Promise<TokenInfo[]> {
  // lower-cased address -> checksum address (dedupe, case-insensitive)
  const addrSet = new Map<string, string>();
  addrSet.set(WDOTO_ADDRESS.toLowerCase(), WDOTO_ADDRESS);

  try {
    const total: number = (await factory.allPairsLength()).toNumber();

    const pairAddrs = await Promise.all(
      Array.from({ length: total }, (_, i) =>
        factory.allPairs(i).catch(() => null),
      ),
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

  // Resolve metadata (getTokenInfoWithProvider caches per session).
  const infos = await Promise.all(
    Array.from(addrSet.values()).map((addr) =>
      getTokenInfoWithProvider(addr, provider),
    ),
  );

  const seen = new Set<string>();
  const list: TokenInfo[] = [];
  for (const info of infos) {
    const key = info.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(info);
    // Populate the runtime registry so getV3TokenInfo()/lookups keep working.
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
