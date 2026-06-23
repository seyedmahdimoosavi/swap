import { useState } from 'react';
import Swap from './Swap';
import Liquidity from './Liquidity';
import WDoto from './WDoto';
import Pools from './Pools';
import Tokens from './Tokens';
import type { V2Tab } from '../../types';

const TABS: { id: V2Tab; label: string }[] = [
  { id: 'swap', label: 'Swap' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'wdoto', label: 'WDOTO' },
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
        {tab === 'swap' && <Swap />}
      </div>
      <div className={tab === 'liquidity' ? 'tab-content' : 'hidden'}>
        {tab === 'liquidity' && <Liquidity />}
      </div>
      <div className={tab === 'wdoto' ? 'tab-content' : 'hidden'}>
        {tab === 'wdoto' && <WDoto />}
      </div>
      <div className={tab === 'pools' ? 'tab-content' : 'hidden'}>
        {/* Each tab mounts on open so it re-reads from RPC, like switchTab() in the original. */}
        {tab === 'pools' && <Pools />}
      </div>
      <div className={tab === 'addToken' ? 'tab-content' : 'hidden'}>
        {tab === 'addToken' && <Tokens />}
      </div>
    </>
  );
}
