import { ERC20_ABI, PAIR_ABI, ROUTER_ABI } from "../../config/abis";
import type { Pool, StatusType } from "../../types";
import { addressUrl, errorMessage, formatLocale } from "../../lib/format";

import { ROUTER_ADDRESS } from "../../config/contracts";
import { ethers } from "ethers";
import { useState } from "react";
import { useWeb3 } from "../../context/Web3Context";

// Pool forms used the global default slippage (1%) in the original.
const DEFAULT_SLIPPAGE = 1;

type OpenForm = "none" | "add" | "withdraw";
interface FormStatus {
  message: string;
  type: StatusType;
}

function PairIcons() {
  return (
    <div className="flex shrink-0 items-center">
      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]" />
      <div className="-ml-2 h-7 w-7 rounded-full bg-gradient-to-br from-[#627EEA] to-[#3C5BE0] ring-2 ring-[#383838]" />
    </div>
  );
}

function ArrowRight() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
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

function statusClass(type: StatusType) {
  if (type === "success") return "text-in-range";
  if (type === "error") return "text-danger";
  return "text-white/70";
}

function FormField({
  label,
  balance,
  onMax,
  value,
  onChange,
}: {
  label: string;
  balance: string;
  onMax: () => void;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between text-[0.78rem]">
        <span className="text-white/55">{label}</span>
        <span
          className="cursor-pointer text-white/55 hover:text-white"
          onClick={onMax}
        >
          {balance}
        </span>
      </div>
      <input
        type="number"
        placeholder="0"
        step="any"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-field px-4 py-3 text-[0.95rem] text-white outline-none"
      />
    </div>
  );
}

