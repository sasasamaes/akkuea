# Smart Contracts Deployment

This guide covers deploying the Real Estate DeFi Platform smart contracts to Stellar networks using the hardened deployment workflow.

> **Important**: This guide has been updated to reflect the production-grade deployment process introduced in C3-001. The old deployment scripts (`deploy.sh` and `build.sh`) are deprecated. Use `deploy-hardened.sh` instead.

## Quick Start

```bash
# Deploy to testnet (recommended for testing)
./scripts/deploy-hardened.sh testnet

# Test deployment without making changes
./scripts/deploy-hardened.sh testnet --dry-run

# Deploy to mainnet (production)
./scripts/deploy-hardened.sh mainnet
```

## Prerequisites

1. **Stellar CLI** (v21.0.0 or later)
2. **Rust toolchain** with `wasm32-unknown-unknown` target
3. **Stellar account** with sufficient XLM balance
4. **Network access** to Stellar RPC endpoints

## Contract Architecture

The platform currently uses a unified contract architecture:

### RWA DeFi Contract

- **File**: `apps/contracts/contracts/defi-rwa/src/lib.rs`
- **Package**: `rwa-defi-contract`
- **Output**: `rwa_defi_contract.wasm`
- **Purpose**: Combined real estate tokenization and DeFi operations

**Current Implementation**:
The contract is currently in early development with a basic "hello world" implementation. Future iterations will include:
- Property tokenization and fractionalization
- Share ownership tracking and transfers
- DeFi lending pool management
- Collateralized borrowing
- Interest rate calculation
- Royalty distribution

**Note**: Contract API is subject to change. Always verify deployed contract entrypoints match the current implementation.

## Build Process

The hardened deployment script (`deploy-hardened.sh`) handles the build process automatically. However, you can also build manually for testing:

### Automated Build (Recommended)

The deployment script automatically:
1. Validates Rust and WASM target installation
2. Cleans previous builds
3. Builds contracts in release mode
4. Verifies WASM file size is under 1MB limit
5. Validates WASM file exists at expected location

### Manual Build (For Development)

```bash
# Navigate to contracts directory
cd apps/contracts

# Install WASM target if not present
rustup target add wasm32-unknown-unknown

# Build contracts
cargo build --target wasm32-unknown-unknown --release

# Verify output
ls -la target/wasm32-unknown-unknown/release/rwa_defi_contract.wasm
```

**Expected Output**:
- File: `target/wasm32-unknown-unknown/release/rwa_defi_contract.wasm`
- Size: Should be under 1MB (Soroban contract size limit)

### Build Optimization

The contract is configured with aggressive size optimization in `Cargo.toml`:

```toml
[profile.release]
opt-level = "z"          # Optimize for size
lto = true               # Enable Link Time Optimization
codegen-units = 1        # Better optimization
strip = true             # Strip symbols
panic = "abort"          # Smaller binary
overflow-checks = false  # Disable overflow checks in release
```

## Network Setup

### Testnet Configuration

```bash
# Configure Stellar CLI for testnet
stellar network testnet

# Create or import testnet account
stellar keys generate --network testnet

# Get friendbot funding (testnet only)
stellar account fund $(stellar keys address) --network testnet
```

### Mainnet Configuration

```bash
# Configure Stellar CLI for mainnet
stellar network mainnet

# Import your mainnet account
stellar keys import --name mainnet-account

# Ensure sufficient balance for deployment (usually ~10 XLM)
```

## Hardened Deployment Process

### Overview

The hardened deployment script provides production-grade deployment with:
- ✅ Prerequisites validation
- ✅ Automatic build process
- ✅ Environment-specific configuration
- ✅ Contract address persistence
- ✅ Deployment verification
- ✅ Smoke tests
- ✅ Automatic app configuration generation
- ✅ Comprehensive error handling
- ✅ Dry-run mode for testing

### Basic Deployment

```bash
# Deploy to testnet (recommended for development)
./scripts/deploy-hardened.sh testnet

# Deploy to mainnet (production only)
./scripts/deploy-hardened.sh mainnet

# Deploy to local standalone network
./scripts/deploy-hardened.sh local
```

### Advanced Options

#### Dry Run Mode

Test deployment without actually deploying:

```bash
./scripts/deploy-hardened.sh testnet --dry-run
```

This validates:
- Prerequisites are met
- Configuration is correct
- Build succeeds
- No actual deployment occurs

#### Skip Verification Tests

Deploy without running post-deployment verification:

```bash
./scripts/deploy-hardened.sh testnet --skip-tests
```

**Warning**: Only use in development. Always verify production deployments.

### Deployment Output

The script generates several artifacts:

