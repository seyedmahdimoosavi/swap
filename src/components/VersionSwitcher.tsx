import type { Version } from '../types';

interface Props {
  version: Version;
  onChange: (v: Version) => void;
}

export default function VersionSwitcher({ version, onChange }: Props) {
  return (
    <div className="version-switcher">
      <button
        className={`version-btn ${version === 'v2' ? 'active' : 'inactive'}`}
        id="v2Btn"
        onClick={() => onChange('v2')}
      >
        V2 <span className="version-badge">LIVE</span>
      </button>
      <button
        className={`version-btn ${version === 'v3' ? 'active' : 'inactive'}`}
        id="v3Btn"
        onClick={() => onChange('v3')}
      >
        V3 <span className="version-badge v3-badge-new">NEW</span>
      </button>
    </div>
  );
}
