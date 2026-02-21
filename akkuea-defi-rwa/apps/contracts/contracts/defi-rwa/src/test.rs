use super::access::{AdminControl, PauseControl};
use super::*;
use sep_40_oracle::{Asset, PriceData};
use soroban_sdk::{testutils::Address as _, testutils::Events, Address, Env, String, Symbol};

// Created this contract just for testing storage
#[contract]
pub struct TestContract;

#[contractimpl]
impl TestContract {
    pub fn __constructor(_env: Env) {
        // Empty constructor
    }
}

// Mock Oracle Contract for Testing
// Implements SEP-40 Price Feed Oracle interface
#[contract]
pub struct MockOracleContract;

#[contractimpl]
impl MockOracleContract {
    /// Set a price for an asset (for testing purposes)
    pub fn set_price(env: Env, asset: Address, price: i128, timestamp: u64) {
        let key = (Symbol::new(&env, "price"), asset);
        let price_data = PriceData { price, timestamp };
        env.storage().persistent().set(&key, &price_data);
    }

    /// Get the last price for an asset (SEP-40 interface)
    pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        match asset {
            Asset::Stellar(addr) => {
                let key = (Symbol::new(&env, "price"), addr);
                env.storage().persistent().get(&key)
            }
            Asset::Other(_) => None,
        }
    }

    /// Get the number of decimals (SEP-40 interface)
    /// Returns 18 to match PRECISION
    pub fn decimals(_env: Env) -> u32 {
        18
    }

    /// Get the resolution (SEP-40 interface)
    pub fn resolution(_env: Env) -> u32 {
        1
    }

    /// Get base asset (SEP-40 interface)
    pub fn base(_env: Env) -> Asset {
        Asset::Other(Symbol::new(&_env, "USD"))
    }

    /// Get all assets (SEP-40 interface)
    pub fn assets(_env: Env) -> soroban_sdk::Vec<Asset> {
        soroban_sdk::Vec::new(&_env)
    }
}

fn setup() -> (Address, Env) {
    let env = Env::default();
    (env.register(TestContract, ()), env)
}

// Store and retrieve LendingPool

#[test]
fn test_store_and_retrieve_lending_pool() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());
    let asset_address = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: asset_address.clone(),
        collateral_factor: 750_000_000_000_000_000, // 75%
        liquidation_threshold: 800_000_000_000_000_000, // 80%
        liquidation_penalty: 50_000_000_000_000_000, // 5%
        reserve_factor: 1000,                       // 10%
        is_active: true,
        created_at: 1700000000,
    };

    // Store the pool
    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
    });

    // Verify pool exists
    let exists = env.as_contract(&contract_id, || PoolStorage::exists(&env, &pool_id));
    assert!(exists);

    // Retrieve and verify data integrity
    let retrieved = env.as_contract(&contract_id, || PoolStorage::get(&env, &pool_id).unwrap());
    assert_eq!(retrieved.id, pool.id);
    assert_eq!(retrieved.name, pool.name);
    assert_eq!(retrieved.asset, pool.asset);
    assert_eq!(retrieved.asset_address, pool.asset_address);
    assert_eq!(retrieved.collateral_factor, pool.collateral_factor);
    assert_eq!(retrieved.liquidation_threshold, pool.liquidation_threshold);
    assert_eq!(retrieved.liquidation_penalty, pool.liquidation_penalty);
    assert_eq!(retrieved.reserve_factor, pool.reserve_factor);
    assert_eq!(retrieved.is_active, pool.is_active);
    assert_eq!(retrieved.created_at, pool.created_at);
}

// Store and retrieve deposit position