1. **Deployment JSON** (`deployed-contracts/<env>_deploy_<timestamp>_<pid>.json`):
   ```json
   {
     "deployment_id": "deploy_20260323_153045_12345",
     "environment": "testnet",
     "network": "testnet",
     "deployed_at": "2026-03-23T15:30:45Z",
     "deployer_address": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
     "contracts": {
       "rwa-defi-contract": {
         "contract_id": "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
         "wasm_file": "rwa_defi_contract.wasm",
         "wasm_size": "245K"
       }
     }
   }
   ```

2. **API Environment File** (`apps/api/.env.<environment>`):
   Contains contract IDs and network configuration for the API

3. **Webapp Environment File** (`apps/webapp/.env.<environment>.local`):
   Contains contract IDs and network configuration for the frontend

4. **Contract ID File** (`deployed-contracts/<env>_rwa-defi-contract.txt`):
   Simple text file with just the contract ID

5. **Deployment Log** (`logs/deployment-<environment>.log`):
   Complete log of the deployment process

### Manual Deployment (Advanced)

**Note**: Manual deployment is only recommended for advanced debugging or custom deployment scenarios. For normal use, prefer the automated `deploy-hardened.sh` script.

#### Prerequisites Check

```bash
# Verify stellar CLI
stellar --version

# Verify Rust and WASM target
cargo --version
rustup target list --installed | grep wasm32-unknown-unknown

# Verify account is configured
stellar keys address <your-account-name>

# Check account balance
stellar account info --account $(stellar keys address <your-account-name>) --network testnet
```

#### Build Contract

```bash
cd apps/contracts
cargo build --target wasm32-unknown-unknown --release
```

#### Deploy Contract

```bash
# Deploy to testnet
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/rwa_defi_contract.wasm \
  --source-account <your-account-name> \
  --network testnet \
  --rpc-url https://soroban-testnet.stellar.org)

echo "Contract ID: $CONTRACT_ID"
```

#### Verify Deployment

```bash
# Test contract is callable
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account <your-account-name> \
  --network testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  -- \
  hello \
  --to "deployment-test"
```

**Expected Output**: Should return `["Hello", "deployment-test"]`

#### Save Contract Information

```bash
# Save to deployment info directory
mkdir -p deployed-contracts
echo "$CONTRACT_ID" > deployed-contracts/testnet_rwa-defi-contract.txt

# Manually create environment files for apps
echo "RWA_DEFI_CONTRACT_ID=$CONTRACT_ID" >> apps/api/.env.testnet
echo "NEXT_PUBLIC_RWA_DEFI_CONTRACT_ID=$CONTRACT_ID" >> apps/webapp/.env.testnet.local
```

## Post-Deployment Configuration

The hardened deployment script automatically generates environment configuration files for both API and webapp. However, you need to activate them for your applications to use the deployed contracts.

### 1. Activate API Configuration

The deployment script creates `apps/api/.env.<environment>`. To use it:

**For Development**:
```bash
# Copy environment-specific config to .env
cp apps/api/.env.testnet apps/api/.env

# Or create a symlink
ln -sf .env.testnet apps/api/.env
```

**For Production**:
```bash
# Use environment-specific config directly
# Set NODE_ENV and load appropriate .env file in your deployment
```

**Verify Configuration**:
```bash
cd apps/api
bun run dev

# Check logs for loaded configuration
# Should see: "Using RWA_DEFI_CONTRACT_ID: CXXXXX..."
```

### 2. Activate Webapp Configuration

The deployment script creates `apps/webapp/.env.<environment>.local`. To use it:

**For Development**:
```bash
# Copy environment-specific config
cp apps/webapp/.env.testnet.local apps/webapp/.env.local

# Rebuild Next.js (required for environment variable changes)
cd apps/webapp
bun run build
bun run dev
```

**For Production**:
```bash
# Next.js loads .env.production.local automatically in production mode
cp apps/webapp/.env.mainnet.local apps/webapp/.env.production.local

# Build for production
bun run build
bun start
```

**Verify Configuration**:
```bash
# Open browser console and check
# Should see contract configuration logged on page load
```

### 3. Using Contract Configuration in Code

The deployment also created type-safe configuration modules:

**API Usage** (`apps/api/src/`):
```typescript
import { CONTRACTS, NETWORK_CONFIG, getContractId } from './config/contracts';

// Direct access (returns undefined if not configured)
const contractId = CONTRACTS.RWA_DEFI_CONTRACT_ID;

// Safe access (throws error if not configured)
const contractId = getContractId('rwa-defi');

// Network configuration
const rpcUrl = NETWORK_CONFIG.RPC_URL;
const network = NETWORK_CONFIG.NETWORK; // 'testnet', 'mainnet', etc.
```

