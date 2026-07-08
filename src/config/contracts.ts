import type { TokenListEntry } from '../types';

// Contract addresses (deployed on DotOneSmartchain)
export const ROUTER_ADDRESS = '0x63b76b550FF13b8B681E65C1C5eC7D4cf30143f7'; // DotOneSwapV2Router02
export const FACTORY_ADDRESS = '0xD728243a996C615a44Eedcd40AE311083B9b9279'; // DotOneSwapV2Factory

// Network config
export const CHAIN_ID = 505;
export const CHAIN_ID_HEX = '0x' + CHAIN_ID.toString(16);
export const RPC_URL = 'https://rpc.dotone.online';
export const EXPLORER_URL = 'https://dotscan.one';

export const NETWORK_CONFIG = {
  chainId: CHAIN_ID_HEX,
  chainName: 'DotOneSmartchain Testnet',
  nativeCurrency: {
    name: 'DotOne Coin',
    symbol: 'DT1',
    decimals: 18,
  },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: [] as string[],
};

// Wrapped DOTO (native wrapper) used by the WDOTO tab.
export const WDOTO_ADDRESS = '0x044b2ED77214aeA517e811f5c80980511F8ff326';

// Runtime token registry (address -> metadata). This is NO LONGER seeded with
// static test tokens (T1/T2 removed). It is populated at runtime by
// discoverTokens() from the on-chain factory pairs, and used as a metadata
// cache by getV3TokenInfo() / getTokenInfoWithProvider().
export const TOKEN_LIST: Record<string, TokenListEntry> = {};