#[test]
fn test_store_and_retrieve_deposit_position() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());
    let user = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    let position = DepositPosition {
        pool_id: pool_id.clone(),
        depositor: user.clone(),
        amount: 1_000_000_000, // 1000 USDC (6 decimals)
        shares: 1_000_000_000,
        index_at_deposit: PRECISION,
        deposited_at: 1700000000,
    };

    // Store deposit position
    env.as_contract(&contract_id, || {
        PositionStorage::set_deposit(&env, &position);
    });

    // Retrieve and verify correct values
    let retrieved = env.as_contract(&contract_id, || {
        PositionStorage::get_deposit(&env, &user, &pool_id).unwrap()
    });
    assert_eq!(retrieved.amount, 1_000_000_000);
    assert_eq!(retrieved.shares, 1_000_000_000);
    assert_eq!(retrieved.index_at_deposit, PRECISION);
    assert_eq!(retrieved.deposited_at, 1700000000);
    assert_eq!(retrieved.pool_id, pool_id);
    assert_eq!(retrieved.depositor, user);

    // Verify user deposits list
    let user_deposits = env.as_contract(&contract_id, || {
        PositionStorage::get_user_deposits(&env, &user)
    });
    assert_eq!(user_deposits.len(), 1);
    assert_eq!(user_deposits.get(0).unwrap(), pool_id);
}

#[test]
fn test_store_and_retrieve_borrow_position() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());
    let user = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");
    let collateral_asset = Address::generate(&env);

    let position = BorrowPosition {
        pool_id: pool_id.clone(),
        borrower: user.clone(),
        principal: 500_000_000, // 500 USDC
        index_at_borrow: PRECISION,
        collateral_amount: 1_000_000_000,
        collateral_asset: collateral_asset.clone(),
        borrowed_at: 1700000000,
    };

    // Store borrow position
    env.as_contract(&contract_id, || {
        PositionStorage::set_borrow(&env, &position);
    });

    // Retrieve and verify correct values
    let retrieved = env.as_contract(&contract_id, || {
        PositionStorage::get_borrow(&env, &user, &pool_id).unwrap()
    });
    assert_eq!(retrieved.principal, 500_000_000);
    assert_eq!(retrieved.index_at_borrow, PRECISION);
    assert_eq!(retrieved.collateral_amount, 1_000_000_000);
    assert_eq!(retrieved.collateral_asset, collateral_asset);
    assert_eq!(retrieved.borrowed_at, 1700000000);
    assert_eq!(retrieved.pool_id, pool_id);
    assert_eq!(retrieved.borrower, user);

    // Verify user borrows list
    let user_borrows = env.as_contract(&contract_id, || {
        PositionStorage::get_user_borrows(&env, &user)
    });
    assert_eq!(user_borrows.len(), 1);
    assert_eq!(user_borrows.get(0).unwrap(), pool_id);
}

// Interest rate calculation

#[test]
fn test_interest_rate_calculation() {
    let model = InterestRateModel::default();

    // Test at 0% utilization
    let rate_0 = model.calculate_borrow_rate(0);
    assert_eq!(rate_0, model.base_rate);

    // Test at optimal utilization (80%)
    let rate_optimal = model.calculate_borrow_rate(model.optimal_utilization);
    assert_eq!(rate_optimal, model.base_rate + model.slope1);

    // Test at 100% utilization
    let rate_100 = model.calculate_borrow_rate(PRECISION);
    assert!(rate_100 > rate_optimal);

    // Test at 50% utilization (below optimal)
    let utilization_50 = PRECISION / 2;
    let rate_50 = model.calculate_borrow_rate(utilization_50);
    assert!(rate_50 > model.base_rate);
    assert!(rate_50 < rate_optimal);

    // Test at 90% utilization (above optimal)
    let utilization_90 = 900_000_000_000_000_000; // 90%
    let rate_90 = model.calculate_borrow_rate(utilization_90);
    assert!(rate_90 > rate_optimal);
    assert!(rate_90 < rate_100);

    // Verify APY computation accuracy
    // APY = (1 + rate)^(SECONDS_PER_YEAR / time_elapsed) - 1
    // For simplicity, verify that rate increases with utilization
    let rate_20 = model.calculate_borrow_rate(200_000_000_000_000_000); // 20%
    let rate_40 = model.calculate_borrow_rate(400_000_000_000_000_000); // 40%
    assert!(rate_40 > rate_20);
}

