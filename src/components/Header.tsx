import Logo from "../assets/doto.png";
import { useState } from "react";

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

const NAV_LINKS = ["Community", "platform", "Resources"];

export default function Header() {
  const [search, setSearch] = useState("");

  return (
    <header className="w-full flex items-center justify-between gap-8 px-6 lg:px-[108px] py-6">
      <div className="flex items-center gap-8 shrink-0">
        {/* Logo placeholder (gray circle as in the design) */}
        <img src={Logo} className="h-11 w-11 rounded-full " alt="logo" />
        <nav className="flex items-center gap-7 text-[0.95rem] text-white">
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-white no-underline hover:text-gold"
            >
              {link}
            </a>
          ))}
        </nav>
      </div>

      <div className="flex w-full max-w-[620px] items-center gap-3 rounded-full bg-[#2a2a2a] px-4 py-3">
        <SearchIcon className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border-0 bg-transparent text-[0.95rem] text-white outline-none placeholder:text-gray-400"
        />
      </div>
    </header>
  );
}
