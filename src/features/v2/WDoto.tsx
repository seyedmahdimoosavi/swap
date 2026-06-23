import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../context/Web3Context';
import { useStatus } from '../../context/StatusContext';
import ConnectWalletButton from '../../components/ConnectWalletButton';
import { WDOTO_ADDRESS } from '../../config/contracts';
import { WDOTO_ABI } from '../../config/abis';
import { txUrl, addressUrl } from '../../lib/format';

type Mode = 'wrap' | 'unwrap';
interface Tx {
  html: string;
  type: '' | 'info' | 'success' | 'error';
}

export default function WDoto() {
  const { provider, readOnlyProvider, signer, userAddress, isConnected, connectWallet } = useWeb3();
  const { showStatus } = useStatus();

  const [mode, setMode] = useState<Mode>('wrap');
  const [amount, setAmount] = useState('');
  const [inputBal, setInputBal] = useState('Balance: --');
  const [outputBal, setOutputBal] = useState('Balance: --');
  const [tx, setTx] = useState<Tx>({ html: '', type: '' });
  const [busy, setBusy] = useState(false);

  const reads = provider ?? readOnlyProvider;

  const loadBalances = useCallback(async () => {
    if (!userAddress) {
      setInputBal('Balance: --');
      setOutputBal('Balance: --');
      return;
    }
    try {
      const dotoBal = await reads.getBalance(userAddress);
      const wdoto = new ethers.Contract(WDOTO_ADDRESS, WDOTO_ABI, reads);
      const wdotoBal = await wdoto.balanceOf(userAddress);
      const doto = parseFloat(ethers.utils.formatEther(dotoBal)).toFixed(4);
      const wd = parseFloat(ethers.utils.formatEther(wdotoBal)).toFixed(4);
      if (mode === 'wrap') {
        setInputBal(`Balance: ${doto} DOTO`);
        setOutputBal(`Balance: ${wd} WDOTO`);
      } else {
        setInputBal(`Balance: ${wd} WDOTO`);
        setOutputBal(`Balance: ${doto} DOTO`);
      }
    } catch (e) {
      console.error('Error loading WDOTO balances:', e);
    }
  }, [userAddress, reads, mode]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const setMax = async () => {
    if (!userAddress) return;
    try {
      if (mode === 'wrap') {
        const bal = await reads.getBalance(userAddress);
        const gasReserve = ethers.utils.parseEther('0.01');
        const maxAmount = bal.gt(gasReserve) ? bal.sub(gasReserve) : ethers.BigNumber.from(0);
        setAmount(ethers.utils.formatEther(maxAmount));
      } else {
        const wdoto = new ethers.Contract(WDOTO_ADDRESS, WDOTO_ABI, reads);
        const bal = await wdoto.balanceOf(userAddress);
        setAmount(ethers.utils.formatEther(bal));
      }
    } catch (e) {
      console.error('Error setting max WDOTO:', e);
    }
  };

  async function addWdotoToWallet() {
    const eth = window.ethereum;
    if (!eth) {
      setTx({ html: 'Please install MetaMask to add tokens', type: 'error' });
      return;
    }
    try {
      const wasAdded = await eth.request({
        method: 'wallet_watchAsset',
        params: { type: 'ERC20', options: { address: WDOTO_ADDRESS, symbol: 'WDOTO', decimals: 18 } },
      });
      setTx(wasAdded ? { html: 'WDOTO token added to wallet successfully!', type: 'success' } : { html: 'Token addition was cancelled', type: 'info' });
    } catch (e) {
      console.error('Error adding WDOTO to wallet:', e);
      setTx({ html: 'Failed to add WDOTO to wallet', type: 'error' });
    }
  }

  async function execute() {
    if (!signer || !userAddress) {
      showStatus('Please connect your wallet first', 'error');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setTx({ html: 'Please enter a valid amount', type: 'error' });
      return;
    }
    const value = ethers.utils.parseEther(amount);
    const wdoto = new ethers.Contract(WDOTO_ADDRESS, WDOTO_ABI, signer);
    setBusy(true);
    try {
      let txObj;
      if (mode === 'wrap') {
        setTx({ html: 'Sending wrap transaction...', type: 'info' });
        txObj = await wdoto.deposit({ value });
      } else {
        setTx({ html: 'Sending unwrap transaction...', type: 'info' });
        txObj = await wdoto.withdraw(value);
      }
      setTx({
        html: `Transaction sent! <a href="${txUrl(txObj.hash)}" target="_blank">${txObj.hash.slice(0, 10)}...${txObj.hash.slice(-8)} ↗</a> — Waiting for confirmation...`,
        type: 'info',
      });
      const receipt = await txObj.wait();
      if (receipt.status === 1) {
        const action = mode === 'wrap' ? 'Wrapped' : 'Unwrapped';
        const fromT = mode === 'wrap' ? 'DOTO' : 'WDOTO';
        const toT = mode === 'wrap' ? 'WDOTO' : 'DOTO';
        setTx({
          html: `${action} ${amount} ${fromT} to ${amount} ${toT} successfully! <a href="${txUrl(txObj.hash)}" target="_blank">View Transaction ↗</a>`,
          type: 'success',
        });
        showStatus(`${action} ${amount} ${fromT} → ${toT} successfully!`, 'success');
      } else {
        setTx({ html: 'Transaction failed! Please try again.', type: 'error' });
        showStatus('WDOTO transaction failed', 'error');
      }
      setAmount('');
      loadBalances();
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = e as any;
      let msg = 'Transaction failed';
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) msg = 'Transaction rejected by user';
      else if (err.message) msg = err.message.length > 100 ? err.message.slice(0, 100) + '...' : err.message;
      setTx({ html: msg, type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const inputLabel = mode === 'wrap' ? 'Amount (DOTO)' : 'Amount (WDOTO)';
  const outputLabel = mode === 'wrap' ? 'You will receive (WDOTO)' : 'You will receive (DOTO)';
  const btnLabel = busy ? (mode === 'wrap' ? 'Wrapping...' : 'Unwrapping...') : mode === 'wrap' ? 'Wrap DOTO' : 'Unwrap WDOTO';
  const amtValid = !!amount && parseFloat(amount) > 0;

  return (
    <div id="wdotoSection">
      <div className="card">
        <div className="flex items-center justify-between mb-[18px]">
          <div className="section-title mb-0 text-left">Wrap / Unwrap DOTO</div>
          <ConnectWalletButton />
        </div>
        <p style={{ color: 'var(--gold-dark)', fontSize: '0.8rem', marginBottom: 18, fontWeight: 500, textAlign: 'center' }}>
          Convert between DOTO and WDOTO (Wrapped DOTO)
        </p>

        <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '2px solid rgba(255,215,0,0.15)', borderRadius: 10, overflow: 'hidden' }}>
          <button
            className={`slippage-btn${mode === 'wrap' ? ' active' : ''}`}
            onClick={() => setMode('wrap')}
            style={{ flex: 1, borderRadius: 0, border: 'none', padding: 12 }}
          >
            Wrap (DOTO → WDOTO)
          </button>
          <button
            className={`slippage-btn${mode === 'unwrap' ? ' active' : ''}`}
            onClick={() => setMode('unwrap')}
            style={{ flex: 1, borderRadius: 0, border: 'none', padding: 12 }}
          >
            Unwrap (WDOTO → DOTO)
          </button>
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>{inputLabel}</span>
            <span className="balance" onClick={setMax}>
              {inputBal}
            </span>
          </div>
          <div className="input-wrapper">
            <input type="number" className="token-input" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>

        <div className="swap-arrow">
          <button onClick={() => setMode(mode === 'wrap' ? 'unwrap' : 'wrap')} style={{ fontSize: '1.2rem' }}>
            ⇅
          </button>
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>{outputLabel}</span>
            <span className="balance">{outputBal}</span>
          </div>
          <div className="input-wrapper">
            <input type="number" className="token-input" placeholder="0.0" value={amount} readOnly />
          </div>
        </div>

        <div className="pool-info" style={{ marginTop: 15 }}>
          <div className="pool-info-title">WDOTO Info</div>
          <div className="info-row">
            <span className="info-label">Contract</span>
            <span className="info-value" style={{ fontSize: '0.65rem', wordBreak: 'break-all' }}>
              <a href={addressUrl(WDOTO_ADDRESS)} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
                {WDOTO_ADDRESS} ↗
              </a>
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Rate</span>
            <span className="info-value">1 DOTO = 1 WDOTO</span>
          </div>
        </div>

        <button className="pool-add-to-wallet-btn" onClick={addWdotoToWallet} style={{ width: '100%', marginTop: 12, padding: 12, justifyContent: 'center', fontSize: '0.75rem' }}>
          <span className="wallet-icon">🦊</span> Add WDOTO to Wallet
        </button>

        {tx.html && <div className={`pool-form-status show ${tx.type}`} style={{ marginTop: 12, borderRadius: 10, padding: 12 }} dangerouslySetInnerHTML={{ __html: tx.html }} />}
      </div>

      {isConnected ? (
        <button className="action-btn" onClick={execute} disabled={busy || !amtValid}>
          {amtValid ? btnLabel : 'Enter an amount'}
        </button>
      ) : (
        <button className="action-btn" onClick={connectWallet}>
          Connect Wallet
        </button>
      )}
    </div>
  );
}
