import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ethers } from 'ethers';
import { ROUTER_ABI, FACTORY_ABI } from '../config/abis';
import {
  ROUTER_ADDRESS,
  FACTORY_ADDRESS,
  CHAIN_ID,
  CHAIN_ID_HEX,
  RPC_URL,
  NETWORK_CONFIG,
} from '../config/contracts';
import { shortAddress } from '../lib/format';
import { useStatus } from './StatusContext';

interface Web3ContextValue {
  provider: ethers.providers.Web3Provider | null;
  readOnlyProvider: ethers.providers.JsonRpcProvider;
  signer: ethers.Signer | null;
  userAddress: string | null;
  routerContract: ethers.Contract | null;
  factoryContract: ethers.Contract | null;
  readOnlyFactoryContract: ethers.Contract;
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const Web3Context = createContext<Web3ContextValue | null>(null);

// The read-only provider works without a wallet (used for the Pools list).
const readOnlyProvider = new ethers.providers.JsonRpcProvider(RPC_URL);

export function Web3Provider({ children }: { children: ReactNode }) {
  const { showStatus } = useStatus();

  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [routerContract, setRouterContract] = useState<ethers.Contract | null>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [readOnlyFactoryContract, setReadOnlyFactoryContract] = useState<ethers.Contract>(
    () => new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, readOnlyProvider),
  );

  const connectWallet = useCallback(async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        showStatus('Please install MetaMask or another Web3 wallet', 'error');
        return;
      }

      showStatus('Connecting wallet...', 'info');
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      let web3Provider = new ethers.providers.Web3Provider(window.ethereum, 'any');

      // Check and switch network (compare as BigInt for large chain IDs).
      const network = await web3Provider.getNetwork();
      if (BigInt(network.chainId) !== BigInt(CHAIN_ID)) {
        showStatus('Switching to DotOneSmartchain...', 'info');
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CHAIN_ID_HEX }],
          });
        } catch (switchError) {
          const code = (switchError as { code?: number }).code;
          if (code === 4902 || code === -32603) {
            showStatus('Adding DotOneSmartchain network...', 'info');
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [NETWORK_CONFIG],
            });
          } else {
            throw switchError;
          }
        }
        web3Provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
      }

      const newSigner = web3Provider.getSigner();
      const address = await newSigner.getAddress();
      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, newSigner);

      // Sanity check that contracts are deployed at the configured addresses.
      const routerCode = await web3Provider.getCode(ROUTER_ADDRESS);
      const factoryCode = await web3Provider.getCode(FACTORY_ADDRESS);
      if (routerCode === '0x') {
        showStatus('ERROR: No contract found at Router address! Check deployment and chain ID.', 'error');
      }
      if (factoryCode === '0x') {
        showStatus('ERROR: No contract found at Factory address! Check deployment and chain ID.', 'error');
      }

      // Prefer the factory the router actually points at, if it differs.
      let factory: ethers.Contract;
      try {
        const routerFactoryAddr: string = await router.factory();
        if (routerFactoryAddr.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
          factory = new ethers.Contract(routerFactoryAddr, FACTORY_ABI, newSigner);
          setReadOnlyFactoryContract(new ethers.Contract(routerFactoryAddr, FACTORY_ABI, readOnlyProvider));
        } else {
          factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, newSigner);
        }
      } catch (factoryError) {
        console.error('Failed to get factory from router:', factoryError);
        factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, newSigner);
      }

      setProvider(web3Provider);
      setSigner(newSigner);
      setUserAddress(address);
      setRouterContract(router);
      setFactoryContract(factory);

      showStatus('Wallet connected successfully!', 'success');
    } catch (error) {
      console.error('Connection error:', error);
      const code = (error as { code?: number }).code;
      if (code === 4001) {
        showStatus('Connection rejected by user', 'error');
      } else if (code === -32002) {
        showStatus('Please check MetaMask - connection request pending', 'error');
      } else {
        showStatus((error as Error).message || 'Failed to connect wallet', 'error');
      }
    }
  }, [showStatus]);

  const disconnectWallet = useCallback(() => {
    setSigner(null);
    setUserAddress(null);
    setRouterContract(null);
    setFactoryContract(null);
    showStatus('Wallet disconnected', 'info');
  }, [showStatus]);

  // Keep a stable ref to connectWallet so the one-time init effect doesn't re-run.
  const connectRef = useRef(connectWallet);
  connectRef.current = connectWallet;
  const disconnectRef = useRef(disconnectWallet);
  disconnectRef.current = disconnectWallet;

  // init(): auto-connect if already authorized, and wire up wallet events.
  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return;

    const eth = window.ethereum;
    const web3Provider = new ethers.providers.Web3Provider(eth);
    setProvider(web3Provider);

    web3Provider.listAccounts().then((accounts) => {
      if (accounts.length > 0) connectRef.current();
    });

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnectRef.current();
      else connectRef.current();
    };
    const handleChainChanged = () => window.location.reload();

    eth.on('accountsChanged', handleAccountsChanged as never);
    eth.on('chainChanged', handleChainChanged as never);

    return () => {
      eth.removeListener?.('accountsChanged', handleAccountsChanged as never);
      eth.removeListener?.('chainChanged', handleChainChanged as never);
    };
  }, []);

  const value: Web3ContextValue = {
    provider,
    readOnlyProvider,
    signer,
    userAddress,
    routerContract,
    factoryContract,
    readOnlyFactoryContract,
    isConnected: !!userAddress,
    connectWallet,
    disconnectWallet,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3(): Web3ContextValue {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used within a Web3Provider');
  return ctx;
}

export { shortAddress };
