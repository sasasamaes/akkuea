# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - C3-001: Harden Smart Contract Deployment and Initialization

#### Deployment Infrastructure
- **Hardened deployment script** (`scripts/deploy-hardened.sh`) with comprehensive error handling and validation
- **Environment-specific configuration** system in `config/deployment/` for testnet, mainnet, and local networks
- **Automatic contract address persistence** - deployments now save to JSON files and auto-generate app environment files
- **Deployment verification** and smoke tests built into deployment flow
- **Dry-run mode** for testing deployment without executing (`--dry-run` flag)
- **Deployment logging** with detailed logs saved to `logs/` directory

#### Configuration Management
- **Type-safe contract configuration modules**:
  - `apps/api/src/config/contracts.ts` - API contract configuration with validation
  - `apps/webapp/src/config/contracts.ts` - Frontend contract configuration with React hook
- **Network configuration presets** for testnet, mainnet, and standalone networks
- **Runtime validation** of contract configuration with helpful error messages
- **Environment variable overrides** for all configuration parameters

#### Documentation
- **Deployment Audit Report** (`docs/contracts/deployment-audit.md`) - Analysis of issues with previous deployment scripts
- **Rollback Procedures Guide** (`docs/contracts/rollback-procedures.md`) - Emergency rollback and redeploy procedures
- **Updated Deployment Guide** (`docs/contracts/deployment.md`) - Comprehensive guide aligned with new hardened process
- **Configuration README** (`config/deployment/README.md`) - Guide for environment configuration files

#### Security & Reliability
- **Prerequisites validation** - Script verifies Stellar CLI, Rust, WASM target, and account configuration before deployment
- **Account balance checks** - Validates sufficient XLM balance before attempting deployment
- **Contract size validation** - Enforces 1MB Soroban contract size limit
- **Network connectivity checks** - Verifies RPC endpoints are accessible
- **Atomic deployments** - All-or-nothing deployment with proper error handling
- **Deployment artifacts** - Complete audit trail with JSON metadata, environment files, and logs

#### Developer Experience
- **Colored terminal output** for improved readability
- **Progress indicators** for each deployment step
- **Comprehensive error messages** with actionable remediation steps
- **Deployment summary** with next steps and verification links
- **Automatic Stellar Expert links** for deployed contracts

### Changed

#### Deprecated Old Deployment Scripts
- `scripts/deploy.sh` - Replaced by `scripts/deploy-hardened.sh` (old script had multiple critical issues)
- `scripts/build.sh` - Build process now integrated into hardened deployment script

### Fixed

#### Issues Resolved from Deployment Audit
- **REQ-001**: Audited deployment scripts against actual contract API - Fixed binary name mismatches and non-existent function calls
- **REQ-002**: Implemented reproducible testnet deployment flow - Full automation with deterministic output
- **REQ-003**: Added environment-specific contract configuration - Separate configs for testnet/mainnet/local
- **REQ-004**: Implemented capture of deployed addresses - JSON files, env files, and text files generated automatically
- **REQ-005**: Added validation and failure handling - Comprehensive prerequisite checks and error messages
- **REQ-006**: Documented rollback and redeploy procedures - Complete guide with scenarios and workflows
- **REQ-007**: Frontend and API now safely consume deployed addresses - Type-safe configuration modules with validation

#### Specific Fixes
- Fixed contract binary name mismatch (`real_estate_defi_contracts.wasm` → `rwa_defi_contract.wasm`)
- Fixed non-existent contract function calls (removed calls to `initialize` that doesn't exist)
- Fixed unused RPC URL and network passphrase variables
- Fixed missing prerequisite validation
- Fixed lack of deployment verification
- Fixed missing error context in deployment failures
- Fixed documentation misalignment with actual contract structure

### Infrastructure

#### New Directories
- `config/deployment/` - Environment-specific deployment configurations
- `deployed-contracts/` - Deployment metadata and contract addresses (git-ignored)
- `logs/` - Deployment logs (git-ignored)
- `deployment-backups/` - Backup storage for rollback procedures (git-ignored)

#### New Files
- `deployed-contracts/.gitignore` - Ignore deployment artifacts
- `logs/.gitignore` - Ignore log files
- `deployment-backups/.gitignore` - Ignore backup files
- Updated `.gitignore` - Added deployment artifacts and environment files

---

## [0.0.0] - 2026-01-22

### Added
- Initial project structure
- Basic Soroban contract scaffold
- Next.js frontend application
- Elysia API backend
- Shared types and utilities
- Documentation structure
- CI/CD workflows for contracts, API, and webapp

---

**Note**: Deployment-related changes for C3-001 are comprehensive and represent a complete rewrite of the deployment infrastructure. The old deployment scripts should be considered deprecated and should not be used going forward.