#[test]
fn test_supply_rate_calculation() {
    let model = InterestRateModel::default();
    let utilization = 500_000_000_000_000_000; // 50%
    let reserve_factor = 100_000_000_000_000_000; // 10% in PRECISION units

    let borrow_rate = model.calculate_borrow_rate(utilization);
    let supply_rate = model.calculate_supply_rate(borrow_rate, utilization, reserve_factor);

    // Supply rate should be less than borrow rate due to reserve factor
    assert!(supply_rate < borrow_rate);
    assert!(supply_rate > 0);
}

// Utilization rate calculation

#[test]
fn test_utilization_rate_calculation() {
    // Test at 0% utilization (no borrows)
    let utilization_0 = PoolStorage::calculate_utilization(1_000_000_000, 0);
    assert_eq!(utilization_0, 0);

    // Test at 50% utilization
    let total_deposits = 1_000_000_000;
    let total_borrows = 500_000_000;
    let utilization_50 = PoolStorage::calculate_utilization(total_deposits, total_borrows);
    assert_eq!(utilization_50, PRECISION / 2);

    // Test at 100% utilization
    let utilization_100 = PoolStorage::calculate_utilization(total_deposits, total_deposits);
    assert_eq!(utilization_100, PRECISION);

    // Test at 75% utilization
    let total_borrows_75 = 750_000_000;
    let utilization_75 = PoolStorage::calculate_utilization(total_deposits, total_borrows_75);
    assert_eq!(utilization_75, 750_000_000_000_000_000);

    // Test with zero deposits
    let utilization_zero_deposits = PoolStorage::calculate_utilization(0, 100_000_000);
    assert_eq!(utilization_zero_deposits, 0);

    // Test available liquidity calculation
    let available = PoolStorage::calculate_available_liquidity(total_deposits, total_borrows);
    assert_eq!(available, 500_000_000);

    // Test available liquidity when fully utilized
    let available_full = PoolStorage::calculate_available_liquidity(total_deposits, total_deposits);
    assert_eq!(available_full, 0);

    // Test available liquidity when borrows exceed deposits
    let available_negative =
        PoolStorage::calculate_available_liquidity(total_deposits, total_deposits + 100);
    assert_eq!(available_negative, 0);
}

// Multiple pools storage

