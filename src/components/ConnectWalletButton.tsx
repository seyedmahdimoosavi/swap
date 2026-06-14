import { useWeb3 } from '../context/Web3Context';
import { shortAddress } from '../lib/format';

/**
 * Solid yellow "Connect Wallet" pill used in each feature card's header
 * (the redesign moved wallet connection out of the top nav and into the cards).
 */
export default function ConnectWalletButton() {
  const { isConnected, userAddress, connectWallet, disconnectWallet } = useWeb3();

  if (isConnected && userAddress) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-gold/15 border border-gold/40 px-4 py-2 text-[0.8rem] font-semibold text-gold-light">
          {shortAddress(userAddress)}
        </span>
        <button
          onClick={disconnectWallet}
          title="Disconnect Wallet"
          className="rounded-full border border-danger/60 bg-danger/10 px-3 py-2 text-[0.8rem] font-bold text-danger hover:bg-danger/20"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      className="rounded-full bg-gold px-6 py-2.5 text-[0.85rem] font-bold text-black transition-colors hover:bg-gold-light"
    >
      Connect Wallet
    </button>
  );
}