**Webapp Usage** (`apps/webapp/src/`):
```typescript
import { CONTRACTS, NETWORK_CONFIG, useContractConfig } from '@/config/contracts';

// React component
function MyComponent() {
  const config = useContractConfig();

  if (!config) {
    return <div>Contract not configured. Please deploy contracts first.</div>;
  }

  const contractId = config.contracts.RWA_DEFI_CONTRACT_ID;
  const network = config.network.NETWORK;

  // Use contract ID...
}
```

### 4. Environment Variables Reference

**API Environment Variables** (`.env.testnet`, `.env.mainnet`):
```bash
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
RWA_DEFI_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Webapp Environment Variables** (`.env.testnet.local`, `.env.mainnet.local`):
```bash
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_RWA_DEFI_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Note**: Webapp variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.

## Deployment Verification

The hardened deployment script includes automatic verification, but you can also verify manually.

### 1. Verify Contract on Stellar Network

**Using Stellar CLI**:
```bash
# Get contract ID from deployment
CONTRACT_ID=$(cat deployed-contracts/testnet_rwa-defi-contract.txt)

# Invoke hello function to verify contract is callable
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source-account <your-account> \
  --network testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  -- \
  hello \
  --to "verification-test"
```

**Expected Output**: `["Hello", "verification-test"]`

**Using Stellar Expert** (Block Explorer):
```bash
# For testnet
https://stellar.expert/explorer/testnet/contract/<CONTRACT_ID>

# For mainnet
https://stellar.expert/explorer/public/contract/<CONTRACT_ID>
```

You should see:
- Contract creation transaction
- Contract code hash
- Recent contract invocations

### 2. Verify API Configuration

**Check environment is loaded**:
```bash
cd apps/api
cat .env | grep CONTRACT_ID
# Should show: RWA_DEFI_CONTRACT_ID=CXXXXXX...
```

**Test API can access contract**:
```bash
# Start API
cd apps/api
bun run dev

# Check health endpoint
curl http://localhost:3001/health

# Check logs for contract configuration
# Look for: "Loaded contract configuration: testnet, CXXXXXX..."
```

### 3. Verify Webapp Configuration

**Check environment is loaded**:
```bash
cd apps/webapp
cat .env.local | grep CONTRACT_ID
# Should show: NEXT_PUBLIC_RWA_DEFI_CONTRACT_ID=CXXXXXX...
```

**Test webapp build**:
```bash
cd apps/webapp
bun run build

# Verify no errors about missing environment variables
# Check that contract ID is embedded in build
```

### 4. End-to-End Integration Test

**Test full flow** (when frontend is implemented):
1. Open webapp in browser
2. Connect Stellar wallet
3. Attempt to interact with contract
4. Verify transaction succeeds on network

### 5. Verify Deployment Artifacts

**Check all deployment files were created**:
```bash
# Deployment JSON
ls -l deployed-contracts/*.json

# Environment files
ls -l apps/api/.env.*
ls -l apps/webapp/.env.*.local

# Logs
ls -l logs/deployment-*.log
```

**Verify deployment JSON content**:
```bash
cat deployed-contracts/testnet_deploy_*.json | jq .
```

Should show complete deployment metadata.

## Contract Upgrade and Redeployment

**Important**: Soroban smart contracts are immutable once deployed. "Upgrading" means deploying a new contract instance and updating application configuration to point to it.

### Upgrade Workflow

#### 1. Test Changes on Testnet

```bash
# Make code changes to contract
# Test thoroughly locally

# Deploy to testnet
./scripts/deploy-hardened.sh testnet

# Verify new contract works as expected
# Run full integration tests
```

#### 2. Plan Production Upgrade

Before deploying to mainnet:
- [ ] All tests pass on testnet
- [ ] Contract has been audited (if handling real assets)
- [ ] Rollback plan is documented
- [ ] Team is available for deployment
- [ ] Users are notified of maintenance (if applicable)

#### 3. Backup Current Production State

```bash
# Create backup directory
mkdir -p deployment-backups/$(date +%Y%m%d_%H%M%S)

# Backup current deployment info
cp deployed-contracts/mainnet_*.json deployment-backups/$(date +%Y%m%d_%H%M%S)/
cp apps/api/.env.mainnet deployment-backups/$(date +%Y%m%d_%H%M%S)/
cp apps/webapp/.env.mainnet.local deployment-backups/$(date +%Y%m%d_%H%M%S)/
```

#### 4. Deploy New Version

```bash
# Deploy to mainnet
./scripts/deploy-hardened.sh mainnet

# Verify deployment succeeded
# Contract ID will be different from previous version
```

#### 5. Update Applications

```bash
# API
cp apps/api/.env.mainnet apps/api/.env
systemctl restart akkuea-api

# Webapp
cp apps/webapp/.env.mainnet.local apps/webapp/.env.production.local
cd apps/webapp && bun run build && systemctl restart akkuea-webapp
```

#### 6. Verify and Monitor

