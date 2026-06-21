import { useEffect, useMemo, useRef, useState } from 'react';
import { useStatus } from '../../context/StatusContext';
import { generateLiquidityData, V3_CURRENT_PRICE } from '../../lib/v3';
import { useWeb3 } from '../../context/Web3Context';
import ConnectWalletButton from '../../components/ConnectWalletButton';

interface Props {
  selectedFee: number;
  onSelectFee: (fee: number) => void;
}

const FEE_TIERS = [
  { fee: 0.01, label: '0.01%', desc: 'Stables', pct: '—' },
  { fee: 0.05, label: '0.05%', desc: 'Low vol', pct: '—' },
  { fee: 0.3, label: '0.30%', desc: 'Medium', pct: 'Most Used' },
  { fee: 1, label: '1.00%', desc: 'Exotic', pct: '—' },
];

const PRESETS = [
  { pct: 10, label: '±10%' },
  { pct: 20, label: '±20%' },
  { pct: 50, label: '±50%' },
  { pct: 100, label: 'Full Range' },
];

export default function V3Liquidity({ selectedFee, onSelectFee }: Props) {
  const { showStatus } = useStatus();
  const { isConnected, connectWallet } = useWeb3();
  const [token0, setToken0] = useState('T1');
  const [token1, setToken1] = useState('T2');
  const [minPrice, setMinPrice] = useState(1500);
  const [maxPrice, setMaxPrice] = useState(2200);
  const [activePreset, setActivePreset] = useState(20);
  const [deposit0, setDeposit0] = useState('');
  const [deposit1, setDeposit1] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Generate the distribution once so bars stay stable while the range moves.
  const data = useMemo(() => generateLiquidityData(), []);

  const minData = data[0].price;
  const maxData = data[data.length - 1].price;

  // Draw bars on the canvas, recoloring by in/out of range.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    if (!ctx || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const maxLiq = Math.max(...data.map((d) => d.liquidity));
    const barWidth = (width - 20) / data.length;
    const chartHeight = height - 25;

    data.forEach((d, i) => {
      const x = 10 + i * barWidth;
      const barH = (d.liquidity / maxLiq) * chartHeight * 0.85;
      const y = chartHeight - barH;
      const inRange = d.price >= minPrice && d.price <= maxPrice;
      if (inRange) {
        const gradient = ctx.createLinearGradient(x, y, x, chartHeight);
        gradient.addColorStop(0, 'rgba(255,215,0,0.7)');
        gradient.addColorStop(1, 'rgba(255,215,0,0.15)');
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = 'rgba(255,215,0,0.12)';
      }
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(barWidth - 1, 1), barH, [2, 2, 0, 0]);
      ctx.fill();
    });
  }, [data, minPrice, maxPrice]);

  const currentLineLeft = `${((V3_CURRENT_PRICE - minData) / (maxData - minData)) * 100}%`;
  const overlayLeft = Math.max(0, ((minPrice - minData) / (maxData - minData)) * 100);
  const overlayRight = ((maxPrice - minData) / (maxData - minData)) * 100;
  const overlayWidth = Math.min(100, overlayRight - overlayLeft);

  const adjustPrice = (type: 'min' | 'max', direction: number) => {
    const step = V3_CURRENT_PRICE * 0.01;
    if (type === 'min') setMinPrice((v) => Math.max(0, Math.round(v + direction * step)));
    else setMaxPrice((v) => Math.max(0, Math.round(v + direction * step)));
  };

  const setRangePreset = (pct: number) => {
    setActivePreset(pct);
    if (pct === 100) {
      setMinPrice(0);
      setMaxPrice(Math.round(V3_CURRENT_PRICE * 10));
    } else {
      setMinPrice(Math.round(V3_CURRENT_PRICE * (1 - pct / 100)));
      setMaxPrice(Math.round(V3_CURRENT_PRICE * (1 + pct / 100)));
    }
  };

  const efficiency = minPrice > 0 && maxPrice > minPrice ? ((V3_CURRENT_PRICE * 2) / (maxPrice - minPrice)).toFixed(1) : '—';

  return (
    <div className="v3-card">
      <div className="flex items-center justify-between mb-[18px]">
        <div className="v3-card-title mb-0">ADD LIQUIDITY V3</div>
        <ConnectWalletButton />
      </div>

      <div className="v3-pair-row">
        <div className="v3-pair-select flex-1">
          <select className="token-select w-full" value={token0} onChange={(e) => setToken0(e.target.value)}>
            <option value="T1">T1</option>
            <option value="T2">T2</option>
          </select>
        </div>
        <div className="v3-pair-arrow">⇌</div>
        <div className="v3-pair-select flex-1">
          <select className="token-select w-full" value={token1} onChange={(e) => setToken1(e.target.value)}>
            <option value="T2">T2</option>
            <option value="T1">T1</option>
          </select>
        </div>
      </div>

      <div className="fee-tier-section">
        <div className="fee-tier-label">FEE TIER</div>
        <div className="fee-tiers">
          {FEE_TIERS.map((t) => (
            <button
              key={t.fee}
              className={`fee-tier-btn${selectedFee === t.fee ? ' active' : ''}`}
              onClick={() => onSelectFee(t.fee)}
            >
              <div className="fee-tier-value">{t.label}</div>
              <div className="fee-tier-desc">{t.desc}</div>
              <div className="fee-tier-pct">{t.pct}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="liquidity-chart-section">
        <div className="chart-header">
          <div className="chart-title">LIQUIDITY DISTRIBUTION</div>
          <div className="chart-current-price">
            1 {token0} = {V3_CURRENT_PRICE.toLocaleString()} {token1}
          </div>
        </div>
        <div className="chart-wrapper">
          <div className="chart-canvas-container">
            <canvas ref={canvasRef} />
            <div className="chart-current-line" style={{ left: currentLineLeft }} />
            <div className="chart-range-overlay" style={{ left: `${overlayLeft}%`, width: `${overlayWidth}%` }} />
          </div>
          <div className="chart-axis">
            <span>{minData.toLocaleString()}</span>
            <span>{maxData.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="price-range-section">
        <div className="price-range-header">SET PRICE RANGE</div>
        <div className="price-range-inputs">
          <div className="price-range-box">
            <div className="price-range-box-label">MIN PRICE</div>
            <div className="price-range-input-wrap">
              <button className="price-range-btn" onClick={() => adjustPrice('min', -1)}>
                −
              </button>
              <input
                type="number"
                className="price-range-value"
                value={minPrice}
                onChange={(e) => setMinPrice(parseFloat(e.target.value) || 0)}
              />
              <button className="price-range-btn" onClick={() => adjustPrice('min', 1)}>
                +
              </button>
            </div>
            <div className="price-range-per">
              {token1} per {token0}
            </div>
          </div>
          <div className="price-range-box">
            <div className="price-range-box-label">MAX PRICE</div>
            <div className="price-range-input-wrap">
              <button className="price-range-btn" onClick={() => adjustPrice('max', -1)}>
                −
              </button>
              <input
                type="number"
                className="price-range-value"
                value={maxPrice}
                onChange={(e) => setMaxPrice(parseFloat(e.target.value) || 0)}
              />
              <button className="price-range-btn" onClick={() => adjustPrice('max', 1)}>
                +
              </button>
            </div>
            <div className="price-range-per">
              {token1} per {token0}
            </div>
          </div>
        </div>
        <div className="price-range-presets">
          {PRESETS.map((p) => (
            <button
              key={p.pct}
              className={`range-preset-btn${activePreset === p.pct ? ' active' : ''}`}
              onClick={() => setRangePreset(p.pct)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="v3-deposit-section">
        <div className="v3-deposit-label">DEPOSIT AMOUNTS</div>
        <div className="v3-deposit-box">
          <div className="v3-deposit-box-header">
            <span className="v3-deposit-token-name">{token0}</span>
            <span className="v3-deposit-balance">Balance: —</span>
          </div>
          <input
            type="number"
            className="v3-deposit-input"
            placeholder="0.0"
            value={deposit0}
            onChange={(e) => setDeposit0(e.target.value)}
          />
        </div>
        <div className="v3-deposit-box">
          <div className="v3-deposit-box-header">
            <span className="v3-deposit-token-name">{token1}</span>
            <span className="v3-deposit-balance">Balance: —</span>
          </div>
          <input
            type="number"
            className="v3-deposit-input"
            placeholder="0.0"
            value={deposit1}
            onChange={(e) => setDeposit1(e.target.value)}
          />
        </div>
      </div>

      <div className="v3-position-summary">
        <div className="v3-summary-row">
          <span className="v3-summary-label">Fee Tier</span>
          <span className="v3-summary-value">{selectedFee.toFixed(2)}%</span>
        </div>
        <div className="v3-summary-row">
          <span className="v3-summary-label">Price Range</span>
          <span className="v3-summary-value">
            {minPrice.toLocaleString()} — {maxPrice.toLocaleString()}
          </span>
        </div>
        <div className="v3-summary-row">
          <span className="v3-summary-label">Capital Efficiency</span>
          <span className="v3-summary-value">{efficiency === '—' ? '—' : `${efficiency}x`}</span>
        </div>
      </div>

      <button
        className="action-btn w-full"
        onClick={() => {
          if (!isConnected) {
            connectWallet();
            return;
          }
          showStatus('V3 is not available yet — V3 contracts are not deployed.', 'error');
          setDeposit0('');
          setDeposit1('');
        }}
      >
        {isConnected ? 'Add Liquidity' : 'Connect Wallet'}
      </button>
    </div>
  );
}
