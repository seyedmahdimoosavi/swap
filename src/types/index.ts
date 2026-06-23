import type { BigNumber } from 'ethers';

/** A token the UI knows how to display / transact with. */
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
}

/** Entry in the static TOKEN_LIST keyed by address. */
export interface TokenListEntry {
  symbol: string;
  decimals: number;
  name: string;
}

/** A liquidity pool as loaded from the factory/pair contracts. */
export interface Pool {
  address: string;
  token0: TokenInfo;
  token1: TokenInfo;
  reserve0: BigNumber;
  reserve1: BigNumber;
  totalSupply: BigNumber;
}

export type StatusType = 'info' | 'success' | 'error';

export type V2Tab = 'swap' | 'liquidity' | 'wdoto' | 'pools' | 'addToken';
export type V3Tab = 'v3swap' | 'v3liquidity' | 'v3positions';
export type Version = 'v2' | 'v3';

/** Minimal EIP-1193 provider shape we rely on (MetaMask etc.). */
export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}
