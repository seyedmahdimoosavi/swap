import { ethers } from 'ethers';
import { TOKEN_LIST } from '../config/contracts';
import {
  V3_POSITION_MANAGER,
  V3_POSITION_MANAGER_ABI,
  V3_FACTORY_ABI_EX,
  V3_POOL_ABI,
  MIN_TICK,
  MAX_TICK,
} from '../config/v3';
import { ERC20_ABI } from '../config/abis';

export const Q96 = ethers.BigNumber.from(2).pow(96);

export interface V3TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

export interface LiquidityBar {
  price: number;
  liquidity: number;
}

type Provider = ethers.providers.Provider;

// ===== TOKEN INFO =====

export function getV3TokenInfo(address: string): V3TokenInfo {
  const addr = address.toLowerCase();
  for (const [a, info] of Object.entries(TOKEN_LIST)) {
    if (a.toLowerCase() === addr) return { address: a, symbol: info.symbol, decimals: info.decimals, name: info.name };
  }
  return { address, symbol: address.slice(0, 6) + '...', decimals: 18, name: 'Unknown' };
}

export async function fetchV3TokenInfo(provider: Provider, address: string): Promise<V3TokenInfo> {
  let info = getV3TokenInfo(address);
  if (info.name !== 'Unknown') return info;
  try {
    const c = new ethers.Contract(address, ERC20_ABI, provider);
    const [symbol, decimals, name] = await Promise.all([c.symbol(), c.decimals(), c.name()]);
    info = { address, symbol, decimals, name };
    TOKEN_LIST[address] = { symbol, decimals, name };
  } catch {
    /* keep fallback */
  }
  return info;
}

export function v3GetTokenList(): V3TokenInfo[] {
  return Object.entries(TOKEN_LIST).map(([address, info]) => ({
    address,
    symbol: info.symbol,
    decimals: info.decimals,
    name: info.name,
  }));
}

// ===== SAFE PARSE / SQRT PRICE =====

export function v3SafeParseUnits(value: string | number, decimals: number): ethers.BigNumber {
  let s = String(value);
  if (s.includes('e') || s.includes('E')) s = parseFloat(s).toFixed(decimals);
  const parts = s.split('.');
  if (parts.length === 2 && parts[1].length > decimals) s = parts[0] + '.' + parts[1].slice(0, decimals);
  return ethers.utils.parseUnits(s, decimals);
}

export function v3ComputeSqrtPriceX96(price: number): ethers.BigNumber {
  // sqrtPriceX96 = sqrt(price) * 2^96, computed via a scaled integer to avoid JS overflow
  const PRECISION = 1e15;
  const sqrtP = Math.sqrt(price);
  const scaledSqrt = Math.floor(sqrtP * PRECISION);
  return Q96.mul(ethers.BigNumber.from(scaledSqrt.toString())).div(ethers.BigNumber.from(PRECISION.toString()));
}

// ===== TICK <-> PRICE =====

export function v3TickToPrice(tick: number, decimals0 = 18, decimals1 = 18): number {
  return Math.pow(1.0001, tick) * Math.pow(10, decimals0 - decimals1);
}

export function v3PriceToTick(price: number, decimals0 = 18, decimals1 = 18): number {
  const adjustedPrice = price / Math.pow(10, decimals0 - decimals1);
  return Math.round(Math.log(adjustedPrice) / Math.log(1.0001));
}

export function v3NearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  if (rounded < MIN_TICK) return MIN_TICK + tickSpacing;
  if (rounded > MAX_TICK) return MAX_TICK - tickSpacing;
  return rounded;
}

export function v3SqrtPriceToPrice(sqrtPriceX96: ethers.BigNumber, decimals0 = 18, decimals1 = 18): number {
  const sqrtPrice = parseFloat(ethers.utils.formatUnits(sqrtPriceX96, 0));
  const q96 = parseFloat(ethers.utils.formatUnits(Q96, 0));
  const ratio = sqrtPrice / q96;
  const price = ratio * ratio;
  return price * Math.pow(10, decimals0 - decimals1);
}

