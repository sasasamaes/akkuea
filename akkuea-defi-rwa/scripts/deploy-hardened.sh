#!/bin/bash

##############################################################################
# Hardened Smart Contract Deployment Script
#
# Purpose: Production-grade deployment workflow for Soroban contracts
# Issue: C3-001 - Harden Smart Contract Deployment and Initialization
#
# Usage:
#   ./scripts/deploy-hardened.sh <environment> [options]
#
# Arguments:
#   environment    - testnet, mainnet, or local
#   --dry-run      - Simulate deployment without executing
#   --contract     - Specific contract name (default: all)
#   --skip-tests   - Skip post-deployment verification
#
# Examples:
#   ./scripts/deploy-hardened.sh testnet
#   ./scripts/deploy-hardened.sh testnet --dry-run
#   ./scripts/deploy-hardened.sh mainnet --contract rwa-defi-contract
##############################################################################

set -euo pipefail

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo ""
    echo -e "${GREEN}==>${NC} $1"
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

##############################################################################
# Argument Parsing
##############################################################################

ENVIRONMENT=${1:-}
DRY_RUN=false
SKIP_TESTS=false
SPECIFIC_CONTRACT=""

if [ -z "$ENVIRONMENT" ]; then
    error_exit "Environment is required. Usage: $0 <testnet|mainnet|local> [options]"
fi

shift

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --contract)
            SPECIFIC_CONTRACT="$2"
            shift 2
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

##############################################################################
# Load Configuration
##############################################################################

log_step "Loading configuration for environment: $ENVIRONMENT"

CONFIG_FILE="$PROJECT_ROOT/config/deployment/$ENVIRONMENT.env"

if [ ! -f "$CONFIG_FILE" ]; then
    error_exit "Configuration file not found: $CONFIG_FILE"
fi

# Source configuration
set -a
source "$CONFIG_FILE"
set +a

log_info "Configuration loaded from: $CONFIG_FILE"
log_info "Network: $STELLAR_NETWORK"
log_info "RPC URL: $STELLAR_RPC_URL"

if [ "$DRY_RUN" = true ]; then
    log_warning "DRY RUN MODE - No changes will be made"
fi

##############################################################################
# Prerequisites Validation
##############################################################################

log_step "Validating prerequisites"

# Check Stellar CLI
if ! command -v stellar &> /dev/null; then
    error_exit "Stellar CLI is not installed. Install from: https://stellar.org/docs/tools/developer-tools"
fi
log_success "Stellar CLI found: $(stellar --version)"

# Check Rust and Cargo
if ! command -v cargo &> /dev/null; then
    error_exit "Cargo is not installed. Install Rust from: https://rustup.rs"
fi
log_success "Cargo found: $(cargo --version)"

# Check WASM target
if ! rustup target list --installed | grep -q "$CONTRACT_BUILD_TARGET"; then
    log_warning "WASM target not installed. Installing..."
    rustup target add "$CONTRACT_BUILD_TARGET" || error_exit "Failed to install WASM target"
fi
log_success "WASM target verified: $CONTRACT_BUILD_TARGET"

# Validate Stellar account configuration
if ! stellar keys address "$DEPLOYMENT_ACCOUNT_NAME" &> /dev/null; then
    error_exit "Stellar account '$DEPLOYMENT_ACCOUNT_NAME' not configured. Run: stellar keys generate $DEPLOYMENT_ACCOUNT_NAME --network $STELLAR_NETWORK"
fi

DEPLOYER_ADDRESS=$(stellar keys address "$DEPLOYMENT_ACCOUNT_NAME")
log_success "Deployer account verified: $DEPLOYER_ADDRESS"

# Check account balance
log_info "Checking account balance..."
BALANCE_CHECK=$(stellar account info --account "$DEPLOYER_ADDRESS" --network "$STELLAR_NETWORK" 2>/dev/null || echo "FAILED")

if [ "$BALANCE_CHECK" = "FAILED" ]; then
    if [ "$STELLAR_NETWORK" = "testnet" ]; then
        log_warning "Account not funded. Attempting to fund from friendbot..."
        stellar account fund "$DEPLOYER_ADDRESS" --network "$STELLAR_NETWORK" || error_exit "Failed to fund account from friendbot"
        log_success "Account funded successfully"
    else
        error_exit "Account not found or not funded on $STELLAR_NETWORK"
    fi
