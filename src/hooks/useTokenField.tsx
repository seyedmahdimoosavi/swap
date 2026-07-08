import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useTokenList } from '../context/TokenListContext';
import { getTokenInfoWithProvider, loadCustomTokenInfo } from '../lib/tokens';
import type { TokenInfo } from '../types';

/**
 * Manages a token <select> whose options come from the RPC-discovered token
 * list (via useTokenList) plus a "Custom Token" option. Because the original
 * markup places the address input *outside* the flex `.input-wrapper`, this
 * hook returns the <select> and the custom <input> as separate nodes so the
 * caller can position each one correctly.
 */
export function useTokenField(value: TokenInfo, onChange: (info: TokenInfo) => void) {
  const { provider, readOnlyProvider } = useWeb3();
  const { tokens } = useTokenList();

  const isKnown = (addr: string) =>
    tokens.some((t) => t.address.toLowerCase() === addr.toLowerCase());

  const [isCustom, setIsCustom] = useState(false);
  const [customAddr, setCustomAddr] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const known = value.address ? isKnown(value.address) : false;
    setIsCustom(value.address ? !known : false);
    setCustomAddr(known || !value.address ? '' : value.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.address, tokens]);

  const handleSelect = async (selected: string) => {
    if (selected === 'custom') {
      setIsCustom(true);
      return;
    }
    setIsCustom(false);
    // Resolve the selected token's metadata from the chain (address stays static).
    const info = await getTokenInfoWithProvider(selected, provider ?? readOnlyProvider);
    onChange(info);
  };

  const handleCustom = (addr: string) => {
    setCustomAddr(addr);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const info = await loadCustomTokenInfo(addr, provider ?? readOnlyProvider);
      if (info) onChange(info);
    }, 400);
  };

  const select: ReactNode = (
    <select
      className="token-select"
      value={isCustom ? 'custom' : value.address}
      onChange={(e) => handleSelect(e.target.value)}
    >
      {tokens.map((t) => (
        <option key={t.address} value={t.address}>
          {t.symbol}
        </option>
      ))}
      <option value="custom">Custom Token</option>
    </select>
  );

  const customInput: ReactNode = (
    <input
      type="text"
      className={`token-address-input${isCustom ? '' : ' hidden'}`}
      placeholder="Token address (0x...)"
      value={customAddr}
      onChange={(e) => handleCustom(e.target.value)}
    />
  );

  return { select, customInput, isCustom };
}
