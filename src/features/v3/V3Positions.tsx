import { useEffect, useRef } from 'react';
import ConnectWalletButton from '../../components/ConnectWalletButton';

interface MiniChartProps {
  min: number;
  max: number;
  current: number;
}

/** Small range chart drawn on a canvas. Ported from v3DrawMiniCharts(). */
function MiniChart({ min, max, current }: MiniChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const range = max - min;
    const extMin = min - range * 0.3;
    const extMax = max + range * 0.3;
    const totalRange = extMax - extMin;

    // Range area
    const rangeLeft = ((min - extMin) / totalRange) * width;
    const rangeRight = ((max - extMin) / totalRange) * width;
    ctx.fillStyle = 'rgba(255,215,0,0.08)';
    ctx.fillRect(rangeLeft, 0, rangeRight - rangeLeft, height);

    // Bars
    const numBars = 40;
    const barW = width / numBars;
    for (let i = 0; i < numBars; i++) {
      const price = extMin + (totalRange / numBars) * i;
      const dist = Math.abs(price - (min + max) / 2) / (range / 2);
      const h = Math.max(2, Math.exp(-dist * dist) * height * 0.7 + Math.random() * 3);
      const inRange = price >= min && price <= max;
      ctx.fillStyle = inRange ? 'rgba(255,215,0,0.5)' : 'rgba(255,215,0,0.12)';
      ctx.fillRect(i * barW, height - h, barW - 1, h);
    }

    // Current price line
    const cpx = ((current - extMin) / totalRange) * width;
    ctx.strokeStyle = current >= min && current <= max ? '#00ff64' : '#ff6400';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cpx, 0);
    ctx.lineTo(cpx, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [min, max, current]);

  return (
    <div className="v3-position-mini-chart">
      <canvas ref={canvasRef} className="v3-mini-chart" />
    </div>
  );
}

export default function V3Positions() {
  return (
    <div className="v3-card">
      <div className="flex items-center justify-between mb-[18px]">
        <div className="v3-card-title mb-0">YOUR POSITIONS</div>
        <ConnectWalletButton />
      </div>

      <div className="v3-positions-section">
        {/* Sample Position 1 */}
        <div className="v3-position-card">
          <div className="v3-position-header">
            <span className="v3-position-pair">T1 / T2</span>
            <span className="v3-position-id">#12847</span>
          </div>
          <div className="v3-position-range">
            <div className="v3-range-badge">
              <div className="v3-range-label">MIN</div>
              <div className="v3-range-value">1,500</div>
            </div>
            <div className="v3-range-badge">
              <div className="v3-range-label">CURRENT</div>
              <div className="v3-range-value text-in-range">
                1,850
              </div>
            </div>
            <div className="v3-range-badge">
              <div className="v3-range-label">MAX</div>
              <div className="v3-range-value">2,200</div>
            </div>
          </div>
          <div className="mb-2.5">
            <span className="v3-position-status v3-status-in-range">● IN RANGE</span>
          </div>
          <MiniChart min={1500} max={2200} current={1850} />
          <div className="v3-position-stats">
            <div className="v3-position-stat">
              <div className="v3-stat-label">LIQUIDITY</div>
              <div className="v3-stat-value">$4,250</div>
            </div>
            <div className="v3-position-stat">
              <div className="v3-stat-label">FEE TIER</div>
              <div className="v3-stat-value">0.30%</div>
            </div>
            <div className="v3-position-stat">
              <div className="v3-stat-label">EARNED</div>
              <div className="v3-stat-value text-in-range">
                $12.40
              </div>
            </div>
          </div>
        </div>

        {/* Sample Position 2 */}
        <div className="v3-position-card">
          <div className="v3-position-header">
            <span className="v3-position-pair">T1 / T2</span>
            <span className="v3-position-id">#12903</span>
          </div>
          <div className="v3-position-range">
            <div className="v3-range-badge">
              <div className="v3-range-label">MIN</div>
              <div className="v3-range-value">0.80</div>
            </div>
            <div className="v3-range-badge">
              <div className="v3-range-label">CURRENT</div>
              <div className="v3-range-value text-out-range">
                1.45
              </div>
            </div>
            <div className="v3-range-badge">
              <div className="v3-range-label">MAX</div>
              <div className="v3-range-value">1.20</div>
            </div>
          </div>
          <div className="mb-2.5">
            <span className="v3-position-status v3-status-out-range">● OUT OF RANGE</span>
          </div>
          <MiniChart min={0.8} max={1.2} current={1.45} />
          <div className="v3-position-stats">
            <div className="v3-position-stat">
              <div className="v3-stat-label">LIQUIDITY</div>
              <div className="v3-stat-value">$890</div>
            </div>
            <div className="v3-position-stat">
              <div className="v3-stat-label">FEE TIER</div>
              <div className="v3-stat-value">0.05%</div>
            </div>
            <div className="v3-position-stat">
              <div className="v3-stat-label">EARNED</div>
              <div className="v3-stat-value text-in-range">
                $3.15
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-4 text-[0.7rem] text-gold-dark">
        Connect wallet to view your positions
      </div>
    </div>
  );
}
