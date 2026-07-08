import type { TokenInfo } from '../types';

/**
 * Authoritative token metadata source.
 *
 * The on-chain symbol()/name() calls on the current RPC fail for these tokens,
 * so the UI must NOT depend on them for display. Instead it uses this list for
 * symbol / name / decimals. RPC discovery (factory pairs) still runs and adds
 * any extra tokens it finds — but anything listed here always shows its proper
 * symbol regardless of what the RPC returns.
 *
 * TWO WAYS TO POPULATE:
 *   1) Paste your full array into CURATED_TOKENS below, OR
 *   2) Set TOKEN_LIST_URL to an endpoint that returns a JSON array (or an
 *      object with an `items` / `tokens` array) of { address, symbol,
 *      decimals, name } — it is fetched at startup and merged in.
 */

// e.g. 'https://dotscan.one/api/v2/tokens'  (leave '' to use CURATED_TOKENS only)
export const TOKEN_LIST_URL = '';

export const CURATED_TOKENS: TokenInfo[] = [
  {
    address: '0xf412e85297F2A3dC7C3EC748a38Ff82446E0dD48',
    symbol: 'TT2',
    decimals: 18,
    name: 'TestToken2',
  },
  // 👉 paste the rest of your tokens here (same shape):
  // { address: '0x...', symbol: 'XXX', decimals: 18, name: 'Full Name' },
];
