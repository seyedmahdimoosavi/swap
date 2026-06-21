import { useState } from 'react';
import { useStatus } from '../../context/StatusContext';
import { V3_CURRENT_PRICE } from '../../lib/v3';
import { useWeb3 } from '../../context/Web3Context';
import ConnectWalletButton from '../../components/ConnectWalletButton';

export default function V3Swap({ selectedFee }: { selectedFee: number }) {
  const { showStatus } = useStatus();
  const { isConnected, connectWallet } = useWeb3();
  const [fromToken, setFromToken] = useState('T1');
  const [toToken, setToToken] = useState('T2');
  const [fromAmount, setFromAmount] = useState('');

  const amount = parseFloat(fromAmount);
  const hasOutput = amount > 0;

  let output = 0;
  if (hasOutput) {
    output = fromToken === 'T1' ? amount * V3_CURRENT_PRICE : amount / V3_CURRENT_PRICE;
    output *= 1 - selectedFee / 100;
  }
  const toAmount = hasOutput ? output.toFixed(6) : '';
  const minReceived = hasOutput ? `${(output * 0.995).toFixed(6)} ${toToken}` : '';
  const priceImpact = hasOutput ? `~${(amount * 0.001).toFixed(2)}%` : '';

  const swapDirection = () => {
    setFromToken(toToken);
    setToToken(fromToken);
  };

  return (
    <div className="v3-card">
      <div className="flex items-center justify-between mb-[18px]">
        <div className="v3-card-title mb-0">SWAP V3</div>
        <ConnectWalletButton />
      </div>

      <div className="input-group mb-3">
        <label className="v3-field-label">From</label>
        <div className="input-wrapper">
          <select className="token-select" value={fromToken} onChange={(e) => setFromToken(e.target.value)}>
            <option value="T1">T1</option>
            <option value="T2">T2</option>
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
        <label className="v3-field-label">To</label>
        <div className="input-wrapper">
          <select className="token-select" value={toToken} onChange={(e) => setToToken(e.target.value)}>
            <option value="T2">T2</option>
            <option value="T1">T1</option>
          </select>
          <input type="number" className="token-input" placeholder="0.0" value={toAmount} readOnly />
        </div>
      </div>

      {hasOutput && (
        <>
          <div className="v3-swap-route">
            <div className="v3-swap-route-title">ROUTE</div>
            <div className="v3-swap-route-path">
              <span>{fromToken}</span>
              <span className="v3-route-arrow">→</span>
              <span className="v3-route-fee">{selectedFee}%</span>
              <span className="v3-route-arrow">→</span>
              <span>{toToken}</span>
            </div>
          </div>

          <div className="v3-position-summary">
            <div className="v3-summary-row">
              <span className="v3-summary-label">Price Impact</span>
              <span className="v3-summary-value">{priceImpact}</span>
            </div>
            <div className="v3-summary-row">
              <span className="v3-summary-label">Min. Received</span>
              <span className="v3-summary-value">{minReceived}</span>
            </div>
            <div className="v3-summary-row">
              <span className="v3-summary-label">Fee Tier</span>
              <span className="v3-summary-value">{selectedFee}%</span>
            </div>
          </div>
        </>
      )}

      <button
        className="action-btn w-full"
        onClick={() => {
          if (!isConnected) {
            connectWallet();
            return;
          }
          showStatus('V3 is not available yet — V3 contracts are not deployed.', 'error');
          setFromAmount('');
        }}
      >
        {isConnected ? 'Swap' : 'Connect Wallet'}
      </button>
    </div>
  );
}
