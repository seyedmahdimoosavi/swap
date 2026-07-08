import ConnectWalletButton from "../../components/ConnectWalletButton";
import { useTokenList } from "../../context/TokenListContext";
import { addressUrl, formatLocale } from "../../lib/format";
import { ethers } from "ethers";
import { ERC20_ABI } from "../../config/abis";
import { useEffect, useState } from "react";
import { useStatus } from "../../context/StatusContext";
import { useWeb3 } from "../../context/Web3Context";
import { getTokenInfoWithProvider } from "../../lib/tokens";
import type { TokenInfo } from "../../types";

function TokenCircle() {
  return (
    <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-[#9945FF] via-[#14F195] to-[#00D1FF]" />
  );
}

function ArrowRight() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function Tokens() {
  const { showStatus } = useStatus();
  const { readOnlyProvider, userAddress } = useWeb3();
  const { tokens } = useTokenList();
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  // Connected wallet's balance per token, read from RPC.
  const [balances, setBalances] = useState<
    Record<string, { text: string; held: boolean }>
  >({});

  // Read the connected wallet's balance for each listed token (from RPC).
  useEffect(() => {
    if (!userAddress || tokens.length === 0) {
      setBalances({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        tokens.map(async (t) => {
          try {
            const c = new ethers.Contract(t.address, ERC20_ABI, readOnlyProvider);
            const bal = await c.balanceOf(userAddress);
            return [
              t.address,
              { text: formatLocale(bal, t.decimals), held: !bal.isZero() },
            ] as const;
          } catch {
            return [t.address, { text: "0", held: false }] as const;
          }
        }),
      );
      if (!cancelled) setBalances(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [tokens, userAddress, readOnlyProvider]);

  const addTokenToWallet = async (
    address: string,
    symbol: string,
    decimals: number,
  ) => {
    if (typeof window.ethereum === "undefined") {
      showStatus("Please install MetaMask to add tokens", "error");
      return;
    }
    try {
      setAdding(address);
      const wasAdded = await window.ethereum.request({
        method: "wallet_watchAsset",
        params: { type: "ERC20", options: { address, symbol, decimals } },
      });
      if (wasAdded) {
        setAdded((a) => ({ ...a, [address]: true }));
        showStatus(`${symbol} added to wallet successfully!`, "success");
      } else {
        showStatus("Token addition was cancelled", "info");
      }
    } catch (error) {
      showStatus((error as Error).message || "Failed to add token", "error");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div id="addTokenSection">
      <div className="card">
        <div className="mb-5 flex items-center justify-between">
          <div className="section-title mb-0 text-left">
            Add Tokens to Wallet
          </div>
          <ConnectWalletButton />
        </div>

        <div className="flex flex-col gap-4">
          {tokens.map((token) => {
            const address = token.address;
            const isAdded = added[address];
            const isAdding = adding === address;
            const bal = balances[address];
            const held = bal?.held ?? false;
            return (
              <div key={address} className="rounded-2xl bg-[#333333] p-5">
                {/* Row 1: identity + full name */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TokenCircle />
                    <span className="text-[0.95rem] font-semibold text-white">
                      {token.symbol}
                    </span>
                    <span className="text-[0.85rem] text-white/45">ERC-20</span>
                  </div>
                  <span className="text-[0.9rem] font-semibold text-white">
                    {token.name}
                  </span>
                </div>

                {/* Row 2: address pill + action */}
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={addressUrl(address)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 h-9 rounded-lg bg-[#1c1c1c] px-3 py-2.5 font-mono text-[0.8rem] text-white/70 no-underline transition-colors hover:text-white"
                  >
                    <span className="truncate">{address}</span>
                    <ArrowRight />
                  </a>
                  {held ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-in-range/40 bg-in-range/10 px-4 py-2.5 text-[0.85rem] font-semibold text-in-range">
                      ✓ Balance: {bal?.text}
                    </span>
                  ) : isAdded ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-in-range/40 bg-in-range/10 px-4 py-2.5 text-[0.85rem] font-semibold text-in-range">
                      ✓ Added
                    </span>
                  ) : (
                    <button
                      onClick={() =>
                        addTokenToWallet(address, token.symbol, token.decimals)
                      }
                      disabled={isAdding}
                      className="shrink-0 rounded-lg bg-gold h-9 px-3 border-none py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-light disabled:opacity-60"
                    >
                      {isAdding ? "Adding..." : "+ Add to wallet"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
