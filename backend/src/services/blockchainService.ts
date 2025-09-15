import { ethers } from 'ethers';
import { db } from '@/config/database';
import { cache } from '@/config/redis';
import { createError } from '@/middleware/errorHandler';
import { EncryptionService } from './encryptionService';

export interface BlockchainNetwork {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface CryptoTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: number;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export class BlockchainService {
  private static readonly NETWORKS: Record<string, BlockchainNetwork> = {
    ethereum: {
      name: 'Ethereum',
      chainId: 1,
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/your-key',
      explorerUrl: 'https://etherscan.io',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
      },
    },
    polygon: {
      name: 'Polygon',
      chainId: 137,
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      explorerUrl: 'https://polygonscan.com',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18,
      },
    },
    bsc: {
      name: 'Binance Smart Chain',
      chainId: 56,
      rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
      explorerUrl: 'https://bscscan.com',
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18,
      },
    },
  };

  static async createWallet(network: string): Promise<{ address: string; privateKey: string }> {
    const wallet = ethers.Wallet.createRandom();
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  }

  static async getBalance(address: string, network: string): Promise<string> {
    const networkConfig = this.NETWORKS[network];
    if (!networkConfig) {
      throw createError('Unsupported network', 400);
    }

    try {
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      throw createError(`Failed to get balance: ${error.message}`, 500);
    }
  }

  static async sendTransaction(
    fromPrivateKey: string,
    toAddress: string,
    amount: string,
    network: string,
    gasPrice?: string
  ): Promise<{ hash: string; status: string }> {
    const networkConfig = this.NETWORKS[network];
    if (!networkConfig) {
      throw createError('Unsupported network', 400);
    }

    try {
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const wallet = new ethers.Wallet(fromPrivateKey, provider);

      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount),
        gasPrice: gasPrice ? ethers.parseUnits(gasPrice, 'gwei') : undefined,
      });

      return {
        hash: tx.hash,
        status: 'pending',
      };
    } catch (error) {
      throw createError(`Transaction failed: ${error.message}`, 500);
    }
  }

  static async getTransactionStatus(txHash: string, network: string): Promise<CryptoTransaction> {
    const networkConfig = this.NETWORKS[network];
    if (!networkConfig) {
      throw createError('Unsupported network', 400);
    }

    try {
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!tx) {
        throw createError('Transaction not found', 404);
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: ethers.formatEther(tx.value),
        gasUsed: receipt?.gasUsed.toString() || '0',
        gasPrice: ethers.formatUnits(tx.gasPrice || 0, 'gwei'),
        blockNumber: tx.blockNumber || 0,
        timestamp: (await provider.getBlock(tx.blockNumber || 0))?.timestamp || 0,
        status: receipt ? (receipt.status === 1 ? 'confirmed' : 'failed') : 'pending',
      };
    } catch (error) {
      throw createError(`Failed to get transaction status: ${error.message}`, 500);
    }
  }

  static async getTransactionHistory(address: string, network: string, limit: number = 50): Promise<CryptoTransaction[]> {
    const networkConfig = this.NETWORKS[network];
    if (!networkConfig) {
      throw createError('Unsupported network', 400);
    }

    try {
      // This is a simplified implementation
      // In production, you would use a service like Alchemy, Infura, or Moralis
      // to get transaction history efficiently
      
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      
      // For now, we'll return cached data or empty array
      // In production, implement proper transaction history fetching
      const cacheKey = `tx_history:${network}:${address}`;
      const cachedHistory = await cache.get(cacheKey);
      
      if (cachedHistory) {
        return cachedHistory;
      }

      // Placeholder for actual implementation
      return [];
    } catch (error) {
      throw createError(`Failed to get transaction history: ${error.message}`, 500);
    }
  }

  static async estimateGas(
    fromAddress: string,
    toAddress: string,
    amount: string,
    network: string
  ): Promise<{ gasLimit: string; gasPrice: string }> {
    const networkConfig = this.NETWORKS[network];
    if (!networkConfig) {
      throw createError('Unsupported network', 400);
    }

    try {
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      
      const gasLimit = await provider.estimateGas({
        from: fromAddress,
        to: toAddress,
        value: ethers.parseEther(amount),
      });

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');

      return {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
      };
    } catch (error) {
      throw createError(`Failed to estimate gas: ${error.message}`, 500);
    }
  }

  static async getCurrentGasPrice(network: string): Promise<{ gasPrice: string; maxFeePerGas?: string; maxPriorityFeePerGas?: string }> {
    const networkConfig = this.NETWORKS[network];
    if (!networkConfig) {
      throw createError('Unsupported network', 400);
    }

    try {
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const feeData = await provider.getFeeData();

      return {
        gasPrice: ethers.formatUnits(feeData.gasPrice || 0, 'gwei'),
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : undefined,
      };
    } catch (error) {
      throw createError(`Failed to get gas price: ${error.message}`, 500);
    }
  }

  static async validateAddress(address: string, network: string): Promise<boolean> {
    try {
      return ethers.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  static async getSupportedNetworks(): Promise<BlockchainNetwork[]> {
    return Object.values(this.NETWORKS);
  }

  static async getNetworkInfo(network: string): Promise<BlockchainNetwork> {
    const networkConfig = this.NETWORKS[network];
    if (!networkConfig) {
      throw createError('Unsupported network', 400);
    }
    return networkConfig;
  }

  // Smart contract interaction methods
  static async deployContract(
    privateKey: string,
    contractBytecode: string,
    constructorArgs: any[],
    network: string
  ): Promise<{ contractAddress: string; txHash: string }> {
    const networkConfig = this.NETWORKS[network];
    if (!networkConfig) {
      throw createError('Unsupported network', 400);
    }

    try {
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      const factory = new ethers.ContractFactory([], contractBytecode, wallet);
      const contract = await factory.deploy(...constructorArgs);
      await contract.waitForDeployment();

      return {
        contractAddress: await contract.getAddress(),
        txHash: contract.deploymentTransaction()?.hash || '',
      };
    } catch (error) {
      throw createError(`Contract deployment failed: ${error.message}`, 500);
    }
  }

  static async callContractMethod(
    contractAddress: string,
    abi: any[],
    methodName: string,
    args: any[],
    network: string
  ): Promise<any> {
    const networkConfig = this.NETWORKS[network];
    if (!networkConfig) {
      throw createError('Unsupported network', 400);
    }

    try {
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const contract = new ethers.Contract(contractAddress, abi, provider);
      
      return await contract[methodName](...args);
    } catch (error) {
      throw createError(`Contract call failed: ${error.message}`, 500);
    }
  }

  static async sendContractTransaction(
    privateKey: string,
    contractAddress: string,
    abi: any[],
    methodName: string,
    args: any[],
    network: string,
    value?: string
  ): Promise<{ hash: string; status: string }> {
    const networkConfig = this.NETWORKS[network];
    if (!networkConfig) {
      throw createError('Unsupported network', 400);
    }

    try {
      const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(contractAddress, abi, wallet);

      const tx = await contract[methodName](...args, {
        value: value ? ethers.parseEther(value) : undefined,
      });

      return {
        hash: tx.hash,
        status: 'pending',
      };
    } catch (error) {
      throw createError(`Contract transaction failed: ${error.message}`, 500);
    }
  }
}