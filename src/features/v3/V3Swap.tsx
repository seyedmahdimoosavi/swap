import { useEffect, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../context/Web3Context';
import { useStatus } from '../../context/StatusContext';
import ConnectWalletButton from '../../components/ConnectWalletButton';
import { ERC20_ABI } from '../../config/abis';
import { EXPLORER_BASE, V3_QUOTER, V3_QUOTER_ABI, V3_SWAP_ROUTER, V3_SWAP_ROUTER_ABI } from '../../config/v3';
import {
  getV3TokenInfo,
  v3FeeToPercent,
  v3GetErrorMessage,
  v3SafeParseUnits,
  v3ValidatePool,
  v3CheckBalance,
} from '../../lib/v3';
import { useTokenList } from '../../context/TokenListContext';

const SWAP_FEES = [100, 500, 3000, 10000];

interface TxStatus {
  html: string;
  type: '' | 'pending' | 'success' | 'error';
}

function txLink(hash: string) {
  return `<a href="${EXPLORER_BASE}/tx/${hash}" target="_blank" class="v3-tx-link">🔗 View Transaction ↗</a>`;
}

export default function V3Swap() {
  const { readOnlyProvider, provider, signer, userAddress, isConnected, connectWallet } = useWeb3();
  const { showStatus } = useStatus();

  const tokens = useTokenList().tokens;
  const [fromToken, setFromToken] = useState('');
  const [toToken, setToToken] = useState('');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [swapFee, setSwapFee] = useState(3000);
  const [fromBal, setFromBal] = useState('Balance: —');
  const [toBal, setToBal] = useState('Balance: —');
  const [route, setRoute] = useState<{ from: string; to: string; fee: number } | null>(null);
  const [details, setDetails] = useState<{ impact: string; min: string; fee: string } | null>(null);
  const [tx, setTx] = useState<TxStatus>({ html: '', type: '' });
  const [swapping, setSwapping] = useState(false);

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reads = provider ?? readOnlyProvider;

  // Default the selects to the first two discovered tokens once loaded.
  useEffect(() => {
    if (tokens.length === 0) return;
    setFromToken((prev) => prev || tokens[0].address);
    setToToken((prev) => prev || tokens[1]?.address || tokens[0].address);
  }, [tokens]);

  // Balances
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userAddress || !provider) {
        setFromBal('Balance: —');
        setToBal('Balance: —');
        return;
      }
      try {
        const cf = new ethers.Contract(fromToken, ERC20_ABI, provider);
        const ct = new ethers.Contract(toToken, ERC20_ABI, provider);
        const [bf, bt] = await Promise.all([cf.balanceOf(userAddress), ct.balanceOf(userAddress)]);
        if (cancelled) return;
        setFromBal('Balance: ' + parseFloat(ethers.utils.formatUnits(bf, getV3TokenInfo(fromToken).decimals)).toFixed(4));
        setToBal('Balance: ' + parseFloat(ethers.utils.formatUnits(bt, getV3TokenInfo(toToken).decimals)).toFixed(4));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userAddress, provider, fromToken, toToken]);

  // Debounced quote
  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    const amount = parseFloat(fromAmount);
    if (!amount || amount <= 0) {
      setToAmount('');
      setRoute(null);
      setDetails(null);
      return;
    }
    quoteTimer.current = setTimeout(async () => {
      try {
        const fromInfo = getV3TokenInfo(fromToken);
        const toInfo = getV3TokenInfo(toToken);
        const amountIn = v3SafeParseUnits(amount, fromInfo.decimals);

        const poolCheck = await v3ValidatePool(reads, fromToken, toToken, swapFee);
        if (!poolCheck.valid) {
          setToAmount('');
          setRoute(null);
          setDetails(null);
          setTx({ html: poolCheck.error || 'Pool validation failed', type: 'error' });
          return;
        }
        if (poolCheck.warning) setTx({ html: '⚠️ ' + poolCheck.warning, type: 'pending' });

        const quoter = new ethers.Contract(V3_QUOTER, V3_QUOTER_ABI, reads);
        const amountOut = await quoter.callStatic.quoteExactInputSingle(fromToken, toToken, swapFee, amountIn, 0);
        const outFloat = parseFloat(ethers.utils.formatUnits(amountOut, toInfo.decimals));
        setToAmount(outFloat.toFixed(6));
        setRoute({ from: fromInfo.symbol, to: toInfo.symbol, fee: swapFee });
        const slip = parseFloat(slippage) || 0.5;
        setDetails({
          impact: '<0.01%',
          min: (outFloat * (1 - slip / 100)).toFixed(6) + ' ' + toInfo.symbol,
          fee: v3FeeToPercent(swapFee),
        });
        setTx({ html: '', type: '' });
      } catch (e) {
        setToAmount('');
        setRoute(null);
        setDetails(null);
        setTx({ html: v3GetErrorMessage(e, 'No pool found for this pair/fee tier or insufficient liquidity'), type: 'error' });
      }
    }, 500);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [fromAmount, fromToken, toToken, swapFee, slippage, reads]);

  const swapDirection = () => {
    setFromToken(toToken);
    setToToken(fromToken);
  };

  const maxFrom = () => {
    const m = fromBal.match(/Balance:\s*([\d.]+)/);
    if (m) setFromAmount(m[1]);
  };

  async function executeSwap() {
    if (!signer || !userAddress) {
      showStatus('Please connect your wallet first', 'error');
      return;
    }
    const amount = parseFloat(fromAmount);
    if (!amount || amount <= 0) {
      showStatus('Enter an amount to swap', 'error');
      return;
    }
    const fromInfo = getV3TokenInfo(fromToken);
    const toInfo = getV3TokenInfo(toToken);
    const amountIn = v3SafeParseUnits(amount, fromInfo.decimals);
    const slip = parseFloat(slippage) || 0.5;

    setSwapping(true);
    setTx({ html: '<span class="v3-spinner"></span> Validating...', type: 'pending' });
    try {
      const poolCheck = await v3ValidatePool(reads, fromToken, toToken, swapFee);
      if (!poolCheck.valid) {
        setTx({ html: `❌ ${poolCheck.error}`, type: 'error' });
        return;
      }
      const balCheck = await v3CheckBalance(reads, userAddress, fromToken, amountIn);
      if (!balCheck.sufficient) {
        setTx({ html: `❌ ${balCheck.error}`, type: 'error' });
        return;
      }

      setTx({ html: '<span class="v3-spinner"></span> Getting quote...', type: 'pending' });
      const quoter = new ethers.Contract(V3_QUOTER, V3_QUOTER_ABI, reads);
      let quotedOut: ethers.BigNumber;
      try {
        quotedOut = await quoter.callStatic.quoteExactInputSingle(fromToken, toToken, swapFee, amountIn, 0);
      } catch (quoteErr) {
        setTx({ html: `❌ ${v3GetErrorMessage(quoteErr, 'Quote failed. The pool may not have enough liquidity for this trade.')}`, type: 'error' });
        return;
      }
      if (quotedOut.eq(0)) {
        setTx({ html: '❌ Quote returned 0. The pool may have no liquidity.', type: 'error' });
        return;
      }
      const slippageBps = Math.max(0, Math.floor((100 - slip) * 100));
      const amountOutMin = quotedOut.mul(slippageBps).div(10000);

      setTx({ html: '<span class="v3-spinner"></span> Approving token...', type: 'pending' });
      const tokenContract = new ethers.Contract(fromToken, ERC20_ABI, signer);
      const approveAmt = amountIn.add(amountIn.div(100).gt(1000) ? amountIn.div(100) : ethers.BigNumber.from(1000));
      const bal = await tokenContract.balanceOf(userAddress);
      const safeApprove = approveAmt.gt(bal) ? bal : approveAmt;
      const allowance = await tokenContract.allowance(userAddress, V3_SWAP_ROUTER);
      if (allowance.lt(amountIn)) {
        if (!allowance.isZero()) {
          const resetTx = await tokenContract.approve(V3_SWAP_ROUTER, 0, { gasLimit: 100000 });
          await resetTx.wait();
        }
        const approveTx = await tokenContract.approve(V3_SWAP_ROUTER, safeApprove, { gasLimit: 100000 });
        setTx({ html: `<span class="v3-spinner"></span> Approval sent... ${txLink(approveTx.hash)}`, type: 'pending' });
        await approveTx.wait();
      }

      setTx({ html: '<span class="v3-spinner"></span> Sending swap transaction...', type: 'pending' });
      const router = new ethers.Contract(V3_SWAP_ROUTER, V3_SWAP_ROUTER_ABI, signer);
      const deadline = Math.floor(Date.now() / 1000) + 1200;
      const swapParams = {
        tokenIn: fromToken,
        tokenOut: toToken,
        fee: swapFee,
        recipient: userAddress,
        deadline,
        amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0,
      };
      let gasEstimate: ethers.BigNumber;
      try {
        gasEstimate = await router.estimateGas.exactInputSingle(swapParams);
      } catch (gasErr) {
        setTx({ html: `❌ ${v3GetErrorMessage(gasErr, 'Transaction would fail. The pool may have insufficient liquidity or the price has moved.')}`, type: 'error' });
        return;
      }
      const txObj = await router.exactInputSingle(swapParams, { gasLimit: gasEstimate.mul(120).div(100) });
      setTx({ html: `<span class="v3-spinner"></span> Transaction sent! Waiting for confirmation...<br>${txLink(txObj.hash)}`, type: 'pending' });
      await txObj.wait();

      const outFormatted = parseFloat(ethers.utils.formatUnits(quotedOut, toInfo.decimals)).toFixed(6);
      setTx({ html: `✅ Swapped ${amount} ${fromInfo.symbol} → ~${outFormatted} ${toInfo.symbol}<br>${txLink(txObj.hash)}`, type: 'success' });
      showStatus('V3 Swap successful!', 'success');
      setFromAmount('');
      setToAmount('');
    } catch (e) {
      setTx({ html: `❌ ${v3GetErrorMessage(e, 'Swap failed')}`, type: 'error' });
    } finally {
      setSwapping(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-[18px]">
        <div className="section-title mb-0 text-left">SWAP V3</div>
        <ConnectWalletButton />
      </div>

      <div className="v3-slippage-row">
        <label>SLIPPAGE</label>
        <input
          type="number"
          className="v3-slippage-input"
          value={slippage}
          min="0.01"
          max="50"
          step="0.1"
          onChange={(e) => setSlippage(e.target.value)}
        />
        <label>%</label>
      </div>

      <div className="slippage-options">
        {SWAP_FEES.map((f) => (
          <button key={f} className={`slippage-btn${swapFee === f ? ' active' : ''}`} onClick={() => setSwapFee(f)}>
            {v3FeeToPercent(f)}
          </button>
        ))}
      </div>

      <div className="input-group mb-3">
        <div className="input-label">
          <span>From</span>
          <span className="balance" onClick={maxFrom} style={{ cursor: 'pointer' }}>
            {fromBal}
          </span>
        </div>
        <div className="input-wrapper">
          <select className="token-select" value={fromToken} onChange={(e) => setFromToken(e.target.value)}>
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="token-input"
            placeholder="0.0"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="text-center my-2">
        <button
          onClick={swapDirection}
          className="bg-[rgba(255,215,0,0.06)] border border-[rgba(255,215,0,0.15)] rounded-[10px] w-8 h-8 text-gold cursor-pointer text-base"
        >
          ↕
        </button>
      </div>

      <div className="input-group mb-4">
        <div className="input-label">
          <span>To</span>
          <span>{toBal}</span>
        </div>
        <div className="input-wrapper">
          <select className="token-select" value={toToken} onChange={(e) => setToToken(e.target.value)}>
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
          <input type="number" className="token-input" placeholder="0.0" value={toAmount} readOnly />
        </div>
      </div>

      {route && (
        <div className="v3-swap-route">
          <div className="v3-swap-route-title">ROUTE</div>
          <div className="v3-swap-route-path">
            <span>{route.from}</span>
            <span className="v3-route-arrow">→</span>
            <span className="v3-route-fee">{v3FeeToPercent(route.fee)}</span>
            <span className="v3-route-arrow">→</span>
            <span>{route.to}</span>
          </div>
        </div>
      )}

      {details && (
        <div className="pool-info">
          <div className="info-row">
            <span className="info-label">Price Impact</span>
            <span className="info-value">{details.impact}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Min. Received</span>
            <span className="info-value">{details.min}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Fee Tier</span>
            <span className="info-value">{details.fee}</span>
          </div>
        </div>
      )}

      {isConnected ? (
        <button className="action-btn" style={{ width: '100%' }} onClick={executeSwap} disabled={swapping}>
          {swapping ? 'Swapping...' : 'Swap'}
        </button>
      ) : (
        <button className="action-btn" style={{ width: '100%' }} onClick={connectWallet}>
          Connect Wallet
        </button>
      )}

      {tx.html && <div className={`v3-tx-status ${tx.type}`} dangerouslySetInnerHTML={{ __html: tx.html }} />}
    </div>
  );
}
