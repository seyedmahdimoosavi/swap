import { ethers } from 'ethers';
import { ERC20_ABI } from '../config/abis';
import { TOKEN_LIST } from '../config/contracts';
import type { TokenInfo } from '../types';

type AnyProvider = ethers.providers.Provider;

// Some ERC20s (old / hand-rolled test tokens) return symbol()/name() as
// bytes32 instead of string. ethers can't decode a bytes32 payload with a
// `returns (string)` ABI, so we retry with a bytes32 ABI.
const ERC20_BYTES32_ABI = [
  'function symbol() view returns (bytes32)',
  'function name() view returns (bytes32)',
];

// Token metadata (symbol/name/decimals) is immutable, so cache it for the
// session. We only cache SUCCESSFUL reads, never a failure placeholder.
const metaCache = new Map<string, TokenInfo>();

function decodeBytes32(value: string): string {
  try {
    return ethers.utils.parseBytes32String(value).replace(/\u0000/g, '').trim();
  } catch {
    try {
      // strip trailing zero bytes then decode printable ascii
      const hex = value.replace(/(00)+$/i, '');
      // eslint-disable-next-line no-control-regex
      return ethers.utils.toUtf8String(hex).replace(/[^\x20-\x7E]/g, '').trim();
    } catch {
      return '';
    }
  }
}

async function readStringField(
  address: string,
  provider: AnyProvider,
  field: 'symbol' | 'name',
): Promise<string | null> {
  // 1) standard string ABI
  try {
    const c = new ethers.Contract(address, ERC20_ABI, provider);
    const v = field === 'symbol' ? await c.symbol() : await c.name();
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  } catch {
    /* fall through to bytes32 */
  }
  // 2) bytes32 ABI fallback
  try {
    const c = new ethers.Contract(address, ERC20_BYTES32_ABI, provider);
    const raw = field === 'symbol' ? await c.symbol() : await c.name();
    const decoded = decodeBytes32(raw);
    if (decoded) return decoded;
  } catch {
    /* give up */
  }
  return null;
}

async function readDecimals(address: string, provider: AnyProvider): Promise<number | null> {
  try {
    const c = new ethers.Contract(address, ERC20_ABI, provider);
    const d = await c.decimals();
    const n = typeof d === 'number' ? d : Number(d);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Resolve token metadata for an address. Reads symbol / decimals / name
 * independently (so one failing call can't wipe the others) and handles
 * bytes32 symbols. Never returns the old '???' placeholder.
 */
export async function getTokenInfoWithProvider(
  address: string,
  provider: AnyProvider,
): Promise<TokenInfo> {
  const key = address.toLowerCase();
  const cached = metaCache.get(key);
  if (cached) return cached;

  const [symbol, decimals, name] = await Promise.all([
    readStringField(address, provider, 'symbol'),
    readDecimals(address, provider),
    readStringField(address, provider, 'name'),
  ]);

  // Treat as a real token if we resolved a symbol or decimals.
  if (symbol !== null || decimals !== null) {
    const info: TokenInfo = {
      address,
      symbol: symbol ?? name ?? address.slice(0, 6) + '…',
      decimals: decimals ?? 18,
      name: name ?? symbol ?? 'Token',
    };
    metaCache.set(key, info);
    return info;
  }

  // Complete failure (RPC can't eth_call this contract): prefer any runtime
  // known entry, else a short-address placeholder (more useful than '???').
  const known = TOKEN_LIST[address];
  if (known) return { address, ...known };
  return { address, symbol: address.slice(0, 6) + '…', decimals: 18, name: 'Unknown' };
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
  const [symbol, decimals, name] = await Promise.all([
    readStringField(address, provider, 'symbol'),
    readDecimals(address, provider),
    readStringField(address, provider, 'name'),
  ]);
  if (symbol === null && decimals === null) return null;
  return {
    address,
    symbol: symbol ?? address.slice(0, 6) + '…',
    decimals: decimals ?? 18,
    name: name ?? symbol ?? 'Token',
  };
}