#[test]
fn test_multiple_pools_storage() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());
    let asset_address_1 = Address::generate(&env);
    let asset_address_2 = Address::generate(&env);
    let asset_address_3 = Address::generate(&env);

    let pool_id_1 = String::from_str(&env, "USDC-POOL");
    let pool_id_2 = String::from_str(&env, "USDT-POOL");
    let pool_id_3 = String::from_str(&env, "DAI-POOL");

    // Create and store first pool
    let pool_1 = LendingPool {
        id: pool_id_1.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: asset_address_1.clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: 1700000000,
    };
    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool_1);
        PoolStorage::add_to_list(&env, &pool_id_1);
    });

    // Create and store second pool
    let pool_2 = LendingPool {
        id: pool_id_2.clone(),
        name: String::from_str(&env, "USDT Lending Pool"),
        asset: String::from_str(&env, "USDT"),
        asset_address: asset_address_2.clone(),
        collateral_factor: 700_000_000_000_000_000, // Different value
        liquidation_threshold: 750_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1200, // Different value
        is_active: true,
        created_at: 1700000100,
    };
    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool_2);
        PoolStorage::add_to_list(&env, &pool_id_2);
    });

    // Create and store third pool
    let pool_3 = LendingPool {
        id: pool_id_3.clone(),
        name: String::from_str(&env, "DAI Lending Pool"),
        asset: String::from_str(&env, "DAI"),
        asset_address: asset_address_3.clone(),
        collateral_factor: 800_000_000_000_000_000,
        liquidation_threshold: 850_000_000_000_000_000,
        liquidation_penalty: 60_000_000_000_000_000,
        reserve_factor: 1500,
        is_active: false, // Different value
        created_at: 1700000200,
    };
    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool_3);
        PoolStorage::add_to_list(&env, &pool_id_3);
    });

    // Verify all pools exist
    let exists_1 = env.as_contract(&contract_id, || PoolStorage::exists(&env, &pool_id_1));
    let exists_2 = env.as_contract(&contract_id, || PoolStorage::exists(&env, &pool_id_2));
    let exists_3 = env.as_contract(&contract_id, || PoolStorage::exists(&env, &pool_id_3));
    assert!(exists_1);
    assert!(exists_2);
    assert!(exists_3);

    // Verify pools are isolated correctly - retrieve each and verify data integrity
    let retrieved_1 = env.as_contract(&contract_id, || PoolStorage::get(&env, &pool_id_1).unwrap());
    assert_eq!(retrieved_1.asset, String::from_str(&env, "USDC"));
    assert_eq!(retrieved_1.asset_address, asset_address_1);
    assert_eq!(retrieved_1.collateral_factor, 750_000_000_000_000_000);
    assert_eq!(retrieved_1.reserve_factor, 1000);

    let retrieved_2 = env.as_contract(&contract_id, || PoolStorage::get(&env, &pool_id_2).unwrap());
    assert_eq!(retrieved_2.asset, String::from_str(&env, "USDT"));
    assert_eq!(retrieved_2.asset_address, asset_address_2);
    assert_eq!(retrieved_2.collateral_factor, 700_000_000_000_000_000);
    assert_eq!(retrieved_2.reserve_factor, 1200);

    let retrieved_3 = env.as_contract(&contract_id, || PoolStorage::get(&env, &pool_id_3).unwrap());
    assert_eq!(retrieved_3.asset, String::from_str(&env, "DAI"));
    assert_eq!(retrieved_3.asset_address, asset_address_3);
    assert_eq!(retrieved_3.collateral_factor, 800_000_000_000_000_000);
    assert_eq!(retrieved_3.reserve_factor, 1500);
    assert!(!retrieved_3.is_active);

    // Verify pool list contains all pools
    let pool_list = env.as_contract(&contract_id, || PoolStorage::get_list(&env));
    assert!(pool_list.len() >= 3);
    assert!(pool_list.contains(&pool_id_1));
    assert!(pool_list.contains(&pool_id_2));
    assert!(pool_list.contains(&pool_id_3));

    // Test that pool-specific data is isolated
    env.as_contract(&contract_id, || {
        PoolStorage::set_total_deposits(&env, &pool_id_1, 1_000_000_000);
        PoolStorage::set_total_deposits(&env, &pool_id_2, 2_000_000_000);
        PoolStorage::set_total_deposits(&env, &pool_id_3, 3_000_000_000);
    });

    let deposits_1 = env.as_contract(&contract_id, || {
        PoolStorage::get_total_deposits(&env, &pool_id_1)
    });
    let deposits_2 = env.as_contract(&contract_id, || {
        PoolStorage::get_total_deposits(&env, &pool_id_2)
    });
    let deposits_3 = env.as_contract(&contract_id, || {
        PoolStorage::get_total_deposits(&env, &pool_id_3)
    });
    assert_eq!(deposits_1, 1_000_000_000);
    assert_eq!(deposits_2, 2_000_000_000);
    assert_eq!(deposits_3, 3_000_000_000);

    // Test that positions are isolated per pool
    let user_1 = Address::generate(&env);

    let deposit_1 = DepositPosition {
        pool_id: pool_id_1.clone(),
        depositor: user_1.clone(),
        amount: 100_000_000,
        shares: 100_000_000,
        index_at_deposit: PRECISION,
        deposited_at: 1700000000,
    };

    let deposit_2 = DepositPosition {
        pool_id: pool_id_2.clone(),
        depositor: user_1.clone(),
        amount: 200_000_000,
        shares: 200_000_000,
        index_at_deposit: PRECISION,
        deposited_at: 1700000100,
    };

    env.as_contract(&contract_id, || {
        PositionStorage::set_deposit(&env, &deposit_1);
        PositionStorage::set_deposit(&env, &deposit_2);
    });

    let retrieved_deposit_1 = env.as_contract(&contract_id, || {
        PositionStorage::get_deposit(&env, &user_1, &pool_id_1).unwrap()
    });
    let retrieved_deposit_2 = env.as_contract(&contract_id, || {
        PositionStorage::get_deposit(&env, &user_1, &pool_id_2).unwrap()
    });

    assert_eq!(retrieved_deposit_1.amount, 100_000_000);
    assert_eq!(retrieved_deposit_2.amount, 200_000_000);
    assert_eq!(retrieved_deposit_1.pool_id, pool_id_1);
    assert_eq!(retrieved_deposit_2.pool_id, pool_id_2);

    // Verify user has deposits in both pools
    let user_deposits = env.as_contract(&contract_id, || {
        PositionStorage::get_user_deposits(&env, &user_1)
    });
    assert!(user_deposits.len() >= 2);
    assert!(user_deposits.contains(&pool_id_1));
    assert!(user_deposits.contains(&pool_id_2));
}