export function v3FeeToPercent(fee: number): string {
  return (fee / 10000).toFixed(fee < 1000 ? 2 : 1) + '%';
}

// ===== ERROR DECODING =====

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function v3DecodeError(error: any): string | null {
  let hexData: string | null = null;
  if (error?.data && typeof error.data === 'string') hexData = error.data;
  else if (error?.error?.data && typeof error.error.data === 'string') hexData = error.error.data;
  else if (error?.error?.data?.data && typeof error.error.data.data === 'string') hexData = error.error.data.data;
  if (!hexData) {
    const src = error?.reason || error?.message || '';
    const match = src.match(/0x[0-9a-fA-F]{8,}/);
    if (match) hexData = match[0];
  }
  if (!hexData || typeof hexData !== 'string' || hexData.length < 10) {
    // still check require-string reasons below
  } else {
    const selector = hexData.slice(0, 10).toLowerCase();
    const knownErrors: Record<string, string> = {
      '0xdb42144d': 'InsufficientBalance — The account does not have enough tokens for this operation. Please check your balance.',
      '0xe450d38c': 'ERC20InsufficientBalance — Not enough tokens. Check your balance.',
      '0xfb8f41b2': 'ERC20InsufficientAllowance — Token approval is insufficient.',
      '0x4e487b71': 'Arithmetic overflow/underflow in contract.',
    };
    if (knownErrors[selector]) return knownErrors[selector];
  }
  const reason: string = error?.reason || '';
  if (reason.includes('SPL')) return 'Invalid price limit (SPL). The pool price has moved outside the acceptable range.';
  if (reason.includes('LOK')) return 'Pool is locked (reentrancy). Please try again.';
  if (reason.includes("'AS'")) return 'Amount specified cannot be zero.';
  if (reason.includes('IIA')) return 'Insufficient input amount. The swap callback did not provide enough tokens.';
  if (reason.includes('Too little received')) return 'Slippage too high — received less than minimum. Try increasing slippage tolerance.';
  if (reason.includes('Too much requested')) return 'Too much requested for exact output swap.';
  if (reason.includes('Price slippage')) return 'Price slippage check failed. Try increasing slippage tolerance.';
  if (reason.includes('STF')) return 'SafeTransferFrom failed. Please ensure token approval and sufficient balance.';
  if (reason.includes('Unexpected error')) return 'Pool may not exist for this token pair and fee tier. Try creating a pool first or selecting a different fee tier.';
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function v3GetErrorMessage(error: any, defaultMsg?: string): string {
  const decoded = v3DecodeError(error);
  if (decoded) return decoded;
  if (error?.reason && !error.reason.includes('0x')) return error.reason;
  if (error?.data?.message) return error.data.message;
  if (error?.message && error.message.length < 200) return error.message;
  return defaultMsg || 'Transaction failed. Please try again.';
}

// ===== FACTORY / POOL =====

let cachedV3Factory: string | null = null;

export async function getV3Factory(provider: Provider): Promise<string | null> {
  if (cachedV3Factory) return cachedV3Factory;
  try {
    const pm = new ethers.Contract(V3_POSITION_MANAGER, V3_POSITION_MANAGER_ABI, provider);
    cachedV3Factory = await pm.factory();
  } catch (e) {
    console.error('CRITICAL: Could not read V3 factory from PositionManager:', e);
    cachedV3Factory = null;
  }
  return cachedV3Factory;
}

export async function getV3Pool(provider: Provider, tokenA: string, tokenB: string, fee: number): Promise<string> {
  const factoryAddr = await getV3Factory(provider);
  if (!factoryAddr) return ethers.constants.AddressZero;
  const factory = new ethers.Contract(factoryAddr, V3_FACTORY_ABI_EX, provider);
  return factory.getPool(tokenA, tokenB, fee);
}

export interface PoolCheck {
  valid: boolean;
  error?: string;
  warning?: string;
  poolAddr?: string;
  liquidity?: ethers.BigNumber;
  sqrtPriceX96?: ethers.BigNumber;
  tick?: number;
}

export async function v3ValidatePool(provider: Provider, tokenA: string, tokenB: string, fee: number): Promise<PoolCheck> {
  try {
    const factoryAddr = await getV3Factory(provider);
    if (!factoryAddr) return { valid: false, error: 'Could not determine V3 factory address.' };
    const factory = new ethers.Contract(factoryAddr, V3_FACTORY_ABI_EX, provider);
    const poolAddr = await factory.getPool(tokenA, tokenB, fee);
    if (!poolAddr || poolAddr === ethers.constants.AddressZero) {
      return { valid: false, error: `No pool exists for this pair with ${v3FeeToPercent(fee)} fee. Create a pool first by adding liquidity.` };
    }
    const code = await provider.getCode(poolAddr);
    if (!code || code === '0x') return { valid: false, error: 'Pool contract not found at expected address.' };
    const pool = new ethers.Contract(poolAddr, V3_POOL_ABI, provider);
    const slot0 = await pool.slot0();
    if (slot0.sqrtPriceX96.eq(0)) return { valid: false, error: 'Pool exists but is not initialized. Add liquidity first.' };
    const liq = await pool.liquidity();
    if (liq.eq(0)) return { valid: false, poolAddr, warning: 'Pool has zero active liquidity. Swap may fail or have extreme price impact.' };
    return { valid: true, poolAddr, liquidity: liq, sqrtPriceX96: slot0.sqrtPriceX96, tick: slot0.tick };
  } catch (e) {
    console.warn('v3ValidatePool error:', e);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { valid: false, error: 'Could not validate pool. ' + ((e as any).reason || (e as any).message || '') };
  }
}

export async function v3CheckBalance(
  provider: Provider,
  userAddress: string,
  tokenAddr: string,
  amount: ethers.BigNumber,
): Promise<{ sufficient: boolean; error?: string }> {
  try {
    const token = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
    const balance = await token.balanceOf(userAddress);
    if (balance.lt(amount)) {
      const info = getV3TokenInfo(tokenAddr);
      const balStr = parseFloat(ethers.utils.formatUnits(balance, info.decimals)).toFixed(4);
      const needStr = parseFloat(ethers.utils.formatUnits(amount, info.decimals)).toFixed(4);
      return { sufficient: false, error: `Insufficient ${info.symbol} balance. You have ${balStr} but need ${needStr}.` };
    }
    return { sufficient: true };
  } catch {
    return { sufficient: true };
  }
}

// ===== CHART DATA (simulated distribution centred on the real price) =====

export function generateLiquidityData(center: number): LiquidityBar[] {
  const data: LiquidityBar[] = [];
  if (!center || center <= 0) return data;
  const spread = center * 0.6;
  const numBars = 80;
  const minPrice = Math.max(0, center - spread);
  const maxPrice = center + spread;
  const step = (maxPrice - minPrice) / numBars;
  for (let i = 0; i < numBars; i++) {
    const price = minPrice + step * i;
    const x = (price - center) / (spread * 0.35);
    const main = Math.exp(-0.5 * x * x);
    const secondary = 0.3 * Math.exp((-0.5 * Math.pow(x - 0.8, 2)) / 0.15);
    const tertiary = 0.2 * Math.exp((-0.5 * Math.pow(x + 0.6, 2)) / 0.1);
    const noise = 0.05 * Math.random();
    const liquidity = (main + secondary + tertiary + noise) * (50 + Math.random() * 30);
    data.push({ price, liquidity: Math.max(0, liquidity) });
  }
  return data;
}
