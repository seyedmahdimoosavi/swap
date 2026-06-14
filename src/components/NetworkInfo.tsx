import { useState } from 'react';
import { FACTORY_ADDRESS, ROUTER_ADDRESS } from '../config/contracts';

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — ignore.
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 text-[0.7rem] text-gold-dark">
      <span>
        {label}: {address}
      </span>
      <button
        onClick={copy}
        title={copied ? 'Copied!' : `Copy ${label} address`}
        className="inline-flex items-center text-gold-dark transition-colors hover:text-gold"
      >
        {copied ? <CheckIcon className="h-3.5 w-3.5 text-in-range" /> : <CopyIcon className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export default function NetworkInfo() {
  return (
    <div className="network-info flex flex-col items-center gap-1">
      <span>DotOneSmartchain • Chain ID: 505</span>
      <AddressRow label="Factory" address={FACTORY_ADDRESS} />
      <AddressRow label="Router" address={ROUTER_ADDRESS} />
    </div>
  );
}