#[test]
fn test_admin_initialization() {
    let (contract_id, env) = setup();
    let admin = Address::generate(&env);
    env.as_contract(&contract_id, || {
        AdminControl::initialize(&env, &admin);
        let expected_admin = AdminControl::get_admin(&env).unwrap();
        assert_eq!(admin, expected_admin);
    })
}

#[test]
#[should_panic(expected = "Caller not admin")]
fn test_require_admin_fails() {
    let (contract_id, env) = setup();
    let admin = Address::generate(&env);
    let other = Address::generate(&env);
    // AdminControl::initialize(&env.as_contract(&contract_id, f), &admin);
    env.as_contract(&contract_id, || {
        AdminControl::require_admin(&env, &admin);
        AdminControl::require_admin(&env, &other);
    });
}

#[test]
fn test_admin_transfer() {
    let (contract_id, env) = setup();
    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    env.as_contract(&contract_id, || {
        AdminControl::initialize(&env, &admin);

        // Start transfer
        AdminControl::transfer_admin_start(&env, &admin, &new_admin);
        assert_eq!(
            AdminControl::get_pending_admin(&env),
            Some(new_admin.clone())
        );

        // Accept transfer
        AdminControl::transfer_admin_accept(&env, &new_admin);
        assert!(AdminControl::is_admin(&env, &new_admin));
        assert!(!AdminControl::is_admin(&env, &admin));
    });
}

#[test]
fn test_pause_unpause() {
    let (contract_id, env) = setup();
    let admin = Address::generate(&env);
    env.as_contract(&contract_id, || {
        AdminControl::initialize(&env, &admin);
        assert!(!PauseControl::is_paused(&env));
        PauseControl::pause(&env, &admin);
        assert!(PauseControl::is_paused(&env));
        PauseControl::unpause(&env, &admin);
        assert!(!PauseControl::is_paused(&env));
    });
}

// =========================================================================
// Event Requirements Tests
// =========================================================================

#[test]
fn test_property_registration_event() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ()); // Fix: Register contract context

    let owner = Address::generate(&env);
    let property_id = String::from_str(&env, "PROP001");
    let name = String::from_str(&env, "Test Property");

    // Fix: Execute inside contract context
    env.as_contract(&contract_id, || {
        PropertyEvents::property_registered(
            &env,
            property_id.clone(),
            owner.clone(),
            name.clone(),
            100_000,
            1_000,
        );
    });

    // Check ONLY count
    let events = env.events().all();
    assert_eq!(events.events().len(), 1);
}

#[test]
fn test_share_transfer_event() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());

    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let property_id = String::from_str(&env, "PROP001");

    env.as_contract(&contract_id, || {
        PropertyEvents::share_transfer(&env, property_id.clone(), from.clone(), to.clone(), 500);
    });

    let events = env.events().all();
    assert_eq!(events.events().len(), 1);
}

#[test]
fn test_deposit_event() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());

    let depositor = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    env.as_contract(&contract_id, || {
        LendingEvents::deposit(
            &env,
            pool_id.clone(),
            depositor.clone(),
            1_000_000_000,
            1_000_000_000,
            5_000_000_000,
        );
    });

    let events = env.events().all();
    assert_eq!(events.events().len(), 1);
}

#[test]
fn test_borrow_event() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());

    let borrower = Address::generate(&env);
    let collateral_asset = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    env.as_contract(&contract_id, || {
        LendingEvents::borrow(
            &env,
            pool_id.clone(),
            borrower.clone(),
            500_000_000,
            1_000_000_000,
            collateral_asset.clone(),
            1500000000,
        );
    });

    let events = env.events().all();
    assert_eq!(events.events().len(), 1);
}