export default function PoolItem({
  pool,
  onRefresh,
}: {
  pool: Pool;
  onRefresh: () => void;
}) {
  const { provider, readOnlyProvider, signer, userAddress } = useWeb3();
  const [open, setOpen] = useState<OpenForm>("none");

  // --- Add liquidity form state ---
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [balance0, setBalance0] = useState("--");
  const [balance1, setBalance1] = useState("--");
  const [rawBalance0, setRawBalance0] = useState<ethers.BigNumber | null>(null);
  const [rawBalance1, setRawBalance1] = useState<ethers.BigNumber | null>(null);
  const [addStatus, setAddStatus] = useState<FormStatus | null>(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // --- Withdraw form state ---
  const [lpAmount, setLpAmount] = useState("");
  const [lpBalanceText, setLpBalanceText] = useState("LP Balance: --");
  const [rawLpBalance, setRawLpBalance] = useState<ethers.BigNumber | null>(
    null,
  );
  const [receive0, setReceive0] = useState("0");
  const [receive1, setReceive1] = useState("0");
  const [showReceive, setShowReceive] = useState(false);
  const [wStatus, setWStatus] = useState<FormStatus | null>(null);
  const [wSubmitting, setWSubmitting] = useState(false);

  const t0 = pool.token0;
  const t1 = pool.token1;

  // ---------- Toggling ----------
  const toggleAdd = async () => {
    if (open === "add") {
      setOpen("none");
      return;
    }
    setOpen("add");
    if (!signer || !userAddress) {
      setBalance0("Connect wallet");
      setBalance1("Connect wallet");
      return;
    }
    try {
      const c0 = new ethers.Contract(t0.address, ERC20_ABI, provider!);
      const c1 = new ethers.Contract(t1.address, ERC20_ABI, provider!);
      const [b0, b1] = await Promise.all([
        c0.balanceOf(userAddress),
        c1.balanceOf(userAddress),
      ]);
      setRawBalance0(b0);
      setRawBalance1(b1);
      setBalance0(
        `Balance: ${parseFloat(ethers.utils.formatUnits(b0, t0.decimals)).toFixed(4)}`,
      );
      setBalance1(
        `Balance: ${parseFloat(ethers.utils.formatUnits(b1, t1.decimals)).toFixed(4)}`,
      );
    } catch (err) {
      console.error("Failed to load pool balances:", err);
    }
  };

  const toggleWithdraw = async () => {
    if (open === "withdraw") {
      setOpen("none");
      return;
    }
    setOpen("withdraw");
    if (!signer || !userAddress) {
      setLpBalanceText("Connect wallet");
      return;
    }
    try {
      const pair = new ethers.Contract(pool.address, ERC20_ABI, provider!);
      const bal: ethers.BigNumber = await pair.balanceOf(userAddress);
      setRawLpBalance(bal);
      setLpBalanceText(
        `LP Balance: ${parseFloat(ethers.utils.formatUnits(bal, 18)).toFixed(6)}`,
      );
    } catch (err) {
      console.error("Failed to load LP balance:", err);
      setLpBalanceText("LP Balance: Error");
    }
  };

  // ---------- Add liquidity ----------
  const setMax = (index: 0 | 1) => {
    const raw = index === 0 ? rawBalance0 : rawBalance1;
    const dec = index === 0 ? t0.decimals : t1.decimals;
    if (raw) {
      const formatted = ethers.utils.formatUnits(raw, dec);
      if (index === 0) {
        setAmount0(formatted);
        calculatePoolAmounts(0, formatted, amount1);
      } else {
        setAmount1(formatted);
        calculatePoolAmounts(1, amount0, formatted);
      }
    }
  };

  const calculatePoolAmounts = async (
    changed: 0 | 1,
    a0: string,
    a1: string,
  ) => {
    try {
      const p = provider ?? readOnlyProvider;
      const pair = new ethers.Contract(pool.address, PAIR_ABI, p);
      const reserves = await pair.getReserves();
      if (reserves.reserve0.gt(0) && reserves.reserve1.gt(0)) {
        const r0 = parseFloat(
          ethers.utils.formatUnits(reserves.reserve0, t0.decimals),
        );
        const r1 = parseFloat(
          ethers.utils.formatUnits(reserves.reserve1, t1.decimals),
        );
        const ratio = r1 / r0;
        if (changed === 0 && parseFloat(a0) > 0) {
          setAmount1((parseFloat(a0) * ratio).toFixed(6));
        } else if (changed === 1 && parseFloat(a1) > 0) {
          setAmount0((parseFloat(a1) / ratio).toFixed(6));
        }
      }
    } catch (err) {
      console.error("Failed to calculate pool amounts:", err);
    }
  };

  const onAmount0 = (v: string) => {
    setAmount0(v);
    calculatePoolAmounts(0, v, amount1);
  };
  const onAmount1 = (v: string) => {
    setAmount1(v);
    calculatePoolAmounts(1, amount0, v);
  };

  const submitAdd = async () => {
    if (!signer || !userAddress) {
      setAddStatus({ message: "Please connect your wallet", type: "error" });
      return;
    }
    if (
      !amount0 ||
      !amount1 ||
      parseFloat(amount0) <= 0 ||
      parseFloat(amount1) <= 0
    ) {
      setAddStatus({ message: "Please enter valid amounts", type: "error" });
      return;
    }

    const amount0Desired = ethers.utils.parseUnits(amount0, t0.decimals);
    const amount1Desired = ethers.utils.parseUnits(amount1, t1.decimals);
    const mult = Math.floor((100 - DEFAULT_SLIPPAGE) * 100);
    const amount0Min = amount0Desired.mul(mult).div(10000);
    const amount1Min = amount1Desired.mul(mult).div(10000);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    try {
      setAddSubmitting(true);
      setAddStatus({ message: "Processing transaction...", type: "info" });

      const router = routerFromSigner(signer);
      const c0 = new ethers.Contract(t0.address, ERC20_ABI, signer);
      const c1 = new ethers.Contract(t1.address, ERC20_ABI, signer);

      await approve(c0, amount0Desired, t0.symbol, setAddStatus);
      await approve(c1, amount1Desired, t1.symbol, setAddStatus);

      setAddStatus({ message: "Adding liquidity...", type: "info" });
      const tx = await router.addLiquidity(
        t0.address,
        t1.address,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        userAddress,
        deadline,
        { gasLimit: 1000000 },
      );
      setAddStatus({ message: "Waiting for confirmation...", type: "info" });
      await tx.wait();
      setAddStatus({
        message: "Liquidity added successfully!",
        type: "success",
      });
      setAmount0("");
      setAmount1("");
      setTimeout(onRefresh, 2000);
    } catch (error) {
      setAddStatus({ message: poolError(error), type: "error" });
    } finally {
      setAddSubmitting(false);
    }
  };

  // ---------- Withdraw ----------
  const setMaxLp = () => {
    if (rawLpBalance) {
      const f = ethers.utils.formatUnits(rawLpBalance, 18);
      setLpAmount(f);
      calculateWithdrawAmounts(f);
    }
  };

  const calculateWithdrawAmounts = async (lp: string) => {
    if (!lp || parseFloat(lp) <= 0) {
      setShowReceive(false);
      return;
    }
    try {
      const p = provider ?? readOnlyProvider;
      const pair = new ethers.Contract(pool.address, PAIR_ABI, p);
      const [reserves, totalSupply] = await Promise.all([
        pair.getReserves(),
        pair.totalSupply(),
      ]);
      const lpWei = ethers.utils.parseUnits(lp, 18);
      const a0 = lpWei.mul(reserves.reserve0).div(totalSupply);
      const a1 = lpWei.mul(reserves.reserve1).div(totalSupply);
      setReceive0(
        parseFloat(ethers.utils.formatUnits(a0, t0.decimals)).toFixed(6),
      );
      setReceive1(
        parseFloat(ethers.utils.formatUnits(a1, t1.decimals)).toFixed(6),
      );
      setShowReceive(true);
    } catch (err) {
      console.error("Failed to calculate withdraw amounts:", err);
    }
  };

  const submitWithdraw = async () => {
    if (!signer || !userAddress) {
      setWStatus({ message: "Please connect your wallet", type: "error" });
      return;
    }
    if (!lpAmount || parseFloat(lpAmount) <= 0) {
      setWStatus({ message: "Please enter a valid amount", type: "error" });
      return;
    }
    let lpWei: ethers.BigNumber;
    try {
      lpWei = ethers.utils.parseUnits(lpAmount, 18);
    } catch {
      setWStatus({ message: "Invalid LP amount format", type: "error" });
      return;
    }
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    try {
      setWSubmitting(true);
      setWStatus({ message: "Processing transaction...", type: "info" });

      const router = routerFromSigner(signer);
      const pairContract = new ethers.Contract(pool.address, ERC20_ABI, signer);
      const lpBalance: ethers.BigNumber =
        await pairContract.balanceOf(userAddress);
      if (lpBalance.lt(lpWei)) {
        setWStatus({
          message: `Insufficient LP balance. You have ${parseFloat(ethers.utils.formatUnits(lpBalance, 18)).toFixed(6)}`,
          type: "error",
        });
        return;
      }

      const pair = new ethers.Contract(pool.address, PAIR_ABI, provider!);
      const [reserves, token0, totalSupply] = await Promise.all([
        pair.getReserves(),
        pair.token0(),
        pair.totalSupply(),
      ]);
      const isToken0First = token0.toLowerCase() === t0.address.toLowerCase();
      const reserveA = isToken0First ? reserves.reserve0 : reserves.reserve1;
      const reserveB = isToken0First ? reserves.reserve1 : reserves.reserve0;
      const amountA = lpWei.mul(reserveA).div(totalSupply);
      const amountB = lpWei.mul(reserveB).div(totalSupply);
      const mult = Math.floor((100 - DEFAULT_SLIPPAGE) * 100);
      const amountAMin = amountA.mul(mult).div(10000);
      const amountBMin = amountB.mul(mult).div(10000);

      const allowance = await pairContract.allowance(
        userAddress,
        ROUTER_ADDRESS,
      );
      if (allowance.lt(lpWei)) {
        if (!allowance.isZero()) {
          setWStatus({ message: "Resetting LP allowance...", type: "info" });
          await (
            await pairContract.approve(ROUTER_ADDRESS, 0, { gasLimit: 100000 })
          ).wait();
        }
        setWStatus({ message: "Approving LP tokens...", type: "info" });
        await (
          await pairContract.approve(
            ROUTER_ADDRESS,
            ethers.constants.MaxUint256,
            { gasLimit: 100000 },
          )
        ).wait();
      }

      setWStatus({ message: "Removing liquidity...", type: "info" });
      let gasEstimate = await router.estimateGas.removeLiquidity(
        t0.address,
        t1.address,
        lpWei,
        amountAMin,
        amountBMin,
        userAddress,
        deadline,
      );
      gasEstimate = gasEstimate.mul(120).div(100);

      const tx = await router.removeLiquidity(
        t0.address,
        t1.address,
        lpWei,
        amountAMin,
        amountBMin,
        userAddress,
        deadline,
        { gasLimit: gasEstimate },
      );
      setWStatus({ message: "Waiting for confirmation...", type: "info" });
      const receipt = await tx.wait();
      if (receipt.status === 0) {
        setWStatus({ message: "Transaction reverted on-chain", type: "error" });
        return;
      }
      setWStatus({
        message: "Liquidity withdrawn successfully!",
        type: "success",
      });
      setLpAmount("");
      setShowReceive(false);
      setTimeout(onRefresh, 2000);
    } catch (error) {
      setWStatus({ message: poolError(error), type: "error" });
    } finally {
      setWSubmitting(false);
    }
  };

  // ---------- Add LP token to wallet ----------
  const addLPToWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to use this feature");
      return;
    }
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts?.length) {
        alert("Please connect your wallet first.");
        return;
      }
      const wasAdded = await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: pool.address,
            symbol: "DOT1-LP-V2",
            decimals: 18,
          },
        },
      });
      if (wasAdded) alert("LP token added to wallet successfully!");
    } catch (error) {
      alert(
        "Failed to add LP token: " +
          ((error as Error).message || "Unknown error"),
      );
    }
  };

  const addDisabled =
    !(parseFloat(amount0) > 0 && parseFloat(amount1) > 0) || addSubmitting;
  const wDisabled = !(parseFloat(lpAmount) > 0) || wSubmitting;

  return (
    <div className="flex flex-col gap-3">
      {/* Pool summary box */}
      <div className="rounded-2xl bg-[#383838] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PairIcons />
            <span className="text-[0.95rem] font-semibold text-white">
              {t0.symbol}/{t1.symbol}
            </span>
          </div>
          <a
            href={addressUrl(pool.address)}
            target="_blank"
            rel="noreferrer"
            className="flex max-w-[58%] items-center gap-2 rounded-full bg-[#1c1c1c] px-4 py-2 font-mono text-[0.78rem] text-white/70 no-underline transition-colors hover:text-white"
          >
            <span className="truncate">{pool.address}</span>
            <ArrowRight />
          </a>
        </div>

        <div className="mb-4 space-y-1.5">
          <div className="flex items-center justify-between text-[0.9rem] text-white">
            <span>{t0.symbol}</span>
            <span>{formatLocale(pool.reserve0, t0.decimals)}</span>
          </div>
          <div className="flex items-center justify-between text-[0.9rem] text-white">
            <span>{t1.symbol}</span>
            <span>{formatLocale(pool.reserve1, t1.decimals)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[0.85rem] text-white/55">
            Total LP Supply: {formatLocale(pool.totalSupply, 18)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={toggleAdd}
              className={`rounded-lg px-4 py-2 text-[0.82rem] font-semibold transition-colors ${
                open === "add"
                  ? "bg-[#161616] text-white"
                  : "bg-gold text-black hover:bg-gold-light"
              }`}
            >
              + Add liquidity
            </button>
            <button
              onClick={toggleWithdraw}
              className={`rounded-lg px-4 py-2 text-[0.82rem] font-semibold transition-colors ${
                open === "withdraw"
                  ? "bg-[#161616] text-white"
                  : "bg-gold text-black hover:bg-gold-light"
              }`}
            >
              {"\u2212 Withdraw"}
            </button>
          </div>
        </div>
      </div>

      {open === "add" && (
        <div className="rounded-2xl bg-[#2a2a2a] p-5">
          <div className="mb-4 text-[0.95rem] font-semibold text-white">
            Add Liquidity to {t0.symbol}/{t1.symbol}
          </div>
          <FormField
            label={`${t0.symbol} Amount`}
            balance={balance0}
            onMax={() => setMax(0)}
            value={amount0}
            onChange={onAmount0}
          />
          <FormField
            label={`${t1.symbol} Amount`}
            balance={balance1}
            onMax={() => setMax(1)}
            value={amount1}
            onChange={onAmount1}
          />
          {addStatus && (
            <div
              className={`mb-3 text-[0.8rem] ${statusClass(addStatus.type)}`}
            >
              {addStatus.message}
            </div>
          )}
          <button
            onClick={submitAdd}
            disabled={addDisabled}
            className="w-full rounded-lg bg-gold py-3 text-[0.9rem] font-bold text-black transition-colors hover:bg-gold-light disabled:opacity-45"
          >
            {addSubmitting
              ? "Processing..."
              : parseFloat(amount0) > 0 && parseFloat(amount1) > 0
                ? "Add liquidity"
                : "Submit"}
          </button>
        </div>
      )}

      {open === "withdraw" && (
        <div className="rounded-2xl bg-[#2a2a2a] p-5">
          <div className="mb-4 text-[0.95rem] font-semibold text-white">
            Withdraw from {t0.symbol}/{t1.symbol}
          </div>
          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between text-[0.78rem]">
              <span className="text-white/55">LP Token Amount</span>
              <span
                className="cursor-pointer text-white/55 hover:text-white"
                onClick={setMaxLp}
              >
                {lpBalanceText}
              </span>
            </div>
            <input
              type="number"
              placeholder="0"
              step="any"
              min="0"
              value={lpAmount}
              onChange={(e) => {
                setLpAmount(e.target.value);
                calculateWithdrawAmounts(e.target.value);
              }}
              className="w-full rounded-lg bg-field px-4 py-3 text-[0.95rem] text-white outline-none"
            />
          </div>
          {showReceive && (
            <div className="mb-3 rounded-lg bg-[#1f1f1f] p-4">
              <div className="mb-2 text-[0.78rem] text-white/55">
                You will receive:
              </div>
              <div className="flex justify-between text-[0.85rem] text-white">
                <span>{t0.symbol}</span>
                <span>{receive0}</span>
              </div>
              <div className="flex justify-between text-[0.85rem] text-white">
                <span>{t1.symbol}</span>
                <span>{receive1}</span>
              </div>
            </div>
          )}
          {wStatus && (
            <div className={`mb-3 text-[0.8rem] ${statusClass(wStatus.type)}`}>
              {wStatus.message}
            </div>
          )}
          <button
            onClick={submitWithdraw}
            disabled={wDisabled}
            className="w-full rounded-lg bg-gold py-3 text-[0.9rem] font-bold text-black transition-colors hover:bg-gold-light disabled:opacity-45"
          >
            {wSubmitting
              ? "Processing..."
              : parseFloat(lpAmount) > 0
                ? "Withdraw"
                : "Enter amount"}
          </button>
        </div>
      )}
    </div>
  );
}

// --- helpers local to pool forms ---
function routerFromSigner(signer: ethers.Signer) {
  return new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
}

async function approve(
  token: ethers.Contract,
  desired: ethers.BigNumber,
  symbol: string,
  setStatus: (s: FormStatus) => void,
) {
  const owner = await token.signer.getAddress();
  const allowance = await token.allowance(owner, ROUTER_ADDRESS);
  if (allowance.lt(desired)) {
    if (!allowance.isZero()) {
      setStatus({ message: `Resetting ${symbol} allowance...`, type: "info" });
      await (
        await token.approve(ROUTER_ADDRESS, 0, { gasLimit: 100000 })
      ).wait();
    }
    setStatus({ message: `Approving ${symbol}...`, type: "info" });
    await (
      await token.approve(ROUTER_ADDRESS, desired, { gasLimit: 100000 })
    ).wait();
  }
}

function poolError(error: unknown): string {
  return errorMessage(error);
}
