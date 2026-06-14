import { ROUTER_ADDRESS, T1_ADDRESS, T2_ADDRESS } from "../../config/contracts";
import { errorMessage, txUrl } from "../../lib/format";
import { useCallback, useEffect, useRef, useState } from "react";

import ConnectWalletButton from "../../components/ConnectWalletButton";
import { ERC20_ABI } from "../../config/abis";
import type { TokenInfo } from "../../types";
import { ethers } from "ethers";
import { useBalance } from "../../hooks/useBalance";
import { useStatus } from "../../context/StatusContext";
import { useTokenField } from "../../hooks/useTokenField";
import { useWeb3 } from "../../context/Web3Context";

const SLIPPAGE_PRESETS = [0.5, 1, 2];

interface SwapInfo {
  rate: string;
  minReceived: string;
  priceImpact: string;
}

export default function Swap() {
  const { routerContract, signer, userAddress, provider } = useWeb3();
  const { showStatus } = useStatus();

  const [fromToken, setFromToken] = useState<TokenInfo>({
    address: T1_ADDRESS,
    symbol: "T1",
    decimals: 18,
  });
  const [toToken, setToToken] = useState<TokenInfo>({
    address: T2_ADDRESS,
    symbol: "T2",
    decimals: 18,
  });
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [customSlippage, setCustomSlippage] = useState("");
  const [info, setInfo] = useState<SwapInfo | null>(null);
  const [btnText, setBtnText] = useState("Enter an amount");
  const [btnDisabled, setBtnDisabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fromField = useTokenField(fromToken, setFromToken);
  const toField = useTokenField(toToken, setToToken);
  const fromBalance = useBalance(fromToken, refreshKey);
  const toBalance = useBalance(toToken, refreshKey);

  // Re-quote when amount, tokens, slippage, or connection change.
  const calcRef = useRef<() => void>(() => {});
  const calculateSwapOutput = useCallback(async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setBtnText("Enter an amount");
      setBtnDisabled(true);
      setInfo(null);
      setToAmount("");
      return;
    }
    if (!routerContract) {
      setBtnText("Connect Wallet");
      setBtnDisabled(true);
      return;
    }
    try {
      const amountIn = ethers.utils.parseUnits(fromAmount, fromToken.decimals);
      const path = [fromToken.address, toToken.address];
      const amounts = await routerContract.getAmountsOut(amountIn, path);
      const amountOut = amounts[1];

      const out = parseFloat(
        ethers.utils.formatUnits(amountOut, toToken.decimals),
      );
      setToAmount(out.toFixed(6));

      const rate = out / parseFloat(fromAmount);
      const minOut = amountOut.mul(100 - slippage * 100).div(10000);
      setInfo({
        rate: `1 ${fromToken.symbol} = ${rate.toFixed(6)} ${toToken.symbol}`,
        minReceived: `${parseFloat(ethers.utils.formatUnits(minOut, toToken.decimals)).toFixed(6)} ${toToken.symbol}`,
        priceImpact: "< 0.1%",
      });
      setBtnText("Swap");
      setBtnDisabled(false);
    } catch (error) {
      console.error("Failed to calculate swap:", error);
      setBtnText("Insufficient liquidity");
      setBtnDisabled(true);
      setInfo(null);
    }
  }, [fromAmount, routerContract, fromToken, toToken, slippage]);

  calcRef.current = calculateSwapOutput;
  useEffect(() => {
    calcRef.current();
  }, [fromAmount, fromToken, toToken, slippage, routerContract]);

  const handleSetSlippage = (value: number) => {
    setSlippage(value);
    setCustomSlippage("");
  };

  const swapTokenPositions = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount("");
    setToAmount("");
  };

  const setMaxFrom = () => {
    if (fromBalance.raw) {
      setFromAmount(
        ethers.utils.formatUnits(fromBalance.raw, fromToken.decimals),
      );
    }
  };

  const executeSwap = async () => {
    if (!signer || !routerContract || !userAddress || !provider) {
      showStatus("Please connect your wallet", "error");
      return;
    }
    if (!fromAmount || !toAmount) {
      showStatus("Please enter amounts", "error");
      return;
    }

    const amountIn = ethers.utils.parseUnits(fromAmount, fromToken.decimals);
    const amountOutMin = ethers.utils
      .parseUnits(toAmount, toToken.decimals)
      .mul(100 - slippage * 100)
      .div(10000);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    const path = [fromToken.address, toToken.address];

    try {
      setLoading(true);
      showStatus("Processing swap...", "info");

      const token = new ethers.Contract(fromToken.address, ERC20_ABI, signer);
      const allowance = await token.allowance(userAddress, ROUTER_ADDRESS);
      if (allowance.lt(amountIn)) {
        if (!allowance.isZero()) {
          showStatus("Resetting allowance...", "info");
          const resetTx = await token.approve(ROUTER_ADDRESS, 0, {
            gasLimit: 100000,
          });
          await resetTx.wait();
        }
        showStatus("Approving token...", "info");
        const approveTx = await token.approve(ROUTER_ADDRESS, amountIn, {
          gasLimit: 100000,
        });
        await approveTx.wait();
      }

      const tx = await routerContract.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        userAddress,
        deadline,
      );
      showStatus("Waiting for confirmation...", "info");
      await tx.wait();

      showStatus(
        <>
          Swap successful!{" "}
          <a href={txUrl(tx.hash)} target="_blank" rel="noreferrer">
            View Transaction
          </a>
        </>,
        "success",
      );
      setFromAmount("");
      setToAmount("");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      console.error("Swap failed:", error);
      showStatus(errorMessage(error, "Swap failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="swapSection" className={loading ? "loading" : ""}>
      <div className="card">
        <div className="flex items-center justify-between mb-[18px]">
          <div className="section-title mb-0 text-left">Swap Tokens</div>
          <ConnectWalletButton />
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>From</span>
            <span className="balance" onClick={setMaxFrom}>
              Balance: {fromBalance.display}
            </span>
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              className="token-input"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
            />
            {fromField.select}
          </div>
          {fromField.customInput}
        </div>

        <div className="swap-arrow">
          <button onClick={swapTokenPositions}>
            <span className="arrow down">↓</span>
            <span className="arrow up">↓</span>
          </button>
        </div>

        <div className="input-group">
          <div className="input-label">
            <span>To</span>
            <span className="balance">Balance: {toBalance.display}</span>
          </div>
          <div className="input-wrapper">
            <input
              type="number"
              className="token-input"
              placeholder="0.0"
              value={toAmount}
              readOnly
            />
            {toField.select}
          </div>
          {toField.customInput}
        </div>

        {info && (
          <div>
            <div className="info-row">
              <span className="info-label">Rate</span>
              <span className="info-value">{info.rate}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Minimum Received</span>
              <span className="info-value">{info.minReceived}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Price Impact</span>
              <span className="info-value">{info.priceImpact}</span>
            </div>
          </div>
        )}

        <div className="slippage-settings flex justify-between mt-4">
          <div className="input-label text-[20px] text-white">
            Slippage Tolerance
          </div>
          <div className="slippage-options">
            {SLIPPAGE_PRESETS.map((s) => (
              <button
                key={s}
                className={`slippage-btn${slippage === s && !customSlippage ? " active" : ""}`}
                onClick={() => handleSetSlippage(s)}
              >
                {s}%
              </button>
            ))}
            <div className="custom-slippage-box">
              <input
                type="number"
                placeholder="0.10"
                value={customSlippage}
                onChange={(e) => {
                  setCustomSlippage(e.target.value);
                  if (e.target.value) setSlippage(parseFloat(e.target.value));
                }}
              />
              <span className="pct">%</span>
            </div>
          </div>
        </div>
      </div>

      <button
        className="action-btn"
        onClick={executeSwap}
        disabled={btnDisabled}
      >
        {btnText}
      </button>
    </div>
  );
}