// =========================================================================
// Borrow Function Tests
// =========================================================================

#[test]
fn test_borrow_with_sufficient_collateral() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Register the main contract
    let contract_id = env.register(PropertyTokenContract, ());

    // Register mock oracle
    let oracle_id = env.register(MockOracleContract, ());

    // Create test accounts
    let borrower = Address::generate(&env);

    // Create mock tokens for pool asset (USDC) and collateral (XLM)
    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    // Setup: Initialize pool
    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000, // 75%
        liquidation_threshold: 800_000_000_000_000_000, // 80%
        liquidation_penalty: 50_000_000_000_000_000, // 5%
        reserve_factor: 1000,                       // 10%
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        // Store pool
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000); // 10,000 USDC
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        // Initialize interest rate model
        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        // Set oracle address
        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    // Set XLM price in oracle: $1.00 (1 * PRECISION = 1e18)
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION, // $1.00
            env.ledger().timestamp(),
        );
    });

    // Mint tokens
    usdc_token.mint(&borrower, &2_000_000_000); // 2000 USDC to borrower
    xlm_token.mint(&borrower, &2_000_000_000); // 2000 XLM to borrower
    usdc_token.mint(&contract_id, &10_000_000_000); // 10,000 USDC to contract for lending

    // Test parameters
    let borrow_amount = 1_000_000_000; // 1000 USDC
    let collateral_amount = 2_000_000_000; // 2000 XLM

    // Calculate expected health factor:
    // Collateral value = 2000 XLM * $1.00 = $2000
    // Debt value = 1000 USDC = $1000
    // Health factor = (2000 * 0.8) / 1000 = 1.6 * PRECISION > 1.5 * PRECISION ✓

    // Execute borrow
    let position = env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            borrow_amount,
            xlm_contract.address().clone(),
            collateral_amount,
        )
    });

    // Verify position was created correctly
    assert_eq!(position.borrower, borrower);
    assert_eq!(position.pool_id, pool_id);
    assert_eq!(position.principal, borrow_amount);
    assert_eq!(position.collateral_amount, collateral_amount);
    assert_eq!(position.collateral_asset, xlm_contract.address());
    assert_eq!(position.index_at_borrow, PRECISION);

    // Verify position is stored
    let stored_position = env.as_contract(&contract_id, || {
        PositionStorage::get_borrow(&env, &borrower, &pool_id)
    });
    assert!(stored_position.is_some());
    assert_eq!(stored_position.unwrap().principal, borrow_amount);

    // Verify collateral was transferred to contract
    let borrower_xlm_balance = xlm_token.balance(&borrower);
    assert_eq!(borrower_xlm_balance, 0); // All collateral locked

    let contract_xlm_balance = xlm_token.balance(&contract_id);
    assert_eq!(contract_xlm_balance, collateral_amount);

    // Verify borrowed USDC was transferred to borrower
    let borrower_usdc_balance = usdc_token.balance(&borrower);
    assert_eq!(borrower_usdc_balance, 2_000_000_000 + borrow_amount); // Initial + borrowed

    // Verify pool total borrows updated
    let total_borrows = env.as_contract(&contract_id, || {
        PoolStorage::get_total_borrows(&env, &pool_id)
    });
    assert_eq!(total_borrows, borrow_amount);

    // Test passed! Borrow function works correctly with sufficient collateral
}

