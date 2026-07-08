import {
  EXPLORER_BASE,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  TICK_SPACING,
  V3_FACTORY_ABI_EX,
  V3_POOL_ABI,
  V3_POSITION_MANAGER,
  V3_POSITION_MANAGER_ABI,
} from "../../config/v3";
import {
  generateLiquidityData,
  getV3Factory,
  getV3Pool,
  getV3TokenInfo,
  v3CheckBalance,
  v3ComputeSqrtPriceX96,
  v3FeeToPercent,
  v3GetErrorMessage,
  v3NearestUsableTick,
  v3PriceToTick,
  v3SafeParseUnits,
  v3SqrtPriceToPrice,
} from "../../lib/v3";
import { useTokenList } from "../../context/TokenListContext";
import { useCallback, useEffect, useRef, useState } from "react";

import ConnectWalletButton from "../../components/ConnectWalletButton";
import { ERC20_ABI } from "../../config/abis";
import { ethers } from "ethers";
import { useStatus } from "../../context/StatusContext";
import { useWeb3 } from "../../context/Web3Context";

const FEE_TIERS = [
  { fee: 100, label: "0.01%", desc: "Stables", pct: "—" },
  { fee: 500, label: "0.05%", desc: "Low vol", pct: "—" },
  { fee: 3000, label: "0.30%", desc: "Medium", pct: "Most Used" },
  { fee: 10000, label: "1.00%", desc: "Exotic", pct: "—" },
];

interface TxStatus {
  html: string;
  type: "" | "pending" | "success" | "error";
}

function txLink(hash: string) {
  return `<a href="${EXPLORER_BASE}/tx/${hash}" target="_blank" class="v3-tx-link">🔗 View Transaction ↗</a>`;
}

