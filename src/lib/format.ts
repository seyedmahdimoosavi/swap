import { ethers } from 'ethers';
import type { BigNumber } from 'ethers';
import { EXPLORER_URL } from '../config/contracts';

/** 0x1234...abcd style short address. */
export function shortAddress(addr: string, lead = 6, tail = 4): string {
  if (!addr) return '';
  return `${addr.slice(0, lead)}...${addr.slice(-tail)}`;
}

/** Format a BigNumber to a fixed-decimal string. */
export function formatAmount(value: BigNumber, decimals: number, fixed = 4): string {
  return parseFloat(ethers.utils.formatUnits(value, decimals)).toFixed(fixed);
}

/** Localized number string (matches the original toLocaleString usage in pools). */
export function formatLocale(value: BigNumber, decimals: number, maxFractionDigits = 4): string {
  return parseFloat(ethers.utils.formatUnits(value, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
  });
}

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (addr: string) => `${EXPLORER_URL}/address/${addr}`;

/** Normalize an unknown thrown value into a user-facing message. */
export function errorMessage(error: unknown, fallback = 'Transaction failed'): string {
  const e = error as { reason?: string; message?: string };
  if (e?.reason) return e.reason;
  if (e?.message) {
    if (e.message.includes('insufficient funds')) return 'Insufficient funds for gas';
    if (e.message.includes('user rejected')) return 'Transaction rejected by user';
    return e.message;
  }
  return fallback;
}
