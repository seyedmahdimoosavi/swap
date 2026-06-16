import { ethers } from 'ethers';
import { ERC20_ABI } from '../config/abis';
import { TOKEN_LIST } from '../config/contracts';
import type { TokenInfo } from '../types';

type AnyProvider = ethers.providers.Provider;

/**
 * Resolve token metadata for an address, preferring the static list and
 * falling back to on-chain calls. Mirrors getTokenInfoWithProvider().
 */
export async function getTokenInfoWithProvider(
  address: string,
  provider: AnyProvider,
): Promise<TokenInfo> {
  // Read metadata from the chain first; fall back to the static list only on failure.
  try {
    const token = new ethers.Contract(address, ERC20_ABI, provider);
    const [symbol, decimals, name] = await Promise.all([
      token.symbol(),
      token.decimals(),
      token.name().catch(() => 'Unknown Token'),
    ]);
    return { address, symbol, decimals, name };
  } catch {
    const known = TOKEN_LIST[address];
    if (known) return { address, ...known };
    return { address, symbol: '???', decimals: 18, name: 'Unknown' };
  }
}

/**
 * Load just symbol + decimals for a custom token address typed by the user.
 * Returns null on invalid address or failure.
 */
export async function loadCustomTokenInfo(
  address: string,
  provider: AnyProvider,
): Promise<TokenInfo | null> {
  if (!ethers.utils.isAddress(address)) return null;
  try {
    const token = new ethers.Contract(address, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
    return { address, symbol, decimals };
  } catch (error) {
    console.error('Failed to load token info:', error);
    return null;
  }
}
