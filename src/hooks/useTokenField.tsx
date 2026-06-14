import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { TOKEN_LIST } from '../config/contracts';
import { loadCustomTokenInfo } from '../lib/tokens';
import type { TokenInfo } from '../types';

/**
 * Manages a token <select> with a "Custom Token" option. Because the original
 * markup places the address input *outside* the flex `.input-wrapper`, this
 * hook returns the <select> and the custom <input> as separate nodes so the
 * caller can position each one correctly.
 */
export function useTokenField(value: TokenInfo, onChange: (info: TokenInfo) => void) {
  const { provider, readOnlyProvider } = useWeb3();
  const isKnown = !!TOKEN_LIST[value.address];
  const [isCustom, setIsCustom] = useState(!isKnown);
  const [customAddr, setCustomAddr] = useState(isKnown ? '' : value.address);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const known = !!TOKEN_LIST[value.address];
    setIsCustom(!known);
    setCustomAddr(known ? '' : value.address);
  }, [value.address]);

  const handleSelect = (selected: string) => {
    if (selected === 'custom') {
      setIsCustom(true);
      return;
    }
    setIsCustom(false);
    const token = TOKEN_LIST[selected];
    onChange({ address: selected, symbol: token.symbol, decimals: token.decimals });
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
      {Object.entries(TOKEN_LIST).map(([addr, t]) => (
        <option key={addr} value={addr}>
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
