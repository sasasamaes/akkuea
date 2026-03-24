# Deployment Scripts Audit Report

**Issue**: C3-001 - Harden Smart Contract Deployment and Initialization
**Date**: 2026-03-23
**Auditor**: Development Team

## Executive Summary

This audit identifies critical misalignments between the deployment scripts and the actual contract implementation, along with missing production-grade features required for safe and reproducible deployments.

## Critical Issues Found

### 1. Contract Binary Name Mismatch

**Severity**: 🔴 Critical
**Location**: `scripts/deploy.sh` (lines 21, 47), `scripts/build.sh` (lines 19, 22)

**Issue**:
- Scripts reference `real_estate_defi_contracts.wasm` (plural)
- Actual Cargo.toml produces `rwa_defi_contract.wasm` (singular, different name)
- Build script attempts to build binaries `real_estate_token` and `defi_lending` that don't exist

**Actual Contract Config** (`apps/contracts/contracts/defi-rwa/Cargo.toml`):
```toml
[package]
name = "rwa-defi-contract"  # Produces rwa_defi_contract.wasm
```

**Impact**: Deployment will fail immediately as the WASM file cannot be found.

---

### 2. Non-existent Contract Functions

**Severity**: 🔴 Critical
**Location**: `scripts/deploy.sh` (lines 28-33, 54-59)

**Issue**:
- Scripts call `initialize` function on both contracts
- Actual contract only implements `hello(env: Env, to: String) -> Vec<String>`
- No initialization, admin setup, or any production functions exist

**Actual Contract API** (`apps/contracts/contracts/defi-rwa/src/lib.rs`):
```rust
#[contractimpl]
impl Contract {
    pub fn hello(env: Env, to: String) -> Vec<String> {
        vec![&env, String::from_str(&env, "Hello"), to]
    }
}
```

**Impact**: Contract invocation will fail, leaving contracts uninitialized and unusable.

---

### 3. Missing Environment Validation

**Severity**: 🟠 High
**Location**: `scripts/deploy.sh`, `scripts/build.sh`

**Issues**:
- No validation that Stellar CLI is installed
- No validation that keys are configured: `stellar keys address` could fail
- No validation of sufficient account balance
- No validation that network is accessible
- Missing Rust/Cargo availability checks

**Impact**: Scripts fail mid-execution with cryptic errors instead of clear prerequisite checks.

---

### 4. No Contract Address Persistence

**Severity**: 🟠 High
**Location**: `scripts/deploy.sh` (lines 25, 51)

**Issue**:
- Contract IDs are echoed to stdout only
- No structured output (JSON, .env file, or config file)
- Frontend and API have no mechanism to discover deployed addresses
- Manual copy-paste required, error-prone

**Current Behavior**:
```bash
echo "Real Estate Token Contract ID: $CONTRACT_ID"
```

**Impact**:
- Deployment information lost after terminal session closes
- No automated integration with apps
- Violates REQ-004 and REQ-007

---

### 5. Unused Configuration Variables

**Severity**: 🟡 Medium
**Location**: `scripts/deploy.sh` (lines 64-74)

**Issue**:
- `RPC_URL` and `NETWORK_PASSPHRASE` are set but never used
- Stellar CLI commands don't receive these parameters
- May use incorrect or default RPC endpoints

**Current Code**:
```bash
RPC_URL="https://soroban-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
# ... but these are never passed to stellar commands
```

**Impact**: Unreliable network targeting, potential deployments to wrong endpoints.

---

### 6. No Error Handling or Validation

**Severity**: 🟠 High
**Location**: All deployment scripts

**Issues**:
- `set -e` stops on first error but provides no context
- No deployment verification after contract deployment
- No smoke tests to confirm contract is callable
- No rollback mechanism on partial failures
- No dry-run or simulation mode

**Impact**: Failed deployments leave system in unknown state, difficult to debug.

---

### 7. No Environment-Specific Configuration

**Severity**: 🟡 Medium
**Location**: All scripts

**Issue**:
- No configuration files for different environments (dev, staging, prod)
- No way to persist environment-specific settings
- No override mechanism for RPC URLs, accounts, or gas limits

**Impact**: Cannot maintain multiple environment deployments, violates REQ-003.

---

### 8. Missing Documentation Alignment

**Severity**: 🟡 Medium
**Location**: `docs/contracts/deployment.md`

**Issues**:
- Documentation references contract files that don't exist:
  - `apps/contracts/src/real_estate_token.rs`
  - `apps/contracts/src/defi_lending.rs`
- Describes functions not implemented (`get_property_info`, `initialize`)
- Build commands don't match actual Cargo workspace structure

**Impact**: Developers following documentation will encounter immediate failures.

---

## Summary of Requirements Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| REQ-001: Audit scripts vs contract API | ❌ Failed | Multiple critical mismatches found |
| REQ-002: Reproducible testnet deployment | ❌ Failed | Scripts won't execute successfully |
| REQ-003: Environment-specific config | ❌ Missing | No configuration system exists |
| REQ-004: Capture deployed addresses | ❌ Missing | Only stdout logging, no persistence |
| REQ-005: Validation and error handling | ❌ Missing | Minimal validation, poor error messages |
| REQ-006: Rollback/redeploy docs | ❌ Missing | No procedures documented |
| REQ-007: Safe address consumption | ❌ Missing | No integration with apps |

---

## Recommendations

### Immediate Actions (Critical)

1. **Fix contract binary references** in all scripts
2. **Align function calls** with actual contract API
3. **Add prerequisite validation** before deployment attempts
4. **Implement address persistence** to structured files

### Production Hardening (High Priority)

1. **Create environment config system** (`.env.testnet`, `.env.mainnet`)
2. **Add deployment verification** and smoke tests
3. **Implement proper error handling** with actionable messages
4. **Create deployment state tracking** (what's deployed where)

### Documentation & Safety (Medium Priority)

1. **Document actual contract API** in deployment guide
2. **Create rollback procedures** with clear steps
3. **Add dry-run mode** for deployment validation
4. **Create integration guide** for apps to consume addresses

---

## Next Steps

See the implementation plan in the main issue for detailed tasks to address each finding.
