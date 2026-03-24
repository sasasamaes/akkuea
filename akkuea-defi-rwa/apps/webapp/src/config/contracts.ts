/**
 * Smart Contract Configuration for Frontend
 *
 * This module provides type-safe access to deployed contract addresses
 * and network configuration for the Stellar blockchain.
 *
 * Environment variables must be prefixed with NEXT_PUBLIC_ to be
 * available in the browser.
 */

interface ContractConfig {
  rwaDefiContractId: string | undefined;
  stellarNetwork: string;
  stellarRpcUrl: string;
  stellarHorizonUrl: string;
  stellarNetworkPassphrase: string;
}

interface NetworkConfig {
  name: string;
  rpcUrl: string;
  horizonUrl: string;
  passphrase: string;
}

/**
 * Predefined network configurations for different Stellar networks
 */
const NETWORKS: Record<string, NetworkConfig> = {
  testnet: {
    name: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    passphrase: 'Test SDF Network ; September 2015',
  },
  mainnet: {
    name: 'mainnet',
    rpcUrl: 'https://rpc.mainnet.stellar.org',
    horizonUrl: 'https://horizon.stellar.org',
    passphrase: 'Public Global Stellar Network ; September 2015',
  },
  standalone: {
    name: 'standalone',
    rpcUrl: 'http://localhost:8000/soroban/rpc',
    horizonUrl: 'http://localhost:8000',
    passphrase: 'Standalone Network ; February 2017',
  },
};

/**
 * Get the current network configuration with fallback to defaults
 */
function getNetworkConfig(): NetworkConfig {
  const networkName =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
  const network = NETWORKS[networkName];

  if (!network) {
    console.warn(
      `Unknown network: ${networkName}. Falling back to testnet.`,
    );
    return NETWORKS.testnet;
  }

  // Allow environment variable overrides
  return {
    name: networkName,
    rpcUrl:
      process.env.NEXT_PUBLIC_STELLAR_RPC_URL || network.rpcUrl,
    horizonUrl:
      process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ||
      network.horizonUrl,
    passphrase:
      process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ||
      network.passphrase,
  };
}

/**
 * Load and validate contract configuration from environment variables
 */
function loadContractConfig(): ContractConfig {
  const network = getNetworkConfig();

  return {
    rwaDefiContractId: process.env.NEXT_PUBLIC_RWA_DEFI_CONTRACT_ID,
    stellarNetwork: network.name,
    stellarRpcUrl: network.rpcUrl,
    stellarHorizonUrl: network.horizonUrl,
    stellarNetworkPassphrase: network.passphrase,
  };
}

/**
 * Validate that required contract addresses are configured
 */
function validateContractConfig(config: ContractConfig): string[] {
  const errors: string[] = [];

  if (!config.rwaDefiContractId) {
    errors.push(
      'NEXT_PUBLIC_RWA_DEFI_CONTRACT_ID is not configured',
    );
  }

  return errors;
}

/**
 * Contract configuration singleton
 */
const contractConfig = loadContractConfig();

// Validate on load and log warnings (don't throw in browser)
const validationErrors = validateContractConfig(contractConfig);
if (validationErrors.length > 0) {
  console.warn(
    '[Contract Config] Configuration incomplete:\n' +
      validationErrors.map((e) => `  - ${e}`).join('\n') +
      '\n\nSee docs/contracts/deployment.md for setup instructions.',
  );
}

/**
 * Export contract addresses
 */
export const CONTRACTS = {
  /**
   * RWA DeFi Contract ID
   * Main contract handling real estate tokenization and DeFi operations
   */
  RWA_DEFI_CONTRACT_ID: contractConfig.rwaDefiContractId,
} as const;

/**
 * Export network configuration
 */
export const NETWORK_CONFIG = {
  NETWORK: contractConfig.stellarNetwork,
  RPC_URL: contractConfig.stellarRpcUrl,
  HORIZON_URL: contractConfig.stellarHorizonUrl,
  NETWORK_PASSPHRASE: contractConfig.stellarNetworkPassphrase,
} as const;

/**
 * Helper function to get contract ID with runtime validation
 * Throws error if contract is not configured
 */
export function getContractId(contractName: 'rwa-defi'): string {
  const id = CONTRACTS.RWA_DEFI_CONTRACT_ID;

  if (!id) {
    throw new Error(
      `Contract ID for ${contractName} is not configured. ` +
        'Ensure NEXT_PUBLIC_RWA_DEFI_CONTRACT_ID environment variable is set.',
    );
  }

  return id;
}

/**
 * Helper to check if contracts are configured
 */
export function isContractConfigured(contractName: 'rwa-defi'): boolean {
  return !!CONTRACTS.RWA_DEFI_CONTRACT_ID;
}

/**
 * Hook for React components to safely access contract configuration
 * Returns null if contracts are not configured
 */
export function useContractConfig() {
  const configured = isContractConfigured('rwa-defi');

  if (!configured) {
    return null;
  }

  return {
    contracts: CONTRACTS,
    network: NETWORK_CONFIG,
    isConfigured: true,
  };
}

/**
 * Export all configuration as a single object for convenience
 */
export const config = {
  contracts: CONTRACTS,
  network: NETWORK_CONFIG,
  getContractId,
  isContractConfigured,
} as const;

export default config;