else
    log_success "Account is funded and active"
fi

##############################################################################
# Build Contracts
##############################################################################

log_step "Building smart contracts"

cd "$PROJECT_ROOT/apps/contracts"

# Clean previous builds
log_info "Cleaning previous builds..."
cargo clean

# Build contracts in release mode
log_info "Building contracts in release mode..."
cargo build --target "$CONTRACT_BUILD_TARGET" --release || error_exit "Contract build failed"

# Verify WASM file exists
WASM_PATH="$PROJECT_ROOT/apps/contracts/target/$CONTRACT_BUILD_TARGET/release/$CONTRACT_WASM_NAME"

if [ ! -f "$WASM_PATH" ]; then
    error_exit "WASM file not found at: $WASM_PATH"
fi

WASM_SIZE=$(du -h "$WASM_PATH" | cut -f1)
log_success "Contract built successfully: $CONTRACT_WASM_NAME ($WASM_SIZE)"

# Verify WASM size is under 1MB limit
WASM_BYTES=$(stat -f%z "$WASM_PATH" 2>/dev/null || stat -c%s "$WASM_PATH")
if [ "$WASM_BYTES" -gt 1048576 ]; then
    error_exit "Contract size exceeds 1MB limit: $WASM_SIZE"
fi

##############################################################################
# Deployment Preparation
##############################################################################

log_step "Preparing deployment"

# Create deployment info directory
DEPLOYMENT_INFO_DIR="$PROJECT_ROOT/$DEPLOYMENT_INFO_DIR"
mkdir -p "$DEPLOYMENT_INFO_DIR"

# Create logs directory
LOG_DIR="$(dirname "$LOG_FILE")"
mkdir -p "$PROJECT_ROOT/$LOG_DIR"

# Generate deployment ID
DEPLOYMENT_ID="deploy_$(date +%Y%m%d_%H%M%S)_$$"
DEPLOYMENT_FILE="$DEPLOYMENT_INFO_DIR/${ENVIRONMENT}_${DEPLOYMENT_ID}.json"

log_info "Deployment ID: $DEPLOYMENT_ID"
log_info "Deployment info will be saved to: $DEPLOYMENT_FILE"

##############################################################################
# Deploy Contract
##############################################################################

deploy_contract() {
    local contract_name=$1
    local wasm_path=$2

    log_step "Deploying contract: $contract_name"

    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN: Would deploy $contract_name from $wasm_path"
        CONTRACT_ID="DRY_RUN_CONTRACT_ID_$(date +%s)"
    else
        log_info "Uploading WASM to network..."

        CONTRACT_ID=$(stellar contract deploy \
            --wasm "$wasm_path" \
            --source-account "$DEPLOYMENT_ACCOUNT_NAME" \
            --network "$STELLAR_NETWORK" \
            --rpc-url "$STELLAR_RPC_URL" 2>&1 | tee -a "$PROJECT_ROOT/$LOG_FILE")

        if [ -z "$CONTRACT_ID" ] || [[ "$CONTRACT_ID" == *"error"* ]]; then
            error_exit "Contract deployment failed. Check logs: $LOG_FILE"
        fi

        log_success "Contract deployed successfully"
    fi

    log_info "Contract ID: $CONTRACT_ID"

    # Store contract ID
    echo "$CONTRACT_ID" > "$DEPLOYMENT_INFO_DIR/${ENVIRONMENT}_${contract_name}.txt"

    # Update JSON deployment info
    cat > "$DEPLOYMENT_FILE" << EOF
{
  "deployment_id": "$DEPLOYMENT_ID",
  "environment": "$ENVIRONMENT",
  "network": "$STELLAR_NETWORK",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer_address": "$DEPLOYER_ADDRESS",
  "contracts": {
    "$contract_name": {
      "contract_id": "$CONTRACT_ID",
      "wasm_file": "$CONTRACT_WASM_NAME",
      "wasm_size": "$WASM_SIZE"
    }
  }
}
EOF

    log_success "Deployment info saved to: $DEPLOYMENT_FILE"

    # Return contract ID for verification
    echo "$CONTRACT_ID"
}

##############################################################################
# Deployment Verification
##############################################################################