export default function V3Liquidity() {
  const {
    readOnlyProvider,
    provider,
    signer,
    userAddress,
    isConnected,
    connectWallet,
  } = useWeb3();
  const { showStatus } = useStatus();
  const reads = provider ?? readOnlyProvider;

  const tokens = useTokenList().tokens;
  const [t0Sel, setT0Sel] = useState("");
  const [t1Sel, setT1Sel] = useState("");
  const [feeTier, setFeeTier] = useState(3000);
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("0");
  const [deposit0, setDeposit0] = useState("");
  const [deposit1, setDeposit1] = useState("");
  const [bal0, setBal0] = useState("Balance: —");
  const [bal1, setBal1] = useState("Balance: —");
  const [priceDisplay, setPriceDisplay] = useState("—");
  const [tx, setTx] = useState<TxStatus>({ html: "", type: "" });
  const [adding, setAdding] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState(20);

  // Default the pair selects to the first two discovered tokens once loaded.
  useEffect(() => {
    if (tokens.length === 0) return;
    setT0Sel((prev) => prev || tokens[0].address);
    setT1Sel((prev) => prev || tokens[1]?.address || tokens[0].address);
  }, [tokens]);

  // Live pool state (refs so the chart effect can read latest without re-subscribing)
  const poolAddrRef = useRef<string | null>(null);
  const currentPriceRef = useRef(0);
  const [, force] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const minAxisRef = useRef<HTMLSpanElement>(null);
  const maxAxisRef = useRef<HTMLSpanElement>(null);

  const t0Info = getV3TokenInfo(t0Sel);
  const t1Info = getV3TokenInfo(t1Sel);
  const sorted = t0Sel.toLowerCase() < t1Sel.toLowerCase();

  const displayPrice = () => {
    const cp = currentPriceRef.current;
    return sorted ? cp : cp > 0 ? 1 / cp : 0;
  };

  // ===== summary =====
  const minP = parseFloat(minPrice) || 0;
  const maxP = parseFloat(maxPrice) || 0;
  const summaryRange = `${minP.toFixed(4)} — ${maxP.toFixed(4)}`;
  let summaryEfficiency = "—";
  {
    const dp = sorted
      ? currentPriceRef.current
      : currentPriceRef.current > 0
        ? 1 / currentPriceRef.current
        : 0;
    if (minP > 0 && maxP > minP && dp > 0)
      summaryEfficiency =
        Math.max(1, (dp * 2) / (maxP - minP)).toFixed(1) + "x";
  }

  // ===== chart =====
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const container = canvas.parentElement;
    if (!ctx || !container) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    const width = container.clientWidth;
    const height = container.clientHeight;
    ctx.clearRect(0, 0, width, height);

    const dp = displayPrice();
    const data = generateLiquidityData(dp || 1);
    if (data.length === 0) return;

    const maxLiq = Math.max(...data.map((d) => d.liquidity));
    const barWidth = (width - 20) / data.length;
    const chartHeight = height - 25;
    const cMin = data[0].price;
    const cMax = data[data.length - 1].price;
    const minRange = parseFloat(minPrice) || 0;
    const maxRange = parseFloat(maxPrice) || 0;

    data.forEach((d, i) => {
      const x = 10 + i * barWidth;
      const barH = (d.liquidity / maxLiq) * chartHeight * 0.85;
      const y = chartHeight - barH;
      const inRange = d.price >= minRange && d.price <= maxRange;
      if (inRange) {
        const g = ctx.createLinearGradient(x, y, x, chartHeight);
        g.addColorStop(0, "rgba(255,215,0,0.7)");
        g.addColorStop(1, "rgba(255,215,0,0.15)");
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = "rgba(255,215,0,0.12)";
      }
      ctx.beginPath();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((ctx as any).roundRect)
        (ctx as any).roundRect(
          x,
          y,
          Math.max(barWidth - 1, 1),
          barH,
          [2, 2, 0, 0],
        );
      else ctx.rect(x, y, Math.max(barWidth - 1, 1), barH);
      ctx.fill();
    });

    if (dp > 0 && cMax > cMin && lineRef.current) {
      const cx = 10 + ((dp - cMin) / (cMax - cMin)) * (width - 20);
      lineRef.current.style.left = (cx / width) * 100 + "%";
    }
    if (overlayRef.current && cMax > cMin) {
      const leftPct = ((minRange - cMin) / (cMax - cMin)) * 100;
      const rightPct = ((maxRange - cMin) / (cMax - cMin)) * 100;
      overlayRef.current.style.left = Math.max(0, leftPct) + "%";
      overlayRef.current.style.width = Math.min(100, rightPct - leftPct) + "%";
    }
    if (minAxisRef.current) minAxisRef.current.textContent = cMin.toFixed(2);
    if (maxAxisRef.current) maxAxisRef.current.textContent = cMax.toFixed(2);
  }, [minPrice, maxPrice, sorted]);

  // ===== load pool info + balances =====
  const updateLiquidity = useCallback(async () => {
    if (!t0Sel || !t1Sel) return;
    const i0 = getV3TokenInfo(t0Sel);
    const i1 = getV3TokenInfo(t1Sel);
    const isSorted = t0Sel.toLowerCase() < t1Sel.toLowerCase();
    const token0 = isSorted ? t0Sel : t1Sel;
    const token1 = isSorted ? t1Sel : t0Sel;
    const info0 = isSorted ? i0 : i1;
    const info1 = isSorted ? i1 : i0;

    try {
      const poolAddr = await getV3Pool(reads, token0, token1, feeTier);
      if (poolAddr && poolAddr !== ethers.constants.AddressZero) {
        poolAddrRef.current = poolAddr;
        const pool = new ethers.Contract(poolAddr, V3_POOL_ABI, reads);
        const slot0 = await pool.slot0();
        currentPriceRef.current = v3SqrtPriceToPrice(
          slot0.sqrtPriceX96,
          info0.decimals,
          info1.decimals,
        );
        const dp = isSorted
          ? currentPriceRef.current
          : 1 / currentPriceRef.current;
        setPriceDisplay(`1 ${i0.symbol} = ${dp.toFixed(6)} ${i1.symbol}`);
        setMinPrice((prev) =>
          parseFloat(prev) === 0 ? (dp * 0.8).toFixed(6) : prev,
        );
        setMaxPrice((prev) =>
          parseFloat(prev) === 0 ? (dp * 1.2).toFixed(6) : prev,
        );
      } else {
        poolAddrRef.current = null;
        currentPriceRef.current = 0;
        setPriceDisplay("Pool not found — will create on mint");
      }
    } catch (e) {
      console.warn("v3UpdateLiquidity pool check:", e);
      poolAddrRef.current = null;
      setPriceDisplay("Pool not found");
    }

    if (userAddress && provider) {
      try {
        const c0 = new ethers.Contract(t0Sel, ERC20_ABI, provider);
        const c1 = new ethers.Contract(t1Sel, ERC20_ABI, provider);
        const [b0, b1] = await Promise.all([
          c0.balanceOf(userAddress),
          c1.balanceOf(userAddress),
        ]);
        setBal0(
          "Balance: " +
            parseFloat(ethers.utils.formatUnits(b0, i0.decimals)).toFixed(4),
        );
        setBal1(
          "Balance: " +
            parseFloat(ethers.utils.formatUnits(b1, i1.decimals)).toFixed(4),
        );
      } catch {
        /* ignore */
      }
    }
    force((n) => n + 1);
    drawChart();
  }, [t0Sel, t1Sel, feeTier, userAddress, provider, reads, drawChart]);

  useEffect(() => {
    updateLiquidity();
  }, [updateLiquidity]);

  useEffect(() => {
    drawChart();
  }, [drawChart, minPrice, maxPrice]);

  // ===== handlers =====
  const adjustPrice = (type: "min" | "max", dir: number) => {
    const cur = parseFloat(type === "min" ? minPrice : maxPrice) || 0;
    const step = Math.max(cur * 0.01, 0.000001);
    const next = Math.max(0, cur + dir * step).toFixed(6);
    if (type === "min") setMinPrice(next);
    else setMaxPrice(next);
  };

  const setRangePreset = (pct: number) => {
    setActivePreset(pct);
    const dp = displayPrice();
    if (dp <= 0) return;
    if (pct === 100) {
      setMinPrice("0.000001");
      setMaxPrice((dp * 100).toFixed(6));
    } else {
      setMinPrice((dp * (1 - pct / 100)).toFixed(6));
      setMaxPrice((dp * (1 + pct / 100)).toFixed(6));
    }
  };

  const maxDeposit = (idx: 0 | 1) => {
    const m = (idx === 0 ? bal0 : bal1).match(/Balance:\s*([\d.]+)/);
    if (m) (idx === 0 ? setDeposit0 : setDeposit1)(m[1]);
  };

  async function addNFTToWallet(tokenId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = (window as any).ethereum;
    if (!eth) {
      showStatus("MetaMask not found", "error");
      return;
    }
    try {
      await eth.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC721",
          options: {
            address: V3_POSITION_MANAGER,
            tokenId: tokenId.toString(),
          },
        },
      });
      showStatus("NFT #" + tokenId + " added to wallet!", "success");
    } catch (e) {
      showStatus(
        "Failed to add NFT to wallet: " + ((e as Error).message || ""),
        "error",
      );
    }
  }

  async function addLiquidity() {
    if (!signer || !userAddress) {
      showStatus("Please connect your wallet first", "error");
      return;
    }
    const amt0 = parseFloat(deposit0);
    const amt1 = parseFloat(deposit1);
    if ((!amt0 || amt0 <= 0) && (!amt1 || amt1 <= 0)) {
      showStatus("Enter deposit amounts", "error");
      return;
    }
    const i0 = getV3TokenInfo(t0Sel);
    const i1 = getV3TokenInfo(t1Sel);
    const isSorted = t0Sel.toLowerCase() < t1Sel.toLowerCase();
    const token0 = isSorted ? t0Sel : t1Sel;
    const token1 = isSorted ? t1Sel : t0Sel;
    const info0 = isSorted ? i0 : i1;
    const info1 = isSorted ? i1 : i0;
    const dep0 = isSorted ? amt0 || 0 : amt1 || 0;
    const dep1 = isSorted ? amt1 || 0 : amt0 || 0;
    const amount0Desired =
      dep0 > 0
        ? v3SafeParseUnits(dep0, info0.decimals)
        : ethers.BigNumber.from(0);
    const amount1Desired =
      dep1 > 0
        ? v3SafeParseUnits(dep1, info1.decimals)
        : ethers.BigNumber.from(0);

    const mp = parseFloat(minPrice);
    const xp = parseFloat(maxPrice);
    if (!mp || !xp || xp <= mp) {
      showStatus("Invalid price range", "error");
      return;
    }
    const priceLower = isSorted ? mp : 1 / xp;
    const priceUpper = isSorted ? xp : 1 / mp;
    let tickLower = v3PriceToTick(priceLower, info0.decimals, info1.decimals);
    let tickUpper = v3PriceToTick(priceUpper, info0.decimals, info1.decimals);
    const tickSpacing = TICK_SPACING[feeTier] || 60;
    tickLower = v3NearestUsableTick(tickLower, tickSpacing);
    tickUpper = v3NearestUsableTick(tickUpper, tickSpacing);
    if (tickLower >= tickUpper) {
      showStatus(
        "Invalid tick range. Please adjust your price range.",
        "error",
      );
      return;
    }

    setAdding(true);
    setMintedTokenId(null);
    setTx({
      html: '<span class="v3-spinner"></span> Preparing...',
      type: "pending",
    });
    try {
      const posManager = new ethers.Contract(
        V3_POSITION_MANAGER,
        V3_POSITION_MANAGER_ABI,
        signer,
      );

      if (amount0Desired.gt(0)) {
        const chk = await v3CheckBalance(
          reads,
          userAddress,
          token0,
          amount0Desired,
        );
        if (!chk.sufficient) {
          setTx({ html: `❌ ${chk.error}`, type: "error" });
          return;
        }
      }
      if (amount1Desired.gt(0)) {
        const chk = await v3CheckBalance(
          reads,
          userAddress,
          token1,
          amount1Desired,
        );
        if (!chk.sufficient) {
          setTx({ html: `❌ ${chk.error}`, type: "error" });
          return;
        }
      }

      if (!poolAddrRef.current) {
        setTx({
          html: '<span class="v3-spinner"></span> Creating pool...',
          type: "pending",
        });
        const initPrice =
          priceLower * priceUpper > 0 ? Math.sqrt(priceLower * priceUpper) : 1;
        const sqrtPriceX96 = v3ComputeSqrtPriceX96(initPrice);
        if (
          sqrtPriceX96.lte(ethers.BigNumber.from(MIN_SQRT_RATIO)) ||
          sqrtPriceX96.gte(ethers.BigNumber.from(MAX_SQRT_RATIO))
        ) {
          setTx({
            html: "❌ Computed initial price is out of range. Please adjust the price range.",
            type: "error",
          });
          return;
        }
        const createTx = await posManager.createAndInitializePoolIfNecessary(
          token0,
          token1,
          feeTier,
          sqrtPriceX96,
        );
        setTx({
          html: `<span class="v3-spinner"></span> Creating pool...<br>${txLink(createTx.hash)}`,
          type: "pending",
        });
        await createTx.wait();
        const factoryAddr = await getV3Factory(reads);
        if (factoryAddr) {
          const factory = new ethers.Contract(
            factoryAddr,
            V3_FACTORY_ABI_EX,
            reads,
          );
          poolAddrRef.current = await factory.getPool(token0, token1, feeTier);
        }
      }

      setTx({
        html: '<span class="v3-spinner"></span> Approving tokens...',
        type: "pending",
      });
      if (amount0Desired.gt(0)) {
        const c0 = new ethers.Contract(token0, ERC20_ABI, signer);
        const ap0 = amount0Desired.add(
          amount0Desired.div(100).gt(1000)
            ? amount0Desired.div(100)
            : ethers.BigNumber.from(1000),
        );
        const b0 = await c0.balanceOf(userAddress);
        const safe0 = ap0.gt(b0) ? b0 : ap0;
        const al0 = await c0.allowance(userAddress, V3_POSITION_MANAGER);
        if (al0.lt(amount0Desired)) {
          if (!al0.isZero()) {
            const r = await c0.approve(V3_POSITION_MANAGER, 0, {
              gasLimit: 100000,
            });
            await r.wait();
          }
          const a = await c0.approve(V3_POSITION_MANAGER, safe0, {
            gasLimit: 100000,
          });
          await a.wait();
        }
      }
      if (amount1Desired.gt(0)) {
        const c1 = new ethers.Contract(token1, ERC20_ABI, signer);
        const ap1 = amount1Desired.add(
          amount1Desired.div(100).gt(1000)
            ? amount1Desired.div(100)
            : ethers.BigNumber.from(1000),
        );
        const b1 = await c1.balanceOf(userAddress);
        const safe1 = ap1.gt(b1) ? b1 : ap1;
        const al1 = await c1.allowance(userAddress, V3_POSITION_MANAGER);
        if (al1.lt(amount1Desired)) {
          if (!al1.isZero()) {
            const r = await c1.approve(V3_POSITION_MANAGER, 0, {
              gasLimit: 100000,
            });
            await r.wait();
          }
          const a = await c1.approve(V3_POSITION_MANAGER, safe1, {
            gasLimit: 100000,
          });
          await a.wait();
        }
      }

      setTx({
        html: '<span class="v3-spinner"></span> Minting position NFT...',
        type: "pending",
      });
      const deadline = Math.floor(Date.now() / 1000) + 1200;
      const mintParams = {
        token0,
        token1,
        fee: feeTier,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min: 0,
        amount1Min: 0,
        recipient: userAddress,
        deadline,
      };
      let gasEstimate: ethers.BigNumber;
      try {
        gasEstimate = await posManager.estimateGas.mint(mintParams);
      } catch (gasErr) {
        const msg = v3GetErrorMessage(
          gasErr,
          "Mint would fail. Please check token amounts and price range.",
        );
        setTx({
          html: `❌ ${msg}<br><small style="color:#aaa;">Tip: Try increasing deposit amounts slightly, or ensure both token amounts are entered.</small>`,
          type: "error",
        });
        return;
      }
      const mintTx = await posManager.mint(mintParams, {
        gasLimit: gasEstimate.mul(120).div(100),
      });
      setTx({
        html: `<span class="v3-spinner"></span> Transaction sent! Waiting for confirmation...<br>${txLink(mintTx.hash)}`,
        type: "pending",
      });
      const receipt = await mintTx.wait();

      let tokenId: ethers.BigNumber | null = null;
      for (const log of receipt.logs) {
        try {
          const parsed = posManager.interface.parseLog(log);
          if (
            parsed.name === "Transfer" &&
            parsed.args.to &&
            parsed.args.to.toLowerCase() === userAddress.toLowerCase()
          ) {
            tokenId = parsed.args.tokenId;
            break;
          }
        } catch {
          /* not a PM log */
        }
      }
      if (!tokenId) {
        for (const log of receipt.logs) {
          try {
            const parsed = posManager.interface.parseLog(log);
            if (parsed.name === "IncreaseLiquidity") {
              tokenId = parsed.args.tokenId;
              break;
            }
          } catch {
            /* ignore */
          }
        }
      }

      const idStr = tokenId ? tokenId.toString() : null;
      setMintedTokenId(idStr);
      setTx({
        html: `✅ Liquidity position minted successfully!<br>${txLink(mintTx.hash)}${
          idStr
            ? `<br><span style="font-size:0.75rem; color:var(--gold-dark);">NFT Token ID: #${idStr}</span>`
            : ""
        }`,
        type: "success",
      });
      showStatus("V3 Liquidity added!", "success");
      setDeposit0("");
      setDeposit1("");
      updateLiquidity();
    } catch (e) {
      setTx({
        html: `❌ ${v3GetErrorMessage(e, "Failed to add liquidity")}`,
        type: "error",
      });
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-[18px]">
        <div className="section-title mb-0 text-left">ADD LIQUIDITY V3</div>
        <ConnectWalletButton />
      </div>

      <div className="v3-pair-row">
        <div className="v3-pair-select" style={{ flex: 1 }}>
          <select
            className="token-select"
            style={{ width: "100%" }}
            value={t0Sel}
            onChange={(e) => setT0Sel(e.target.value)}
          >
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
        <div className="v3-pair-arrow">⇌</div>
        <div className="v3-pair-select" style={{ flex: 1 }}>
          <select
            className="token-select"
            style={{ width: "100%" }}
            value={t1Sel}
            onChange={(e) => setT1Sel(e.target.value)}
          >
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="fee-tier-section">
        <div className="fee-tier-label">FEE TIER</div>
        <div className="fee-tiers">
          {FEE_TIERS.map((f) => (
            <button
              key={f.fee}
              className={`fee-tier-btn${feeTier === f.fee ? " active" : ""}`}
              onClick={() => setFeeTier(f.fee)}
            >
              <div className="fee-tier-value">{f.label}</div>
              <div className="fee-tier-desc">{f.desc}</div>
              <div className="fee-tier-pct">{f.pct}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="liquidity-chart-section">
        <div className="chart-header">
          <div className="chart-title">LIQUIDITY DISTRIBUTION</div>
          <div className="chart-current-price">{priceDisplay}</div>
        </div>
        <div className="chart-wrapper">
          <div className="chart-canvas-container">
            <canvas ref={canvasRef} />
            <div className="chart-current-line" ref={lineRef} />
            <div className="chart-range-overlay" ref={overlayRef} />
          </div>
          <div className="chart-axis">
            <span ref={minAxisRef}>0</span>
            <span ref={maxAxisRef}>0</span>
          </div>
        </div>
      </div>

      <div className="price-range-section">
        <div className="price-range-header">SET PRICE RANGE</div>
        <div className="price-range-inputs">
          <div className="price-range-box">
            <div className="price-range-box-label">MIN PRICE</div>
            <div className="price-range-input-wrap">
              <button
                className="price-range-btn"
                onClick={() => adjustPrice("min", -1)}
              >
                −
              </button>
              <input
                type="number"
                className="price-range-value"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <button
                className="price-range-btn"
                onClick={() => adjustPrice("min", 1)}
              >
                +
              </button>
            </div>
            <div className="price-range-per">{`${t1Info.symbol} per ${t0Info.symbol}`}</div>
          </div>
          <div className="price-range-box">
            <div className="price-range-box-label">MAX PRICE</div>
            <div className="price-range-input-wrap">
              <button
                className="price-range-btn"
                onClick={() => adjustPrice("max", -1)}
              >
                −
              </button>
              <input
                type="number"
                className="price-range-value"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
              <button
                className="price-range-btn"
                onClick={() => adjustPrice("max", 1)}
              >
                +
              </button>
            </div>
            <div className="price-range-per">{`${t1Info.symbol} per ${t0Info.symbol}`}</div>
          </div>
        </div>
        <div className="price-range-presets">
          {[10, 20, 50, 100].map((p) => (
            <button
              key={p}
              className={`range-preset-btn${activePreset === p ? " active" : ""}`}
              onClick={() => setRangePreset(p)}
            >
              {p === 100 ? "Full Range" : `±${p}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="input-group">
        <div className="input-label">
          <span>{t0Info.symbol} Amount</span>
          <span className="balance" onClick={() => maxDeposit(0)}>
            {bal0}
          </span>
        </div>
        <div className="input-wrapper">
          <input
            type="number"
            className="token-input"
            placeholder="0.0"
            value={deposit0}
            onChange={(e) => setDeposit0(e.target.value)}
          />
        </div>
      </div>
      <div className="input-group">
        <div className="input-label">
          <span>{t1Info.symbol} Amount</span>
          <span className="balance" onClick={() => maxDeposit(1)}>
            {bal1}
          </span>
        </div>
        <div className="input-wrapper">
          <input
            type="number"
            className="token-input"
            placeholder="0.0"
            value={deposit1}
            onChange={(e) => setDeposit1(e.target.value)}
          />
        </div>
      </div>

      <div className="pool-info">
        <div className="info-row">
          <span className="info-label">Fee Tier</span>
          <span className="info-value">{v3FeeToPercent(feeTier)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Price Range</span>
          <span className="info-value">{summaryRange}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Capital Efficiency</span>
          <span className="info-value">{summaryEfficiency}</span>
        </div>
      </div>

      {isConnected ? (
        <button
          className="action-btn mt-4"
          style={{ width: "100%" }}
          onClick={addLiquidity}
          disabled={adding}
        >
          {adding ? "Adding Liquidity..." : "Add Liquidity"}
        </button>
      ) : (
        <button
          className="action-btn"
          style={{ width: "100%" }}
          onClick={connectWallet}
        >
          Connect Wallet
        </button>
      )}

      {tx.html && (
        <div
          className={`v3-tx-status ${tx.type}`}
          dangerouslySetInnerHTML={{ __html: tx.html }}
        />
      )}
      {mintedTokenId && (
        <button
          className="v3-add-nft-btn"
          onClick={() => addNFTToWallet(mintedTokenId)}
        >
          <span className="nft-icon">🖼️</span> Add NFT #{mintedTokenId} to
          Wallet
        </button>
      )}
    </div>
  );
}
