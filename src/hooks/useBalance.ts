import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { ERC20_ABI } from '../config/abis';
import { useWeb3 } from '../context/Web3Context';
import type { TokenInfo } from '../types';

/**
 * Returns the connected user's balance of `token` as a display string plus a
 * refetch function and the raw BigNumber. Re-fetches when the token, user, or
 * `refreshKey` changes.
 */
export function useBalance(token: TokenInfo | null, refreshKey: unknown = null) {
  const { provider, userAddress } = useWeb3();
  const [display, setDisplay] = useState('--');
  const [raw, setRaw] = useState<ethers.BigNumber | null>(null);

  const refetch = useCallback(async () => {
    if (!userAddress || !provider || !token?.address) {
      setDisplay('--');
      setRaw(null);
      return;
    }
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const balance: ethers.BigNumber = await contract.balanceOf(userAddress);
      setRaw(balance);
      setDisplay(
        `${parseFloat(ethers.utils.formatUnits(balance, token.decimals)).toFixed(4)} ${token.symbol}`,
      );
    } catch (error) {
      console.error('Failed to update balance:', error);
    }
  }, [provider, userAddress, token, refreshKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { display, raw, refetch };
}