verify_deployment() {
    local contract_id=$1
    local contract_name=$2

    if [ "$SKIP_TESTS" = true ] || [ "$DRY_RUN" = true ]; then
        log_warning "Skipping deployment verification"
        return 0
    fi

    log_step "Verifying deployment: $contract_name"

    log_info "Checking contract exists on network..."

    # Verify contract is callable by invoking the hello function
    VERIFY_RESULT=$(stellar contract invoke \
        --id "$contract_id" \
        --source-account "$DEPLOYMENT_ACCOUNT_NAME" \
        --network "$STELLAR_NETWORK" \
        --rpc-url "$STELLAR_RPC_URL" \
        -- \
        hello \
        --to "deployment-test" 2>&1 || echo "VERIFICATION_FAILED")

    if [[ "$VERIFY_RESULT" == *"VERIFICATION_FAILED"* ]] || [[ "$VERIFY_RESULT" == *"error"* ]]; then
        log_error "Contract verification failed"
        log_error "Result: $VERIFY_RESULT"
        error_exit "Deployment verification failed. Contract may not be properly deployed."
    fi

    log_success "Contract verified successfully"
    log_info "Test invocation result: $VERIFY_RESULT"
}

##############################################################################
# Main Deployment Flow
##############################################################################

log_step "Starting deployment process"

# Deploy the RWA DeFi contract
CONTRACT_ID=$(deploy_contract "rwa-defi-contract" "$WASM_PATH")

# Verify deployment
verify_deployment "$CONTRACT_ID" "rwa-defi-contract"

##############################################################################
# Generate Environment Files for Apps
##############################################################################

log_step "Generating environment files for applications"

# Generate .env file for API
API_ENV_FILE="$PROJECT_ROOT/apps/api/.env.${ENVIRONMENT}"
cat > "$API_ENV_FILE" << EOF
# Auto-generated by deployment script
# Deployment ID: $DEPLOYMENT_ID
# Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)

STELLAR_NETWORK=$STELLAR_NETWORK
STELLAR_RPC_URL=$STELLAR_RPC_URL
STELLAR_HORIZON_URL=$STELLAR_HORIZON_URL
STELLAR_NETWORK_PASSPHRASE=$STELLAR_NETWORK_PASSPHRASE

# Deployed Contracts
RWA_DEFI_CONTRACT_ID=$CONTRACT_ID
EOF

log_success "API environment file created: $API_ENV_FILE"

# Generate .env file for webapp
WEBAPP_ENV_FILE="$PROJECT_ROOT/apps/webapp/.env.${ENVIRONMENT}.local"
cat > "$WEBAPP_ENV_FILE" << EOF
# Auto-generated by deployment script
# Deployment ID: $DEPLOYMENT_ID
# Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)

NEXT_PUBLIC_STELLAR_NETWORK=$STELLAR_NETWORK
NEXT_PUBLIC_STELLAR_RPC_URL=$STELLAR_RPC_URL
NEXT_PUBLIC_STELLAR_HORIZON_URL=$STELLAR_HORIZON_URL
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=$STELLAR_NETWORK_PASSPHRASE

# Deployed Contracts
NEXT_PUBLIC_RWA_DEFI_CONTRACT_ID=$CONTRACT_ID
EOF

log_success "Webapp environment file created: $WEBAPP_ENV_FILE"

##############################################################################
# Deployment Summary
##############################################################################

log_step "Deployment Summary"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                     DEPLOYMENT SUCCESSFUL                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Environment:        $ENVIRONMENT"
echo "Network:            $STELLAR_NETWORK"
echo "Deployment ID:      $DEPLOYMENT_ID"
echo "Deployer:           $DEPLOYER_ADDRESS"
echo ""
echo "Deployed Contracts:"
echo "  RWA DeFi Contract: $CONTRACT_ID"
echo ""
echo "Deployment Info:    $DEPLOYMENT_FILE"
echo "API Config:         $API_ENV_FILE"
echo "Webapp Config:      $WEBAPP_ENV_FILE"
echo "Logs:               $PROJECT_ROOT/$LOG_FILE"
echo ""
echo "Next Steps:"
echo "  1. Verify contract on Stellar Expert:"
if [ "$STELLAR_NETWORK" = "testnet" ]; then
    echo "     https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
else
    echo "     https://stellar.expert/explorer/public/contract/$CONTRACT_ID"
fi
echo "  2. Copy the appropriate .env file to your app directories"
echo "  3. Restart your API and webapp services"
echo "  4. Run integration tests to verify end-to-end functionality"
echo ""

log_success "Deployment completed successfully!"

exit 0