#[test]
#[should_panic(expected = "Health factor too low")]
fn test_borrow_with_insufficient_collateral() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Register contracts
    let contract_id = env.register(PropertyTokenContract, ());
    let oracle_id = env.register(MockOracleContract, ());

    // Create test accounts
    let borrower = Address::generate(&env);

    // Create mock tokens
    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    // Setup pool
    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000, // 75%
        liquidation_threshold: 800_000_000_000_000_000, // 80%
        liquidation_penalty: 50_000_000_000_000_000, // 5%
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    // Set XLM price: $1.00
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION,
            env.ledger().timestamp(),
        );
    });

    // Mint tokens
    usdc_token.mint(&borrower, &1_000_000_000);
    xlm_token.mint(&borrower, &1_000_000_000); // Only 1000 XLM
    usdc_token.mint(&contract_id, &10_000_000_000);

    // Try to borrow with insufficient collateral
    // Collateral: 1000 XLM * $1.00 = $1000
    // Borrow: 1000 USDC = $1000
    // Health factor = (1000 * 0.8) / 1000 = 0.8 < 1.5 ❌
    let borrow_amount = 1_000_000_000; // 1000 USDC
    let collateral_amount = 1_000_000_000; // 1000 XLM (insufficient!)

    // This should panic with "Health factor too low"
    env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            borrow_amount,
            xlm_contract.address().clone(),
            collateral_amount,
        )
    });
}

#[test]
#[should_panic(expected = "Pool is paused")]
fn test_borrow_from_paused_pool() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Register contracts
    let contract_id = env.register(PropertyTokenContract, ());
    let oracle_id = env.register(MockOracleContract, ());

    // Create test accounts
    let borrower = Address::generate(&env);

    // Create mock tokens
    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    // Setup pool
    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PriceOracle::set_oracle_address(&env, &oracle_id);

        // PAUSE THE POOL
        PoolStorage::set_paused(&env, &pool_id, true);
    });

    // Set XLM price
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION,
            env.ledger().timestamp(),
        );
    });

    // Mint tokens
    usdc_token.mint(&borrower, &2_000_000_000);
    xlm_token.mint(&borrower, &2_000_000_000);
    usdc_token.mint(&contract_id, &10_000_000_000);

    // Try to borrow from paused pool - should panic
    let borrow_amount = 1_000_000_000;
    let collateral_amount = 2_000_000_000;

    env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            borrow_amount,
            xlm_contract.address().clone(),
            collateral_amount,
        )
    });
}

#[test]
#[should_panic(expected = "Insufficient liquidity")]
fn test_borrow_exceeding_liquidity() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Register contracts
    let contract_id = env.register(PropertyTokenContract, ());
    let oracle_id = env.register(MockOracleContract, ());

    // Create test accounts
    let borrower = Address::generate(&env);

    // Create mock tokens
    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    // Setup pool with limited liquidity
    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        // Only 1000 USDC available
        PoolStorage::set_total_deposits(&env, &pool_id, 1_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    // Set XLM price high so collateral is sufficient
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION * 10, // $10 per XLM
            env.ledger().timestamp(),
        );
    });

    // Mint tokens
    usdc_token.mint(&borrower, &5_000_000_000);
    xlm_token.mint(&borrower, &1_000_000_000); // 1000 XLM * $10 = $10,000 collateral
    usdc_token.mint(&contract_id, &1_000_000_000); // Only 1000 USDC in pool

    // Try to borrow more than available liquidity
    // Available: 1000 USDC
    // Trying to borrow: 2000 USDC (exceeds liquidity!)
    let borrow_amount = 2_000_000_000; // 2000 USDC
    let collateral_amount = 1_000_000_000; // 1000 XLM (worth $10,000, sufficient)

    env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            borrow_amount,
            xlm_contract.address().clone(),
            collateral_amount,
        )
    });
}