```bash
# Check applications are using new contract
# Monitor logs for errors
# Test critical user flows
# Watch for unexpected behavior
```

#### 7. Rollback if Needed

See [rollback-procedures.md](./rollback-procedures.md) for detailed rollback instructions.

### Data Migration Considerations

Since contracts are immutable:

**Option 1: Fresh Start**
- Deploy new contract with empty state
- Users start fresh with new contract
- Previous contract remains accessible for historical data

**Option 2: Off-chain Migration**
- Export data from old contract
- Transform data format if needed
- Import to new contract (if it supports bulk import)
- This requires planning contract API for migration

**Option 3: Dual Contract Period**
- Run old and new contracts simultaneously
- Gradually migrate users
- Sunset old contract after migration complete

**Recommendation**: Design contracts for forward compatibility to minimize migration needs.

## Monitoring & Maintenance

### 1. Contract Monitoring

```bash
# Monitor contract events
stellar contract events \
  --contract-id $CONTRACT_ID \
  --network testnet \
  --follow
```

### 2. Performance Metrics

Track these metrics:

- **Transaction success rate**
- **Gas usage per operation**
- **Response times**
- **Error rates**

### 3. Security Monitoring

- Watch for unusual activity
- Monitor admin function calls
- Track large token transfers
- Verify contract state consistency

## Troubleshooting

### Common Issues

#### 1. Insufficient Balance

```bash
# Check account balance
stellar balance

# Fund testnet account
stellar account fund $(stellar keys address) --network testnet
```

#### 2. Contract Not Found

```bash
# Verify contract ID format
stellar contract info $CONTRACT_ID --network testnet
```

#### 3. Transaction Failed

```bash
# Get transaction details
stellar transaction --id $TRANSACTION_ID --network testnet
```

### Error Messages

- **"Insufficient fee"**: Increase transaction fee
- **"Contract not found"**: Verify contract ID and network
- **"Authorization failed"**: Check signing account
- **"Invalid argument"**: Verify function parameters

## Best Practices

### Pre-Deployment

1. **Test exhaustively on testnet** before any mainnet deployment
2. **Run dry-run mode** first: `./scripts/deploy-hardened.sh testnet --dry-run`
3. **Verify contract size** is under 1MB (enforced by build process)
4. **Code review** all contract changes with team
5. **Security audit** for production contracts handling real assets
6. **Document changes** in changelog

### During Deployment

1. **Use hardened deployment script** instead of manual deployment
2. **Monitor deployment output** for any warnings or errors
3. **Verify all artifacts** are generated (JSON, env files, logs)
4. **Save deployment ID** for reference
5. **Do not interrupt** deployment script mid-execution

### Post-Deployment

1. **Verify contract immediately** using provided verification steps
2. **Run smoke tests** to confirm basic functionality
3. **Monitor application logs** after configuration update
4. **Test critical user flows** end-to-end
5. **Keep deployment artifacts** for audit trail
6. **Document in changelog** with deployment ID and contract ID

### Configuration Management

1. **Use environment-specific .env files** (never hardcode contract IDs)
2. **Use the config modules** ([apps/api/src/config/contracts.ts](../../apps/api/src/config/contracts.ts), [apps/webapp/src/config/contracts.ts](../../apps/webapp/src/config/contracts.ts))
3. **Validate configuration** on application startup
4. **Never commit contract IDs** to code (keep in .env files)
5. **Version control .env.example** files with placeholders

### Security

1. **Protect deployment keys** - use Stellar CLI key storage
2. **Use hardware wallets** for mainnet deployments
3. **Implement multisig** for contract admin functions (when available)
4. **Regular security audits** for production contracts
5. **Monitor contract activity** for suspicious behavior
6. **Keep deployment scripts** in version control
7. **Review permissions** on deployment artifacts

### Operational

1. **Maintain deployment logs** for troubleshooting
2. **Keep rollback plans** current and tested
3. **Document all deployments** with metadata
4. **Regular backups** of deployment configurations
5. **Test rollback procedures** on testnet
6. **Team training** on deployment and rollback processes

### Emergency Procedures

1. **Know your rollback procedure** - see [rollback-procedures.md](./rollback-procedures.md)
2. **Have team contacts** available during deployments
3. **Prepare communication** templates for user notifications
4. **Test emergency procedures** regularly
5. **Document incidents** and update procedures

## Related Documentation

- **[Deployment Audit Report](./deployment-audit.md)** - Analysis of issues with previous deployment scripts
- **[Rollback Procedures](./rollback-procedures.md)** - Emergency rollback and redeploy procedures
- **[Configuration README](../../config/deployment/README.md)** - Environment configuration guide

---

This hardened deployment process ensures your smart contracts are safely deployed with full traceability, proper error handling, and integration with the entire Real Estate DeFi Platform.
