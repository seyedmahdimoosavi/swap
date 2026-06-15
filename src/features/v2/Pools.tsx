import { useCallback, useEffect, useState } from "react";

import ConnectWalletButton from "../../components/ConnectWalletButton";
import { PAIR_ABI } from "../../config/abis";
import type { Pool } from "../../types";
import PoolItem from "./PoolItem";
import { ethers } from "ethers";
import { getTokenInfoWithProvider } from "../../lib/tokens";
import { useWeb3 } from "../../context/Web3Context";

export default function Pools() {
  const {
    provider,
    readOnlyProvider,
    factoryContract,
    readOnlyFactoryContract,
  } = useWeb3();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loadingText, setLoadingText] = useState("Loading pools...");
  const [loading, setLoading] = useState(true);

  const loadAllPools = useCallback(async () => {
    setLoading(true);
    setPools([]);
    setLoadingText("Loading pools...");

    const currentProvider = provider ?? readOnlyProvider;
    const currentFactory = factoryContract ?? readOnlyFactoryContract;

    try {
      const totalPairs = (await currentFactory.allPairsLength()).toNumber();
      if (totalPairs === 0) {
        setLoading(false);
        setPools([]);
        return;
      }

      const minSupply = ethers.utils.parseUnits("1", 18);
      const loaded: Pool[] = [];

      for (let i = 0; i < totalPairs; i++) {
        try {
          const pairAddress = await currentFactory.allPairs(i);
          const pair = new ethers.Contract(
            pairAddress,
            PAIR_ABI,
            currentProvider,
          );
          const [token0Addr, token1Addr, reserves, totalSupply] =
            await Promise.all([
              pair.token0(),
              pair.token1(),
              pair.getReserves(),
              pair.totalSupply(),
            ]);

          if (totalSupply.lt(minSupply)) continue; // skip dust pools

          const [token0, token1] = await Promise.all([
            getTokenInfoWithProvider(token0Addr, currentProvider),
            getTokenInfoWithProvider(token1Addr, currentProvider),
          ]);

          loaded.push({
            address: pairAddress,
            token0,
            token1,
            reserve0: reserves.reserve0,
            reserve1: reserves.reserve1,
            totalSupply,
          });
        } catch (err) {
          console.error(`Failed to load pool ${i}:`, err);
        }
      }

      setLoading(false);
      setPools(loaded);
    } catch (error) {
      console.error("Failed to load pools:", error);
      setLoadingText("Failed to load pools");
    }
  }, [provider, readOnlyProvider, factoryContract, readOnlyFactoryContract]);

  useEffect(() => {
    loadAllPools();
  }, [loadAllPools]);

  return (
    <div id="poolsSection" className="w-full">
      <div className="card">
        <div className="mb-5 flex items-center justify-between">
          <div className="section-title mb-0 text-left">Liquidity Pools</div>
          <ConnectWalletButton />
        </div>
        {loading && (
          <div className="py-6 text-center text-[0.85rem] text-white/55">
            {loadingText}
          </div>
        )}
        <div className="flex flex-col gap-4">
          {pools.map((pool) => (
            <PoolItem key={pool.address} pool={pool} onRefresh={loadAllPools} />
          ))}
        </div>
        {!loading && pools.length === 0 && (
          <div className="py-6 text-center text-[0.85rem] text-white/55">
            No active pools found
          </div>
        )}
      </div>
      <button className="action-btn" onClick={loadAllPools}>
        Refresh pools
      </button>
    </div>
  );
}
