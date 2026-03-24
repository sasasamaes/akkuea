# Contract Deployment Rollback and Redeploy Procedures

**Document Version**: 1.0
**Last Updated**: 2026-03-23
**Related Issue**: C3-001

## Table of Contents

1. [Overview](#overview)
2. [Rollback Scenarios](#rollback-scenarios)
3. [Rollback Procedures](#rollback-procedures)
4. [Redeploy Procedures](#redeploy-procedures)
5. [Emergency Procedures](#emergency-procedures)
6. [Verification Checklist](#verification-checklist)

---

## Overview

This document outlines step-by-step procedures for rolling back failed deployments and redeploying smart contracts to the Stellar network. These procedures ensure minimal downtime and data integrity during contract updates.

### Important Concepts

- **Rollback**: Reverting application configuration to use a previous contract version
- **Redeploy**: Deploying a new instance of the contract
- **Contract Immutability**: Soroban contracts cannot be modified after deployment, only replaced

---

## Rollback Scenarios

### Scenario 1: Deployment Failed During Build

**Symptoms**:
- WASM build fails
- Contract size exceeds limits
- Compilation errors

**Impact**: No impact on production (deployment never started)

**Action**: Fix code issues and retry deployment

---

### Scenario 2: Deployment Failed During Upload

**Symptoms**:
- Network errors during contract deployment
- Insufficient balance errors
- Transaction failed errors

**Impact**: Partial deployment, no functional contracts deployed

**Action**: Check prerequisites and retry deployment

---

### Scenario 3: Deployment Succeeded But Contract Has Bugs

**Symptoms**:
- Contract deployed successfully
- Contract callable but returns incorrect results
- Contract fails on specific inputs
- Performance issues

**Impact**: Deployed contract is unusable but applications may have been updated

**Action**: Rollback application configuration to previous contract

---

### Scenario 4: Contract Deployed But Apps Cannot Connect

**Symptoms**:
- Contract verified and callable via CLI
- Frontend/API cannot invoke contract
- RPC connection errors
- Network configuration mismatch

**Impact**: Contract is fine, application configuration issue

**Action**: Fix application configuration, no rollback needed

---

## Rollback Procedures

### Rollback Type 1: Configuration Rollback (Most Common)

**When**: New contract has bugs, previous contract is still functional

**Steps**:

#### Step 1: Identify Previous Contract ID

```bash
# List all deployments for environment
ls -lt deployed-contracts/<environment>_*.json

# View previous deployment
cat deployed-contracts/<environment>_deploy_YYYYMMDD_HHMMSS_PID.json
```

Example output:
```json
{
  "deployment_id": "deploy_20260320_143022_12345",
  "contracts": {
    "rwa-defi-contract": {
      "contract_id": "CBQHNAXSI55GX2GN6D67GK7BHKQKJLZZ5CXZNMYNAQMRFCYWFQSM5DUR"
    }
  }
}
```

#### Step 2: Verify Previous Contract Is Still Functional

```bash
# Set previous contract ID
PREVIOUS_CONTRACT_ID="CBQHNAXSI55GX2GN6D67GK7BHKQKJLZZ5CXZNMYNAQMRFCYWFQSM5DUR"

# Test the contract
stellar contract invoke \
  --id "$PREVIOUS_CONTRACT_ID" \
  --source-account <your-account> \
  --network testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  -- \
  hello \
  --to "rollback-test"
```

Expected: Contract responds successfully

#### Step 3: Update Application Environment Files

**For API** (`apps/api/.env.<environment>`):
```bash
# Edit the API environment file
vim apps/api/.env.testnet

# Change contract ID to previous version
RWA_DEFI_CONTRACT_ID=CBQHNAXSI55GX2GN6D67GK7BHKQKJLZZ5CXZNMYNAQMRFCYWFQSM5DUR
```

**For Webapp** (`apps/webapp/.env.<environment>.local`):
```bash
# Edit the webapp environment file
vim apps/webapp/.env.testnet.local

# Change contract ID to previous version
NEXT_PUBLIC_RWA_DEFI_CONTRACT_ID=CBQHNAXSI55GX2GN6D67GK7BHKQKJLZZ5CXZNMYNAQMRFCYWFQSM5DUR
```

#### Step 4: Restart Applications

```bash
# Restart API
cd apps/api
bun run dev  # or your production start command

# Restart webapp
cd apps/webapp
bun run dev  # or your production start command
```

#### Step 5: Verify Rollback Success

```bash
# Test API endpoint
curl http://localhost:3001/health

# Test webapp loads correctly
# Open http://localhost:3000 in browser

# Verify correct contract is being used
# Check application logs for contract ID references
```

---

### Rollback Type 2: Full Redeploy (Data Migration Required)

**When**: New contract version has incompatible state, need to migrate data

**Warning**: This is complex and requires careful planning

#### Step 1: Export Data From New Contract

```bash
# Export all relevant state from the new contract
# This depends on your contract's data export functions
stellar contract invoke \
  --id "$NEW_CONTRACT_ID" \
  --network testnet \
  -- \
  export_all_data > contract_data_backup.json
```

#### Step 2: Configure Rollback

Follow "Configuration Rollback" steps above

#### Step 3: Import Data To Previous Contract

```bash
# If previous contract has import functions
stellar contract invoke \
  --id "$PREVIOUS_CONTRACT_ID" \
  --network testnet \
  -- \
  import_data \
  --data "$(cat contract_data_backup.json)"
```

**Note**: Most contracts won't support this. Plan data migration carefully before deployment.

---

## Redeploy Procedures

### When to Redeploy

- Bug fixes in contract code
- New features added
- Performance optimizations
- Security patches

### Redeploy Workflow

#### Step 1: Test Thoroughly on Testnet

```bash
# Deploy to testnet first
./scripts/deploy-hardened.sh testnet

# Run full integration test suite
# Verify all functionality works as expected
```

#### Step 2: Plan Production Deployment Window

- Schedule maintenance window if needed
- Notify users of potential downtime
- Prepare rollback plan
- Ensure team availability

#### Step 3: Backup Current Deployment Info

```bash
# Create backup of current deployment
mkdir -p deployment-backups
cp deployed-contracts/mainnet_*.json deployment-backups/
cp apps/api/.env.mainnet deployment-backups/api.env.mainnet.backup
cp apps/webapp/.env.mainnet.local deployment-backups/webapp.env.mainnet.local.backup
```

#### Step 4: Deploy to Production

```bash
# Deploy to mainnet
./scripts/deploy-hardened.sh mainnet

# Verify deployment succeeded
# Check deployment output for contract ID
```

#### Step 5: Update Applications Gradually (Blue-Green Deployment)

**Option A: Immediate Switch**
```bash
# Copy new environment files
cp apps/api/.env.mainnet apps/api/.env
cp apps/webapp/.env.mainnet.local apps/webapp/.env.local

# Restart services
systemctl restart akkuea-api
systemctl restart akkuea-webapp
```

**Option B: Gradual Migration**
```bash
# Update API first, keep webapp on old contract
# Monitor for errors
# If stable, update webapp
```

#### Step 6: Monitor Post-Deployment

```bash
# Watch API logs
tail -f /var/log/akkuea-api/app.log

# Watch webapp logs
tail -f /var/log/akkuea-webapp/app.log

# Monitor Stellar network transactions
# Check for unexpected errors or failures
```

#### Step 7: Validate Success

- Test all critical user flows
- Verify contract functions respond correctly
- Check error rates in monitoring
- Confirm no unexpected issues

---

## Emergency Procedures

### Emergency Rollback (Production Down)

**Scenario**: Production is completely broken after deployment

**Time Sensitivity**: Critical - complete within 5 minutes

#### Quick Rollback Steps

```bash
# 1. Restore backed up environment files (30 seconds)
cp deployment-backups/api.env.mainnet.backup apps/api/.env
cp deployment-backups/webapp.env.mainnet.local.backup apps/webapp/.env.local

# 2. Restart services immediately (1 minute)
systemctl restart akkuea-api
systemctl restart akkuea-webapp

# 3. Verify services are up (30 seconds)
curl http://api.akkuea.com/health
curl http://app.akkuea.com

# 4. Notify team and users (2 minutes)
# Send status update that system is restored

# 5. Begin post-mortem (after system stable)
# Investigate what went wrong
# Document lessons learned
```

---

## Verification Checklist

### Pre-Deployment Checklist

- [ ] All tests pass on testnet
- [ ] Contract size is under 1MB
- [ ] Deployment script runs successfully in dry-run mode
- [ ] Backup of current deployment created
- [ ] Rollback procedure documented and understood
- [ ] Team members available for deployment
- [ ] Monitoring and alerting configured

### Post-Deployment Checklist

- [ ] Contract deployed successfully
- [ ] Contract ID captured and saved
- [ ] Contract callable via stellar CLI
- [ ] API can connect to contract
- [ ] Webapp can connect to contract
- [ ] Critical user flows tested
- [ ] No errors in application logs
- [ ] Monitoring shows normal behavior
- [ ] Deployment documented in changelog

### Post-Rollback Checklist

- [ ] Applications pointing to previous contract ID
- [ ] Services restarted successfully
- [ ] Applications functioning normally
- [ ] Users can perform critical operations
- [ ] Incident documented
- [ ] Root cause identified
- [ ] Fix planned for next deployment

---

## Appendix: Common Issues and Solutions

### Issue: Cannot Find Previous Contract ID

**Solution**:
```bash
# Check Stellar Expert for your deployer address
# https://stellar.expert/explorer/testnet/account/<DEPLOYER_ADDRESS>
# View contract deployment transactions
# Extract contract IDs from transaction history
```

### Issue: Previous Contract No Longer Accessible

**Cause**: Contract may have been deleted or network issues

**Solution**:
- Check Stellar network status
- Verify contract ID is correct
- Check RPC endpoint is accessible
- If contract truly gone, must redeploy

### Issue: State Migration Needed

**Problem**: New contract version has different data structure

**Solution**:
- Export data from old contract (if possible)
- Transform data to new format (offline script)
- Deploy new contract
- Import transformed data to new contract
- This is complex - design for forward compatibility instead

### Issue: Rollback Causes Data Loss

**Problem**: New contract recorded state changes that old contract doesn't know about

**Solution**:
- This is why thorough testing is critical
- In emergency: Accept data loss, restore service
- Long-term: Implement state synchronization mechanisms
- Consider using off-chain data storage for critical state

---

## Support and Escalation

If you encounter issues not covered in this document:

1. **Check logs**: Review deployment logs in `logs/` directory
2. **Check Stellar network status**: https://status.stellar.org
3. **Consult team**: Reach out to senior developers
4. **Document the issue**: Add to this document for future reference

---

*This document should be updated after each deployment to reflect lessons learned and new procedures.*
