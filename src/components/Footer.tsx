import { useState } from "react";

/* --- inline social icons (stroke = currentColor) --- */
const icon = "h-5 w-5 text-white hover:text-[#F5BC27]";
function MailIcon() {
  return (
    <svg
      className={icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg
      className={icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg className={icon} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25h6.83l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg
      className={icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg
      className={icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.5" y2="6.5" />
    </svg>
  );
}

const PLATFORM_COL = ["Platform", "Swap", "Bridge", "Network", "Community"];
const RESOURCES_COL = [
  "Resources",
  "Whitepaper",
  "Gitbook",
  "Roadmap",
  "Audit report",
  "Github",
  "Developer",
  "Document",
  "bug bounty",
];

function LinkColumn({ items }: { items: string[] }) {
  return (
    <ul className="flex list-none flex-col gap-3 text-[0.9rem]">
      {items.map((label) => (
        <li key={label}>
          <a
            href="#"
            className="text-white no-underline transition-opacity hover:opacity-70"
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function Footer() {
  const [email, setEmail] = useState("");

  return (
    <footer className="mt-[140px] w-full px-6 pb-10 lg:px-[108px]">
      <div className="flex flex-col justify-between gap-12 lg:flex-row">
        {/* Brand + signup + socials */}
        <div className="max-w-md">
          <div className="mb-5 h-20 w-20 rounded-full bg-[#cfcfcf]" />
          <h3 className="mb-3 text-[1.05rem] font-bold text-white">
            Power by Smart Chain
          </h3>
          <p className="text-[0.85rem] leading-relaxed text-white/60">
            adipiscing elit, sed do eiusmod tempor incididunt ut labore et
            dolore magna aliqua Egestas purus viverra accumsan in nisl nisi Arcu
            cursus vitae.
          </p>

          <div className="mt-6 flex max-w-sm items-center rounded-full bg-field p-1">
            <button className="rounded-full border-0 bg-gold px-5 py-2 text-[0.8rem] font-bold text-black">
              Email
            </button>
            <input
              type="email"
              placeholder="oil@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-0 bg-transparent px-4 text-[0.85rem] text-white outline-none placeholder:text-white/50"
            />
          </div>

          {/* social row sits 35px below the email box */}
          <div className="mt-[35px] flex items-center gap-5 text-white">
            <a href="#" aria-label="Email" className="hover:opacity-70">
              <MailIcon />
            </a>
            <a href="#" aria-label="Phone" className="hover:opacity-70">
              <PhoneIcon />
            </a>
            <a href="#" aria-label="X" className="hover:opacity-70">
              <XIcon />
            </a>
            <a href="#" aria-label="LinkedIn" className="hover:opacity-70">
              <LinkedInIcon />
            </a>
            <a href="#" aria-label="Instagram" className="hover:opacity-70">
              <InstagramIcon />
            </a>
          </div>
        </div>

        {/* Link columns */}
        <div className="flex gap-16 lg:gap-24">
          <LinkColumn items={PLATFORM_COL} />
          <LinkColumn items={RESOURCES_COL} />
        </div>
      </div>

      <hr className="my-8 border-white/10" />

      <div className="flex gap-2 text-[0.85rem]">
        <span className="text-white/80">Lorem ipsum</span>
        <span className="text-white/30">|</span>
        <a href="#" className="text-white no-underline hover:opacity-70">
          Lorem ipsum
        </a>
      </div>
    </footer>
  );
}
