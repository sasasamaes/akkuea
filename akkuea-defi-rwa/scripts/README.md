# Deployment Scripts

This directory contains scripts for smart contract deployment and infrastructure management.

## Available Scripts

### `deploy-hardened.sh`

Production-grade deployment script for Soroban smart contracts.

**Usage:**
```bash
# Deploy to testnet
./scripts/deploy-hardened.sh testnet

# Test deployment without executing (dry-run)
./scripts/deploy-hardened.sh testnet --dry-run

# Deploy to mainnet
./scripts/deploy-hardened.sh mainnet

# Skip post-deployment verification
./scripts/deploy-hardened.sh testnet --skip-tests
```

**Features:**
- ✅ Comprehensive prerequisites validation
- ✅ Automatic contract build and size verification
- ✅ Environment-specific configuration
- ✅ Contract address persistence
- ✅ Post-deployment verification
- ✅ Detailed logging with colored output
- ✅ Error handling with actionable messages

**Outputs:**
- JSON deployment metadata in `deployed-contracts/`
- Environment files for API and webapp
- Detailed logs in `logs/`

See [Deployment Guide](../docs/contracts/deployment.md) for full documentation.

---

### `verify-setup.sh`

Verifies that all prerequisites for deployment are installed.

**Usage:**
```bash
./scripts/verify-setup.sh
```

**Checks:**
- Stellar CLI installation
- Rust/Cargo installation
- WASM target installation
- Bun/Node.js installation
- Git installation

Run this before attempting your first deployment to ensure your environment is properly configured.

---

### Deprecated Scripts

The following scripts are deprecated and should not be used:

- ❌ `deploy.sh` - Replaced by `deploy-hardened.sh`
- ❌ `build.sh` - Build process integrated into `deploy-hardened.sh`

These scripts had critical issues identified in the deployment audit (see [deployment-audit.md](../docs/contracts/deployment-audit.md)) and should not be used.

---

## Quick Start

1. **Verify prerequisites:**
   ```bash
   ./scripts/verify-setup.sh
   ```

2. **Configure Stellar account:**
   ```bash
   stellar keys generate default --network testnet
   stellar account fund $(stellar keys address default) --network testnet
   ```

3. **Deploy to testnet:**
   ```bash
   ./scripts/deploy-hardened.sh testnet
   ```

4. **Verify deployment:**
   ```bash
   cat deployed-contracts/testnet_rwa-defi-contract.txt
   ```

## Related Documentation

- [Deployment Guide](../docs/contracts/deployment.md) - Complete deployment documentation
- [Rollback Procedures](../docs/contracts/rollback-procedures.md) - Emergency rollback guide
- [Deployment Audit](../docs/contracts/deployment-audit.md) - Security audit findings
- [Configuration Guide](../config/deployment/README.md) - Environment configuration

## Support

For deployment issues:
1. Check the [Troubleshooting section](../docs/contracts/deployment.md#troubleshooting) in the deployment guide
2. Review deployment logs in `logs/deployment-<environment>.log`
3. Run with `--dry-run` to test without deploying
4. Open an issue on GitHub with deployment logs
