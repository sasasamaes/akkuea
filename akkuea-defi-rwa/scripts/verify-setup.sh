#!/bin/bash

##############################################################################
# Setup Verification Script
#
# Purpose: Verify all prerequisites for deployment are installed
# Usage: ./scripts/verify-setup.sh
##############################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Verifying deployment prerequisites...${NC}\n"

ERRORS=0

# Check Stellar CLI
if command -v stellar &> /dev/null; then
    echo -e "${GREEN}✓${NC} Stellar CLI installed: $(stellar --version | head -1)"
else
    echo -e "${RED}✗${NC} Stellar CLI not found"
    echo -e "  Install from: https://developers.stellar.org/docs/tools/developer-tools"
    ERRORS=$((ERRORS + 1))
fi

# Check Rust/Cargo
if command -v cargo &> /dev/null; then
    echo -e "${GREEN}✓${NC} Cargo installed: $(cargo --version)"
else
    echo -e "${RED}✗${NC} Cargo not found"
    echo -e "  Install from: https://rustup.rs"
    ERRORS=$((ERRORS + 1))
fi

# Check WASM target
if rustup target list --installed 2>/dev/null | grep -q wasm32-unknown-unknown; then
    echo -e "${GREEN}✓${NC} WASM target installed"
else
    echo -e "${YELLOW}⚠${NC} WASM target not installed"
    echo -e "  Run: rustup target add wasm32-unknown-unknown"
    ERRORS=$((ERRORS + 1))
fi

# Check Node/Bun for frontend/API
if command -v bun &> /dev/null; then
    echo -e "${GREEN}✓${NC} Bun installed: $(bun --version)"
elif command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC} Node.js installed: $(node --version)"
else
    echo -e "${YELLOW}⚠${NC} Neither Bun nor Node.js found"
    echo -e "  Install Bun from: https://bun.sh"
    echo -e "  Or Node.js from: https://nodejs.org"
fi

# Check Git
if command -v git &> /dev/null; then
    echo -e "${GREEN}✓${NC} Git installed: $(git --version | head -1)"
else
    echo -e "${RED}✗${NC} Git not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Summary
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All prerequisites verified!${NC}"
    echo -e "\nNext steps:"
    echo -e "  1. Generate Stellar keys: ${BLUE}stellar keys generate default --network testnet${NC}"
    echo -e "  2. Fund testnet account: ${BLUE}stellar account fund \$(stellar keys address default) --network testnet${NC}"
    echo -e "  3. Run deployment: ${BLUE}./scripts/deploy-hardened.sh testnet${NC}"
    exit 0
else
    echo -e "${RED}Found $ERRORS error(s). Please install missing prerequisites.${NC}"
    exit 1
fi
