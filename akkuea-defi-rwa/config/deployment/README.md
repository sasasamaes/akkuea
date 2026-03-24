# Deployment Configuration

This directory contains environment-specific configuration files for smart contract deployment.

## Configuration Files

### `testnet.env`
Configuration for Stellar testnet deployments. Use this for:
- Development testing
- Integration testing
- Pre-production verification
- Learning and experimentation

### `mainnet.env`
Configuration for Stellar mainnet (production) deployments. Use this for:
- Production deployments
- User-facing applications
- Real asset tokenization

**Warning**: Mainnet deployments use real XLM and create permanent contracts. Always test thoroughly on testnet first.

### `local.env`
Configuration for local Stellar standalone network. Use this for:
- Local development
- Unit testing with real network
- Offline development

## Configuration Parameters

Each configuration file contains the following parameters:

### Network Settings
- `STELLAR_NETWORK`: Network identifier (testnet/mainnet/standalone)
- `STELLAR_RPC_URL`: Soroban RPC endpoint URL
- `STELLAR_NETWORK_PASSPHRASE`: Network passphrase for transaction signing
- `STELLAR_HORIZON_URL`: Horizon API endpoint for account queries

### Contract Configuration
- `CONTRACT_WASM_NAME`: Name of the compiled WASM file
- `CONTRACT_BUILD_TARGET`: Rust build target for WASM compilation

### Deployment Settings
- `DEPLOYMENT_ACCOUNT_NAME`: Stellar CLI key identifier for deployment account
- `DEPLOYMENT_MIN_BALANCE`: Minimum balance required for deployment (stroops)
- `DEPLOYMENT_FEE_LIMIT`: Maximum fee limit for deployment transactions

### Post-Deployment
- `VERIFY_DEPLOYMENT`: Run verification tests after deployment
- `RUN_SMOKE_TESTS`: Execute smoke tests on deployed contracts
- `SAVE_DEPLOYMENT_INFO`: Save deployment metadata to JSON file
- `DEPLOYMENT_INFO_DIR`: Directory to store deployment information

### Logging
- `LOG_LEVEL`: Logging verbosity (debug/info/warn/error)
- `LOG_FILE`: Path to deployment log file

## Usage

These configuration files are automatically loaded by `scripts/deploy-hardened.sh` based on the environment parameter:

```bash
# Loads config/deployment/testnet.env
./scripts/deploy-hardened.sh testnet

# Loads config/deployment/mainnet.env
./scripts/deploy-hardened.sh mainnet

# Loads config/deployment/local.env
./scripts/deploy-hardened.sh local
```

## Customization

To customize deployment for your environment:

1. Copy the appropriate `.env` file:
   ```bash
   cp config/deployment/testnet.env config/deployment/testnet-custom.env
   ```

2. Modify the custom configuration file with your settings

3. Update the deployment script to use your custom config, or modify the existing file

## Environment Variable Override

All configuration parameters can be overridden with environment variables:

```bash
# Override RPC URL for a single deployment
STELLAR_RPC_URL=https://custom-rpc.example.com ./scripts/deploy-hardened.sh testnet
```

## Security Notes

- **Never commit private keys** or secret keys to these configuration files
- Keep `DEPLOYMENT_ACCOUNT_NAME` secure and use Stellar CLI's key storage
- For mainnet deployments, consider using hardware wallets for key management
- Review `mainnet.env` carefully before production deployments

## See Also

- [Deployment Guide](../../docs/contracts/deployment.md) - Full deployment documentation
- [Rollback Procedures](../../docs/contracts/rollback-procedures.md) - Emergency rollback guide
- [Deployment Audit](../../docs/contracts/deployment-audit.md) - Security audit findings
