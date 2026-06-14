import { useState } from 'react';
import Swap from './Swap';
import Liquidity from './Liquidity';
import Pools from './Pools';
import Tokens from './Tokens';
import type { V2Tab } from '../../types';

const TABS: { id: V2Tab; label: string }[] = [
  { id: 'swap', label: 'Swap' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'pools', label: 'Pools' },
  { id: 'addToken', label: 'Tokens' },
];

export default function V2Section() {
  const [tab, setTab] = useState<V2Tab>('swap');

  return (
    <>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            data-tab={t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === 'swap' ? 'tab-content' : 'hidden'}>
        <Swap />
      </div>
      <div className={tab === 'liquidity' ? 'tab-content' : 'hidden'}>
        <Liquidity />
      </div>
      <div className={tab === 'pools' ? 'tab-content' : 'hidden'}>
        {/* Pools loads on mount; remount each time the tab is opened. */}
        {tab === 'pools' && <Pools />}
      </div>
      <div className={tab === 'addToken' ? 'tab-content' : 'hidden'}>
        <Tokens />
      </div>
    </>
  );
}