#[test]
fn test_health_factor_with_known_values() {
    // Test health factor calculation with precise known values

    // Test case 1: HF = 2.0
    // Collateral: $2000, Debt: $1000, LT: 100%
    let collateral_value_1 = 2_000_000_000; // 2000 in token units
    let debt_value_1 = 1_000_000_000; // 1000 in token units
    let lt_1 = PRECISION; // 100% = 1.0 * PRECISION
    let hf_1 = PositionStorage::calculate_health_factor(collateral_value_1, debt_value_1, lt_1);
    // Expected: (2000 * 1.0) / 1000 = 2.0 * PRECISION
    assert_eq!(hf_1, 2 * PRECISION);

    // Test case 2: HF = 1.6
    // Collateral: $2000, Debt: $1000, LT: 80%
    let collateral_value_2 = 2_000_000_000;
    let debt_value_2 = 1_000_000_000;
    let lt_2 = 800_000_000_000_000_000; // 80% = 0.8 * PRECISION
    let hf_2 = PositionStorage::calculate_health_factor(collateral_value_2, debt_value_2, lt_2);
    // Expected: (2000 * 0.8) / 1000 = 1.6 * PRECISION
    assert_eq!(hf_2, (16 * PRECISION) / 10);

    // Test case 3: HF = 0.8 (undercollateralized)
    // Collateral: $1000, Debt: $1000, LT: 80%
    let collateral_value_3 = 1_000_000_000;
    let debt_value_3 = 1_000_000_000;
    let lt_3 = 800_000_000_000_000_000;
    let hf_3 = PositionStorage::calculate_health_factor(collateral_value_3, debt_value_3, lt_3);
    // Expected: (1000 * 0.8) / 1000 = 0.8 * PRECISION
    assert_eq!(hf_3, (8 * PRECISION) / 10);

    // Test case 4: HF = 1.5 (exactly at minimum)
    // Collateral: $1500, Debt: $1000, LT: 100%
    let collateral_value_4 = 1_500_000_000;
    let debt_value_4 = 1_000_000_000;
    let lt_4 = PRECISION;
    let hf_4 = PositionStorage::calculate_health_factor(collateral_value_4, debt_value_4, lt_4);
    // Expected: (1500 * 1.0) / 1000 = 1.5 * PRECISION
    assert_eq!(hf_4, (15 * PRECISION) / 10);

    // Test case 5: HF = 1.0 (liquidation threshold)
    // Collateral: $1000, Debt: $1000, LT: 100%
    let collateral_value_5 = 1_000_000_000;
    let debt_value_5 = 1_000_000_000;
    let lt_5 = PRECISION;
    let hf_5 = PositionStorage::calculate_health_factor(collateral_value_5, debt_value_5, lt_5);
    // Expected: (1000 * 1.0) / 1000 = 1.0 * PRECISION
    assert_eq!(hf_5, PRECISION);

    // Test case 6: HF with zero debt (should return MAX)
    let collateral_value_6 = 1_000_000_000;
    let debt_value_6 = 0;
    let lt_6 = PRECISION;
    let hf_6 = PositionStorage::calculate_health_factor(collateral_value_6, debt_value_6, lt_6);
    assert_eq!(hf_6, i128::MAX);

    // Test case 7: Large values to test precision
    // Collateral: $1,000,000, Debt: $500,000, LT: 75%
    let collateral_value_7 = 1_000_000_000_000_000; // 1M with 9 decimals
    let debt_value_7 = 500_000_000_000_000; // 500K with 9 decimals
    let lt_7 = 750_000_000_000_000_000; // 75%
    let hf_7 = PositionStorage::calculate_health_factor(collateral_value_7, debt_value_7, lt_7);
    // Expected: (1M * 0.75) / 500K = 1.5 * PRECISION
    assert_eq!(hf_7, (15 * PRECISION) / 10);
}

#[test]
#[should_panic(expected = "Interest index is zero - invariant violation")]
fn test_borrow_with_zero_index() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Register contracts
    let contract_id = env.register(PropertyTokenContract, ());
    let oracle_id = env.register(MockOracleContract, ());

    // Create test accounts
    let borrower = Address::generate(&env);

    // Create mock tokens
    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    // Setup pool
    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);

        // SET INDEX TO ZERO - This should cause panic!
        InterestStorage::set_interest_index(&env, &pool_id, 0);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    // Set XLM price
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION,
            env.ledger().timestamp(),
        );
    });

    // Mint tokens
    usdc_token.mint(&borrower, &2_000_000_000);
    xlm_token.mint(&borrower, &2_000_000_000);
    usdc_token.mint(&contract_id, &10_000_000_000);

    // Try to borrow with zero index - should panic with invariant violation
    let borrow_amount = 1_000_000_000;
    let collateral_amount = 2_000_000_000;

    env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            borrow_amount,
            xlm_contract.address().clone(),
            collateral_amount,
        )
    });
}
