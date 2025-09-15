'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ethers } from 'ethers';
import { toast } from 'react-hot-toast';

interface Web3ContextType {
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  getBalance: (address?: string) => Promise<string>;
  sendTransaction: (to: string, amount: string) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  getNetworkInfo: () => Promise<{ name: string; chainId: number } | null>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

interface Web3ProviderProps {
  children: ReactNode;
}

// Supported networks
const SUPPORTED_NETWORKS = {
  1: { name: 'Ethereum Mainnet', rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL },
  137: { name: 'Polygon', rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL },
  56: { name: 'BSC', rpcUrl: process.env.NEXT_PUBLIC_BSC_RPC_URL },
};

export function Web3Provider({ children }: Web3ProviderProps) {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnection();
    setupEventListeners();
  }, []);

  const checkConnection = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      
      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        const network = await provider.getNetwork();
        
        setProvider(provider);
        setSigner(signer);
        setAccount(accounts[0].address);
        setChainId(Number(network.chainId));
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const setupEventListeners = () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return;
    }

    // Listen for account changes
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAccount(accounts[0]);
      }
    });

    // Listen for chain changes
    window.ethereum.on('chainChanged', (chainId: string) => {
      setChainId(Number(chainId));
      window.location.reload(); // Reload to update the app
    });

    // Listen for disconnect
    window.ethereum.on('disconnect', () => {
      disconnectWallet();
    });
  };

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      toast.error('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    setIsConnecting(true);

    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setProvider(provider);
      setSigner(signer);
      setAccount(address);
      setChainId(Number(network.chainId));
      setIsConnected(true);

      toast.success('Wallet connected successfully!');
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      
      if (error.code === 4001) {
        toast.error('Please connect to MetaMask to continue.');
      } else {
        toast.error('Failed to connect wallet. Please try again.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setIsConnected(false);
    
    toast.success('Wallet disconnected');
  };

  const switchNetwork = async (targetChainId: number) => {
    if (!window.ethereum) {
      toast.error('MetaMask is not installed');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
      
      toast.success(`Switched to ${SUPPORTED_NETWORKS[targetChainId as keyof typeof SUPPORTED_NETWORKS]?.name}`);
    } catch (error: any) {
      if (error.code === 4902) {
        // Chain not added, try to add it
        const networkInfo = SUPPORTED_NETWORKS[targetChainId as keyof typeof SUPPORTED_NETWORKS];
        if (networkInfo) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: networkInfo.name,
                rpcUrls: [networkInfo.rpcUrl],
                nativeCurrency: {
                  name: targetChainId === 1 ? 'Ether' : targetChainId === 137 ? 'MATIC' : 'BNB',
                  symbol: targetChainId === 1 ? 'ETH' : targetChainId === 137 ? 'MATIC' : 'BNB',
                  decimals: 18,
                },
                blockExplorerUrls: [
                  targetChainId === 1 ? 'https://etherscan.io' :
                  targetChainId === 137 ? 'https://polygonscan.com' :
                  'https://bscscan.com'
                ],
              }],
            });
            toast.success(`Added and switched to ${networkInfo.name}`);
          } catch (addError) {
            toast.error('Failed to add network');
          }
        }
      } else {
        toast.error('Failed to switch network');
      }
    }
  };

  const getBalance = async (address?: string): Promise<string> => {
    if (!provider) {
      throw new Error('Provider not connected');
    }

    try {
      const targetAddress = address || account;
      if (!targetAddress) {
        throw new Error('No address provided');
      }

      const balance = await provider.getBalance(targetAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  };

  const sendTransaction = async (to: string, amount: string): Promise<string> => {
    if (!signer) {
      throw new Error('Signer not connected');
    }

    try {
      const tx = await signer.sendTransaction({
        to,
        value: ethers.parseEther(amount),
      });

      toast.success('Transaction sent! Waiting for confirmation...');
      
      const receipt = await tx.wait();
      
      if (receipt) {
        toast.success('Transaction confirmed!');
        return receipt.hash;
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error: any) {
      console.error('Error sending transaction:', error);
      
      if (error.code === 'INSUFFICIENT_FUNDS') {
        toast.error('Insufficient funds for transaction');
      } else if (error.code === 'USER_REJECTED') {
        toast.error('Transaction rejected by user');
      } else {
        toast.error('Transaction failed');
      }
      
      throw error;
    }
  };

  const signMessage = async (message: string): Promise<string> => {
    if (!signer) {
      throw new Error('Signer not connected');
    }

    try {
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error: any) {
      console.error('Error signing message:', error);
      
      if (error.code === 'USER_REJECTED') {
        toast.error('Message signing rejected by user');
      } else {
        toast.error('Failed to sign message');
      }
      
      throw error;
    }
  };

  const getNetworkInfo = async (): Promise<{ name: string; chainId: number } | null> => {
    if (!provider) {
      return null;
    }

    try {
      const network = await provider.getNetwork();
      const networkInfo = SUPPORTED_NETWORKS[Number(network.chainId) as keyof typeof SUPPORTED_NETWORKS];
      
      return {
        name: networkInfo?.name || 'Unknown Network',
        chainId: Number(network.chainId),
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      return null;
    }
  };

  const value: Web3ContextType = {
    provider,
    signer,
    account,
    chainId,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    getBalance,
    sendTransaction,
    signMessage,
    getNetworkInfo,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}