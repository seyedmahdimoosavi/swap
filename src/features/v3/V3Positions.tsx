import { useCallback, useEffect, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../context/Web3Context';
import { useStatus } from '../../context/StatusContext';
import { EXPLORER_BASE, V3_POOL_ABI, V3_POSITION_MANAGER, V3_POSITION_MANAGER_ABI } from '../../config/v3';
import { getV3Pool, getV3TokenInfo, v3FeeToPercent, v3GetErrorMessage, v3SqrtPriceToPrice, v3TickToPrice } from '../../lib/v3';

interface Position {
  tokenId: string;
  pairLabel: string;
  priceLower: number;
  priceUpper: number;
  currentPrice: number;
  inRange: boolean;
  liquidityStr: string;
  hasLiquidity: boolean;
  feePct: string;
  feesOwed0: string;
  feesOwed1: string;
  sym0: string;
  sym1: string;
}

interface TxStatus {
  html: string;
  type: '' | 'pending' | 'success' | 'error';
}

function txLink(hash: string) {
  return `<a href="${EXPLORER_BASE}/tx/${hash}" target="_blank" class="v3-tx-link">🔗 View Transaction ↗</a>`;
}

export default function V3Positions() {
  const { readOnlyProvider, provider, signer, userAddress } = useWeb3();
  const { showStatus } = useStatus();
  const reads = provider ?? readOnlyProvider;

  const [positions, setPositions] = useState<Position[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxStatus>({ html: '', type: '' });
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const loadPositions = useCallback(async () => {
    if (!userAddress || !provider) {
      setPositions(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pm = new ethers.Contract(V3_POSITION_MANAGER, V3_POSITION_MANAGER_ABI, provider);
      const balance = await pm.balanceOf(userAddress);
      const count = balance.toNumber();
      const list: Position[] = [];
      for (let i = 0; i < count; i++) {
        try {
          const tokenId = await pm.tokenOfOwnerByIndex(userAddress, i);
          const pos = await pm.positions(tokenId);
          const t0 = getV3TokenInfo(pos.token0);
          const t1 = getV3TokenInfo(pos.token1);
          const priceLower = v3TickToPrice(pos.tickLower, t0.decimals, t1.decimals);
          const priceUpper = v3TickToPrice(pos.tickUpper, t0.decimals, t1.decimals);
          let currentPrice = 0;
          let inRange = false;
          try {
            const poolAddr = await getV3Pool(reads, pos.token0, pos.token1, pos.fee);
            if (poolAddr && poolAddr !== ethers.constants.AddressZero) {
              const pool = new ethers.Contract(poolAddr, V3_POOL_ABI, reads);
              const slot0 = await pool.slot0();
              currentPrice = v3SqrtPriceToPrice(slot0.sqrtPriceX96, t0.decimals, t1.decimals);
              inRange = slot0.tick >= pos.tickLower && slot0.tick < pos.tickUpper;
            }
          } catch {
            /* ignore pool read */
          }
          const liquidityStr = pos.liquidity.toString();
          list.push({
            tokenId: tokenId.toString(),
            pairLabel: `${t0.symbol} / ${t1.symbol}`,
            priceLower,
            priceUpper,
            currentPrice,
            inRange,
            liquidityStr,
            hasLiquidity: !pos.liquidity.isZero(),
            feePct: v3FeeToPercent(pos.fee),
            feesOwed0: parseFloat(ethers.utils.formatUnits(pos.tokensOwed0, t0.decimals)).toFixed(6),
            feesOwed1: parseFloat(ethers.utils.formatUnits(pos.tokensOwed1, t1.decimals)).toFixed(6),
            sym0: t0.symbol,
            sym1: t1.symbol,
          });
        } catch (e) {
          console.warn('Error loading position', i, e);
        }
      }
      setPositions(list);
    } catch (e) {
      setError((e as Error).message || '');
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [userAddress, provider, reads]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  // Draw mini charts whenever positions change
  useEffect(() => {
    if (!positions) return;
    positions.forEach((p) => {
      const canvas = canvasRefs.current[p.tokenId];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const container = canvas.parentElement;
      if (!ctx || !container) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      const width = container.clientWidth;
      const height = container.clientHeight;
      const minP = p.priceLower;
      const maxP = p.priceUpper;
      const currentP = p.currentPrice;
      const range = maxP - minP;
      if (range <= 0) return;
      const extMin = minP - range * 0.3;
      const extMax = maxP + range * 0.3;
      const totalRange = extMax - extMin;
      const rangeLeft = ((minP - extMin) / totalRange) * width;
      const rangeRight = ((maxP - extMin) / totalRange) * width;
      ctx.fillStyle = 'rgba(255,215,0,0.08)';
      ctx.fillRect(rangeLeft, 0, rangeRight - rangeLeft, height);
      const numBars = 40;
      const barW = width / numBars;
      for (let i = 0; i < numBars; i++) {
        const price = extMin + (totalRange / numBars) * i;
        const dist = Math.abs(price - (minP + maxP) / 2) / (range / 2);
        const h = Math.max(2, Math.exp(-dist * dist) * height * 0.7 + Math.random() * 3);
        const inR = price >= minP && price <= maxP;
        ctx.fillStyle = inR ? 'rgba(255,215,0,0.5)' : 'rgba(255,215,0,0.12)';
        ctx.fillRect(i * barW, height - h, barW - 1, h);
      }
      const cpx = ((currentP - extMin) / totalRange) * width;
      ctx.strokeStyle = currentP >= minP && currentP <= maxP ? '#00ff64' : '#ff6400';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cpx, 0);
      ctx.lineTo(cpx, height);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }, [positions]);

  async function collectFees(tokenId: string) {
    if (!signer || !userAddress) {
      showStatus('Connect wallet first', 'error');
      return;
    }
    setTx({ html: `<span class="v3-spinner"></span> Collecting fees for #${tokenId}...`, type: 'pending' });
    try {
      const pm = new ethers.Contract(V3_POSITION_MANAGER, V3_POSITION_MANAGER_ABI, signer);
      const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);
      const t = await pm.collect({ tokenId, recipient: userAddress, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 });
      setTx({ html: `<span class="v3-spinner"></span> Collecting fees...<br>${txLink(t.hash)}`, type: 'pending' });
      await t.wait();
      setTx({ html: `✅ Fees collected for position #${tokenId}!<br>${txLink(t.hash)}`, type: 'success' });
      showStatus('Fees collected!', 'success');
      setTimeout(loadPositions, 1000);
    } catch (e) {
      setTx({ html: `❌ ${v3GetErrorMessage(e, 'Failed to collect fees')}`, type: 'error' });
    }
  }

  async function removeLiquidity(tokenId: string) {
    if (!signer || !userAddress) {
      showStatus('Connect wallet first', 'error');
      return;
    }
    setTx({ html: `<span class="v3-spinner"></span> Removing liquidity from #${tokenId}...`, type: 'pending' });
    try {
      const pm = new ethers.Contract(V3_POSITION_MANAGER, V3_POSITION_MANAGER_ABI, signer);
      const pos = await pm.positions(tokenId);
      if (pos.liquidity.isZero()) {
        setTx({ html: 'Position has no liquidity to remove', type: 'error' });
        return;
      }
      const deadline = Math.floor(Date.now() / 1000) + 1200;
      const decreaseTx = await pm.decreaseLiquidity({ tokenId, liquidity: pos.liquidity, amount0Min: 0, amount1Min: 0, deadline });
      setTx({ html: `<span class="v3-spinner"></span> Removing liquidity...<br>${txLink(decreaseTx.hash)}`, type: 'pending' });
      await decreaseTx.wait();
      const MAX_UINT128 = ethers.BigNumber.from(2).pow(128).sub(1);
      const collectTx = await pm.collect({ tokenId, recipient: userAddress, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 });
      await collectTx.wait();
      setTx({ html: `✅ Liquidity removed from position #${tokenId}!<br>${txLink(decreaseTx.hash)}`, type: 'success' });
      showStatus('Liquidity removed!', 'success');
      setTimeout(loadPositions, 1000);
    } catch (e) {
      setTx({ html: `❌ ${v3GetErrorMessage(e, 'Failed to remove liquidity')}`, type: 'error' });
    }
  }

  async function addNFTToWallet(tokenId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = (window as any).ethereum;
    if (!eth) {
      showStatus('MetaMask not found', 'error');
      return;
    }
    try {
      await eth.request({
        method: 'wallet_watchAsset',
        params: { type: 'ERC721', options: { address: V3_POSITION_MANAGER, tokenId } },
      });
      showStatus('NFT #' + tokenId + ' added to wallet!', 'success');
    } catch (e) {
      showStatus('Failed to add NFT to wallet: ' + ((e as Error).message || ''), 'error');
    }
  }

  return (
    <div className="card">
      <div className="section-title">YOUR POSITIONS</div>
      <button
        className="action-btn"
        style={{ width: '100%', marginBottom: 16, fontSize: '0.7rem', padding: 12 }}
        onClick={loadPositions}
      >
        ↻ Refresh Positions
      </button>

      <div className="v3-positions-section">
        {!userAddress ? (
          <div className="v3-no-positions">
            <div className="empty-icon">📭</div>
            <p>Connect wallet and switch to V3 to view your positions</p>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--gold-dark)' }}>
            <span className="v3-spinner" /> Loading positions...
          </div>
        ) : error ? (
          <div className="v3-no-positions">
            <div className="empty-icon">⚠️</div>
            <p>Error loading positions</p>
            <p style={{ fontSize: '0.7rem', color: '#ff6b6b' }}>{error}</p>
          </div>
        ) : positions && positions.length === 0 ? (
          <div className="v3-no-positions">
            <div className="empty-icon">📭</div>
            <p>No V3 positions found</p>
            <p style={{ fontSize: '0.7rem', color: '#5a4a2a' }}>Add liquidity to create your first position</p>
          </div>
        ) : (
          positions?.map((p) => {
            const currentColor = p.inRange ? '#00ff64' : '#ff6400';
            return (
              <div className="v3-position-card" key={p.tokenId}>
                <div className="v3-position-header">
                  <span className="v3-position-pair">{p.pairLabel}</span>
                  <span className="v3-position-id">#{p.tokenId}</span>
                </div>
                <div className="v3-position-range">
                  <div className="v3-range-badge">
                    <div className="v3-range-label">MIN</div>
                    <div className="v3-range-value">{p.priceLower.toFixed(4)}</div>
                  </div>
                  <div className="v3-range-badge">
                    <div className="v3-range-label">CURRENT</div>
                    <div className="v3-range-value" style={{ color: currentColor }}>
                      {p.currentPrice.toFixed(4)}
                    </div>
                  </div>
                  <div className="v3-range-badge">
                    <div className="v3-range-label">MAX</div>
                    <div className="v3-range-value">{p.priceUpper.toFixed(4)}</div>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span className={`v3-position-status ${p.inRange ? 'v3-status-in-range' : 'v3-status-out-range'}`}>
                    {p.inRange ? '● IN RANGE' : '● OUT OF RANGE'}
                  </span>
                </div>
                <div className="v3-position-mini-chart">
                  <canvas
                    ref={(el) => {
                      canvasRefs.current[p.tokenId] = el;
                    }}
                  />
                </div>
                <div className="v3-position-stats">
                  <div className="v3-position-stat">
                    <div className="v3-stat-label">LIQUIDITY</div>
                    <div className="v3-stat-value">{p.hasLiquidity ? p.liquidityStr.slice(0, 8) : '0'}</div>
                  </div>
                  <div className="v3-position-stat">
                    <div className="v3-stat-label">FEE TIER</div>
                    <div className="v3-stat-value">{p.feePct}</div>
                  </div>
                  <div className="v3-position-stat">
                    <div className="v3-stat-label">FEES OWED</div>
                    <div className="v3-stat-value" style={{ color: '#00ff64', fontSize: '0.65rem' }}>
                      {p.feesOwed0} {p.sym0}
                      <br />
                      {p.feesOwed1} {p.sym1}
                    </div>
                  </div>
                </div>
                <div className="v3-position-actions">
                  <button className="v3-pos-action-btn" onClick={() => collectFees(p.tokenId)}>
                    💰 Collect Fees
                  </button>
                  {p.hasLiquidity && (
                    <button className="v3-pos-action-btn danger" onClick={() => removeLiquidity(p.tokenId)}>
                      📤 Remove
                    </button>
                  )}
                  <button className="v3-pos-action-btn" onClick={() => addNFTToWallet(p.tokenId)}>
                    🖼️ Add to Wallet
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {tx.html && <div className={`v3-tx-status ${tx.type}`} dangerouslySetInnerHTML={{ __html: tx.html }} />}
    </div>
  );
}
