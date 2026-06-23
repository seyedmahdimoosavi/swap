import { useState } from 'react';
import V3Swap from './V3Swap';
import V3Liquidity from './V3Liquidity';
import V3Positions from './V3Positions';
import type { V3Tab } from '../../types';

export default function V3Section() {
  const [tab, setTab] = useState<V3Tab>('v3swap');

  return (
    <div className="v3-container">
      <div className="v3-tabs">
        <button className={`v3-tab${tab === 'v3swap' ? ' active' : ''}`} onClick={() => setTab('v3swap')}>
          Swap
        </button>
        <button className={`v3-tab${tab === 'v3liquidity' ? ' active' : ''}`} onClick={() => setTab('v3liquidity')}>
          Liquidity
        </button>
        <button className={`v3-tab${tab === 'v3positions' ? ' active' : ''}`} onClick={() => setTab('v3positions')}>
          Positions
        </button>
      </div>

      <div style={{ display: tab === 'v3swap' ? 'block' : 'none' }}>
        <V3Swap />
      </div>
      <div style={{ display: tab === 'v3liquidity' ? 'block' : 'none' }}>
        {/* Mount only when active so the canvas sizes correctly. */}
        {tab === 'v3liquidity' && <V3Liquidity />}
      </div>
      <div style={{ display: tab === 'v3positions' ? 'block' : 'none' }}>
        {tab === 'v3positions' && <V3Positions />}
      </div>
    </div>
  );
}
