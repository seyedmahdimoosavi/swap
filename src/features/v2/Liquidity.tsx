import ConnectWalletButton from '../../components/ConnectWalletButton';
import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../context/Web3Context';
import { useStatus } from '../../context/StatusContext';
import { useBalance } from '../../hooks/useBalance';
import { useTokenField } from '../../hooks/useTokenField';
import { ERC20_ABI, PAIR_ABI } from '../../config/abis';
import { ROUTER_ADDRESS, T1_ADDRESS, T2_ADDRESS } from '../../config/contracts';
import { getTokenInfoWithProvider } from '../../lib/tokens';
import { addressUrl, errorMessage, shortAddress, txUrl } from '../../lib/format';
import type { TokenInfo } from '../../types';

interface PoolInfo {
  address: string;
  isNew: boolean;
  share: string;
  reserveA: string;
  reserveB: string;
}

export default function Liquidity() {
  const {
    factoryContract,
    readOnlyFactoryContract,
    routerContract,
    signer,
    userAddress,
    provider,
    readOnlyProvider,
  } = useWeb3();
  const { showStatus } = useStatus();

  const [tokenA, setTokenA] = useState<TokenInfo>({ address: T1_ADDRESS, symbol: 'T1', decimals: 18 });
  const [tokenB, setTokenB] = useState<TokenInfo>({ address: T2_ADDRESS, symbol: 'T2', decimals: 18 });
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fieldA = useTokenField(tokenA, setTokenA);
  const fieldB = useTokenField(tokenB, setTokenB);
  const balanceA = useBalance(tokenA, refreshKey);
  const balanceB = useBalance(tokenB, refreshKey);

  const floor = (v: string) => (v === '' ? '' : String(Math.floor(Number(v))));

  // Read pair reserves; returns null when no pool exists.
  const readReserves = useCallback(async () => {
    if (!tokenA.address || !tokenB.address) return null;
    // Read via read-only provider so reserves show even before connecting.
    const f = factoryContract ?? readOnlyFactoryContract;
    const p = provider ?? readOnlyProvider;
    const pairAddress = await f.getPair(tokenA.address, tokenB.address);
    if (pairAddress === ethers.constants.AddressZero) return { pairAddress, exists: false } as const;
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, p);
    const [reserves, token0, totalSupply] = await Promise.all([
      pair.getReserves(),
      pair.token0(),
      pair.totalSupply(),
    ]);
    const isToken0A = token0.toLowerCase() === tokenA.address.toLowerCase();
    return {
      pairAddress,
      exists: true,
      pair,
      reserveA: isToken0A ? reserves.reserve0 : reserves.reserve1,
      reserveB: isToken0A ? reserves.reserve1 : reserves.reserve0,
      totalSupply,
    } as const;
  }, [factoryContract, readOnlyFactoryContract, provider, readOnlyProvider, tokenA, tokenB]);

  const updatePoolInfo = useCallback(async () => {
    try {
      const r = await readReserves();
      if (!r) {
        setPool(null);
        return;
      }
      if (!r.exists) {
        setPool({ address: 'New Pool', isNew: true, share: '100%', reserveA: '0', reserveB: '0' });
        return;
      }
      let share = '--';
      if (userAddress) {
        const userLp = await r.pair.balanceOf(userAddress);
        const pct = r.totalSupply.gt(0) ? userLp.mul(10000).div(r.totalSupply).toNumber() / 100 : 0;
        share = `${pct.toFixed(2)}%`;
      }
      setPool({
        address: r.pairAddress,
        isNew: false,
        share,
        reserveA: `${parseFloat(ethers.utils.formatUnits(r.reserveA, tokenA.decimals)).toFixed(4)} ${tokenA.symbol}`,
        reserveB: `${parseFloat(ethers.utils.formatUnits(r.reserveB, tokenB.decimals)).toFixed(4)} ${tokenB.symbol}`,
      });
    } catch (error) {
      console.error('Failed to get pool info:', error);
      setPool(null);
    }
  }, [readReserves, userAddress, tokenA, tokenB]);

  useEffect(() => {
    updatePoolInfo();
  }, [updatePoolInfo, refreshKey]);

  // Resolve the default tokens' metadata (symbol/name/decimals) from the chain.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          getTokenInfoWithProvider(T1_ADDRESS, readOnlyProvider),
          getTokenInfoWithProvider(T2_ADDRESS, readOnlyProvider),
        ]);
        if (cancelled) return;
        setTokenA((prev) => (prev.address === T1_ADDRESS ? a : prev));
        setTokenB((prev) => (prev.address === T2_ADDRESS ? b : prev));
      } catch {
        /* keep defaults on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readOnlyProvider]);

  // Maintain the pool ratio when one side changes.
  const calculateLiquidityAmounts = async (changed: 'A' | 'B', value: string) => {
    try {
      const r = await readReserves();
      if (!r || !r.exists || r.reserveA.isZero() || r.reserveB.isZero()) return;
      if (changed === 'A' && value && parseFloat(value) > 0) {
        const aWei = ethers.utils.parseUnits(value, tokenA.decimals);
        const bWei = aWei.mul(r.reserveB).div(r.reserveA);
        setAmountB(String(Math.floor(parseFloat(ethers.utils.formatUnits(bWei, tokenB.decimals)))));
      } else if (changed === 'B' && value && parseFloat(value) > 0) {
        const bWei = ethers.utils.parseUnits(value, tokenB.decimals);
        const aWei = bWei.mul(r.reserveA).div(r.reserveB);
        setAmountA(String(Math.floor(parseFloat(ethers.utils.formatUnits(aWei, tokenA.decimals)))));
      }
    } catch (error) {
      console.error('Failed to calculate amounts:', error);
    }
  };

  const onAmountAChange = (v: string) => {
    const f = floor(v);
    setAmountA(f);
    calculateLiquidityAmounts('A', f);
  };
  const onAmountBChange = (v: string) => {
    const f = floor(v);
    setAmountB(f);
    calculateLiquidityAmounts('B', f);
  };

  const setMaxA = () => {
    if (balanceA.raw) setAmountA(String(Math.floor(parseFloat(ethers.utils.formatUnits(balanceA.raw, tokenA.decimals)))));
  };
  const setMaxB = () => {
    if (balanceB.raw) setAmountB(String(Math.floor(parseFloat(ethers.utils.formatUnits(balanceB.raw, tokenB.decimals)))));
  };

  const buttonLabel = (() => {
    if (!userAddress) return 'Connect Wallet';
    if (!tokenA.address) return 'Select Token A';
    if (!tokenB.address) return 'Select Token B';
    return 'Add Liquidity';
  })();
  const buttonDisabled =
    !userAddress || !amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0;

  const approveIfNeeded = async (token: ethers.Contract, desired: ethers.BigNumber, label: string) => {
    const allowance = await token.allowance(userAddress, ROUTER_ADDRESS);
    if (allowance.lt(desired)) {
      if (!allowance.isZero()) {
        showStatus(`Resetting ${label} allowance...`, 'info');
        await (await token.approve(ROUTER_ADDRESS, 0, { gasLimit: 100000 })).wait();
      }
      showStatus(`Approving ${label}...`, 'info');
      const receipt = await (await token.approve(ROUTER_ADDRESS, desired, { gasLimit: 100000 })).wait();
      if (receipt.status === 0) throw new Error(`${label} approval failed!`);
    }
  };

  const addLiquidity = async () => {
    if (!signer || !routerContract || !factoryContract || !userAddress) {
      showStatus('Please connect your wallet', 'error');
      return;
    }
    if (!amountA || !amountB) {
      showStatus('Please enter amounts', 'error');
      return;
    }

    const amountADesired = ethers.utils.parseUnits(amountA, tokenA.decimals);
    const amountBDesired = ethers.utils.parseUnits(amountB, tokenB.decimals);

    let isNewPool = false;
    try {
      const pairAddress = await factoryContract.getPair(tokenA.address, tokenB.address);
      isNewPool = pairAddress === ethers.constants.AddressZero;
    } catch {
      isNewPool = true;
    }

    const slippageMultiplier = Math.floor((100 - 1) * 100); // 1% default → 9900
    const amountAMin = isNewPool ? ethers.BigNumber.from(0) : amountADesired.mul(slippageMultiplier).div(10000);
    const amountBMin = isNewPool ? ethers.BigNumber.from(0) : amountBDesired.mul(slippageMultiplier).div(10000);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    try {
      setLoading(true);
      showStatus('Processing...', 'info');

      const contractA = new ethers.Contract(tokenA.address, ERC20_ABI, signer);
      const contractB = new ethers.Contract(tokenB.address, ERC20_ABI, signer);
      const [balA, balB] = await Promise.all([
        contractA.balanceOf(userAddress),
        contractB.balanceOf(userAddress),
      ]);
      if (balA.lt(amountADesired)) {
        showStatus('Insufficient Token A balance', 'error');
        return;
      }
      if (balB.lt(amountBDesired)) {
        showStatus('Insufficient Token B balance', 'error');
        return;
      }

      await approveIfNeeded(contractA, amountADesired, 'Token A');
      await approveIfNeeded(contractB, amountBDesired, 'Token B');

      showStatus('Adding liquidity...', 'info');
      const gasLimit = isNewPool ? 5000000 : 1000000;
      const tx = await routerContract.addLiquidity(
        tokenA.address,
        tokenB.address,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        userAddress,
        deadline,
        { gasLimit },
      );
      showStatus('Waiting for confirmation...', 'info');
      const receipt = await tx.wait();
      if (receipt.status === 0) {
        showStatus('Transaction reverted! The addLiquidity call failed on-chain.', 'error');
        return;
      }

      const verifyPair = await factoryContract.getPair(tokenA.address, tokenB.address);
      if (verifyPair === ethers.constants.AddressZero) {
        showStatus(
          <>
            Transaction confirmed but pool was not created.{' '}
            <a href={txUrl(tx.hash)} target="_blank" rel="noreferrer">
              View Transaction
            </a>
          </>,
          'error',
        );
      } else {
        showStatus(
          <>
            Liquidity added successfully! Pool:{' '}
            <a href={addressUrl(verifyPair)} target="_blank" rel="noreferrer">
              {shortAddress(verifyPair, 10, 0)}
            </a>{' '}
            |{' '}
            <a href={txUrl(tx.hash)} target="_blank" rel="noreferrer">
              View Transaction
            </a>
          </>,
          'success',
        );
      }
      setAmountA('');
      setAmountB('');
      setRefreshKey((k) => k + 1);
    } catch (error) {
      console.error('Add liquidity failed:', error);
      showStatus(errorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="liquiditySection" className={loading ? 'loading' : ''}>
      <div className="card">
        <div className="flex items-center justify-between mb-[18px]">
          <div className="section-title mb-0 text-left">Add Liquidity</div>
          <ConnectWalletButton />
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>Token A</span>
            <span className="balance" onClick={setMaxA}>
              Balance: {balanceA.display}
            </span>
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              className="token-input"
              placeholder="0"
              step="1"
              min="0"
              value={amountA}
              onChange={(e) => onAmountAChange(e.target.value)}
            />
            {fieldA.select}
          </div>
          {fieldA.customInput}
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>Token B</span>
            <span className="balance" onClick={setMaxB}>
              Balance: {balanceB.display}
            </span>
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              className="token-input"
              placeholder="0"
              step="1"
              min="0"
              value={amountB}
              onChange={(e) => onAmountBChange(e.target.value)}
            />
            {fieldB.select}
          </div>
          {fieldB.customInput}
        </div>

        {pool && (
          <div className="pool-info">
            <div className="pool-info-title">Pool Information</div>
            <div className="info-row">
              <span className="info-label">Pool Address</span>
              <span className="info-value">
                {pool.isNew ? (
                  'New Pool'
                ) : (
                  <a href={addressUrl(pool.address)} target="_blank" rel="noreferrer" className="text-[#ffd700] underline">
                    {shortAddress(pool.address)}
                  </a>
                )}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Your Pool Share</span>
              <span className="info-value">{pool.share}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Token A Reserve</span>
              <span className="info-value">{pool.reserveA}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Token B Reserve</span>
              <span className="info-value">{pool.reserveB}</span>
            </div>
          </div>
        )}
      </div>

      <button className="action-btn" onClick={addLiquidity} disabled={buttonDisabled}>
        {buttonLabel}
      </button>
    </div>
  );
}
