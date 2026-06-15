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

// Token addresses as constants so selects / defaults can reference them.
export const T1_ADDRESS = '0xE9aE7eBA1ca2ec36e03c462Fd232Ab3Da74a4231';
export const T2_ADDRESS = '0x8e23900Cbc4d0c6c73ac8Fe5d9607B89Ac3AD2e1';

// Token list from DotOneSmartchain Explorer (keyed by address).
export const TOKEN_LIST: Record<string, TokenListEntry> = {
  [T1_ADDRESS]: { symbol: 'T1', decimals: 18, name: 'Test Token 1' },
  [T2_ADDRESS]: { symbol: 'T2', decimals: 18, name: 'Test Token 2' },
};
