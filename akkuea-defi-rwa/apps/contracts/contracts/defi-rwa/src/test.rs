use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, IntoVal, String,
};

use crate::{
    InterestRateModel, LendingPoolContract, LendingPoolContractClient, PoolStorage,
    PositionStorage, PRECISION,
};

// ───────────────────────────────────────────────
// Helper: Register the contract + a token, mint, and return clients
// ───────────────────────────────────────────────

struct TestSetup<'a> {
    env: Env,
    admin: Address,
    token_address: Address,
    _token_admin: Address,
    contract_client: LendingPoolContractClient<'a>,
    contract_address: Address,
}

fn setup() -> TestSetup<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);

    // Deploy a Stellar Asset token
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address()
        .clone();

    // Deploy our lending pool contract
    let contract_address = env.register(LendingPoolContract, (&admin,));
    let contract_client = LendingPoolContractClient::new(&env, &contract_address);

    TestSetup {
        env,
        admin,
        token_address,
        _token_admin: token_admin,
        contract_client,
        contract_address,
    }
}

fn create_default_pool(setup: &TestSetup) -> String {
    let pool_id = String::from_str(&setup.env, "USDC-POOL");
    setup.contract_client.create_pool(
        &setup.admin,
        &pool_id,
        &String::from_str(&setup.env, "USDC Lending Pool"),
        &String::from_str(&setup.env, "USDC"),
        &setup.token_address,
        &750_000_000_000_000_000_i128, // 75% collateral factor
        &800_000_000_000_000_000_i128, // 80% liquidation threshold
        &50_000_000_000_000_000_i128,  // 5% liquidation penalty
        &1000_u32,                     // 10% reserve factor
    );
    pool_id
}

fn mint_tokens(setup: &TestSetup, to: &Address, amount: i128) {
    let sac = StellarAssetClient::new(&setup.env, &setup.token_address);
    sac.mint(to, &amount);
}

// ═══════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════

// ─── Pool creation ─────────────────────────────

#[test]
fn test_create_pool() {
    let s = setup();
    let pool_id = create_default_pool(&s);

    let pool = s.contract_client.get_pool(&pool_id);
    assert_eq!(pool.id, pool_id);
    assert_eq!(pool.collateral_factor, 750_000_000_000_000_000);
    assert_eq!(pool.liquidation_threshold, 800_000_000_000_000_000);
    assert_eq!(pool.liquidation_penalty, 50_000_000_000_000_000);
    assert_eq!(pool.reserve_factor, 1000);
    assert!(pool.is_active);
}

#[test]
#[should_panic(expected = "pool already exists")]
fn test_create_pool_duplicate() {
    let s = setup();
    create_default_pool(&s);
    // Second creation with same ID should panic
    create_default_pool(&s);
}

#[test]
#[should_panic(expected = "only admin")]
fn test_create_pool_unauthorized() {
    let s = setup();
    let non_admin = Address::generate(&s.env);
    let pool_id = String::from_str(&s.env, "BAD-POOL");
    s.contract_client.create_pool(
        &non_admin,
        &pool_id,
        &String::from_str(&s.env, "Bad Pool"),
        &String::from_str(&s.env, "BAD"),
        &s.token_address,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &1000_u32,
    );
}

// ─── Deposit ───────────────────────────────────

#[test]
fn test_deposit() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    let deposit_amount: i128 = 1_000_000_000; // 1000 tokens

    // Mint tokens to user
    mint_tokens(&s, &user, deposit_amount);

    // Deposit
    s.contract_client.deposit(&user, &pool_id, &deposit_amount);

    // Verify position
    let position = s.contract_client.get_deposit_position(&user, &pool_id);
    assert_eq!(position.amount, deposit_amount);
    assert_eq!(position.depositor, user);
    assert_eq!(position.pool_id, pool_id);

    // Verify total deposits
    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, deposit_amount);

    // Verify token balance moved to contract
    let token = TokenClient::new(&s.env, &s.token_address);
    assert_eq!(token.balance(&user), 0);
    assert_eq!(token.balance(&s.contract_address), deposit_amount);

    // Verify user deposits list
    let user_deposits = s.contract_client.get_user_deposits(&user);
    assert_eq!(user_deposits.len(), 1);
    assert!(user_deposits.contains(&pool_id));
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_deposit_zero_amount() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    s.contract_client.deposit(&user, &pool_id, &0_i128);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_deposit_negative_amount() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    s.contract_client.deposit(&user, &pool_id, &(-100_i128));
}

#[test]
#[should_panic(expected = "pool not found")]
fn test_deposit_nonexistent_pool() {
    let s = setup();
    let user = Address::generate(&s.env);
    let bad_pool = String::from_str(&s.env, "NOPE");
    s.contract_client.deposit(&user, &bad_pool, &100_i128);
}

#[test]
fn test_deposit_multiple_same_pool() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 2_000_000_000);

    // First deposit
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    // Second deposit into the same pool
    s.contract_client
        .deposit(&user, &pool_id, &500_000_000_i128);

    let position = s.contract_client.get_deposit_position(&user, &pool_id);
    assert_eq!(position.amount, 1_500_000_000);

    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, 1_500_000_000);

    // User deposits list should have the pool only once
    let user_deposits = s.contract_client.get_user_deposits(&user);
    assert_eq!(user_deposits.len(), 1);
}

#[test]
fn test_deposit_multiple_users() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user_a = Address::generate(&s.env);
    let user_b = Address::generate(&s.env);

    mint_tokens(&s, &user_a, 1_000_000_000);
    mint_tokens(&s, &user_b, 2_000_000_000);

    s.contract_client
        .deposit(&user_a, &pool_id, &1_000_000_000_i128);
    s.contract_client
        .deposit(&user_b, &pool_id, &2_000_000_000_i128);

    let pos_a = s.contract_client.get_deposit_position(&user_a, &pool_id);
    let pos_b = s.contract_client.get_deposit_position(&user_b, &pool_id);
    assert_eq!(pos_a.amount, 1_000_000_000);
    assert_eq!(pos_b.amount, 2_000_000_000);

    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, 3_000_000_000);
}

// ─── Withdraw ──────────────────────────────────

#[test]
fn test_withdraw_partial() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 1_000_000_000);
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    // Withdraw half
    s.contract_client
        .withdraw(&user, &pool_id, &500_000_000_i128);

    let position = s.contract_client.get_deposit_position(&user, &pool_id);
    assert_eq!(position.amount, 500_000_000);

    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, 500_000_000);

    let token = TokenClient::new(&s.env, &s.token_address);
    assert_eq!(token.balance(&user), 500_000_000);
    assert_eq!(token.balance(&s.contract_address), 500_000_000);
}

#[test]
fn test_withdraw_full_amount() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 1_000_000_000);
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    // Withdraw everything
    s.contract_client
        .withdraw(&user, &pool_id, &1_000_000_000_i128);

    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, 0);

    let token = TokenClient::new(&s.env, &s.token_address);
    assert_eq!(token.balance(&user), 1_000_000_000);
    assert_eq!(token.balance(&s.contract_address), 0);

    // User deposits list should be empty after full withdrawal
    let user_deposits = s.contract_client.get_user_deposits(&user);
    assert_eq!(user_deposits.len(), 0);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn test_withdraw_insufficient_balance() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 1_000_000_000);
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    // Try to withdraw more than deposited
    s.contract_client
        .withdraw(&user, &pool_id, &2_000_000_000_i128);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_withdraw_zero_amount() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    s.contract_client.withdraw(&user, &pool_id, &0_i128);
}

#[test]
#[should_panic(expected = "no deposit position")]
fn test_withdraw_no_position() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    // Never deposited – should panic
    s.contract_client.withdraw(&user, &pool_id, &100_i128);
}

// ─── Interest accrual ──────────────────────────

#[test]
fn test_accrue_interest() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 1_000_000_000);
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    let index_before = s.contract_client.get_interest_index(&pool_id);
    assert_eq!(index_before, PRECISION); // should start at 1e18

    // Simulate some borrows so interest accrues meaningfully
    // (without actual borrows, utilization=0 so only base rate applies)
    s.env.as_contract(&s.contract_address, || {
        PoolStorage::set_total_borrows(&s.env, &pool_id, 500_000_000);
    });

    // Advance time by 1 year
    let mut li = s.env.ledger().get();
    li.timestamp += 31_536_000; // 1 year in seconds
    s.env.ledger().set(li);

    // Accrue
    s.contract_client.accrue_interest(&pool_id);

    let index_after = s.contract_client.get_interest_index(&pool_id);
    assert!(
        index_after > index_before,
        "interest index should increase after time passes with borrows"
    );
}

#[test]
fn test_accrue_interest_no_time_elapsed() {
    let s = setup();
    let pool_id = create_default_pool(&s);

    let index_before = s.contract_client.get_interest_index(&pool_id);
    // Accrue with no time change – should be a no-op
    s.contract_client.accrue_interest(&pool_id);
    let index_after = s.contract_client.get_interest_index(&pool_id);
    assert_eq!(index_before, index_after);
}

#[test]
#[should_panic(expected = "pool not found")]
fn test_accrue_interest_nonexistent_pool() {
    let s = setup();
    let bad_pool = String::from_str(&s.env, "NOPE");
    s.contract_client.accrue_interest(&bad_pool);
}

// ─── Health factor precision ───────────────────

#[test]
fn test_health_factor_precision() {
    // Use token-unit values (not pre-scaled by PRECISION).
    // The function multiplies collateral_value * liquidation_threshold internally,
    // so values should be in raw token units.

    // collateral = 1000 tokens, debt = 800 tokens, LT = 80% (0.8 * PRECISION)
    let collateral: i128 = 1_000_000_000_000; // 1000 tokens with 9 decimals
    let debt: i128 = 800_000_000_000; // 800 tokens with 9 decimals
    let lt: i128 = 800_000_000_000_000_000; // 80% in PRECISION

    let hf = PositionStorage::calculate_health_factor(collateral, debt, lt);

    // Expected: (1000 * 0.8) / 800 = 1.0
    // Formula: (collateral * lt) / (debt * PRECISION)
    // = (1000e9 * 800e15) / (800e9 * 1e18)
    // = 800e24 / 800e27 = 1
    assert_eq!(hf, 1, "health factor should be 1 for balanced position");

    // Over-collateralized: collateral = 2000 tokens
    let collateral_2: i128 = 2_000_000_000_000;
    let hf_2 = PositionStorage::calculate_health_factor(collateral_2, debt, lt);
    assert!(hf_2 > 1, "over-collateralized position should have HF > 1");
    assert_eq!(hf_2, 2, "2000 * 0.8 / 800 = 2");

    // Under-collateralized: collateral = 500 tokens
    let collateral_3: i128 = 500_000_000_000;
    let hf_3 = PositionStorage::calculate_health_factor(collateral_3, debt, lt);
    assert_eq!(hf_3, 0, "under-collateralized position truncates to 0");

    // Zero debt → MAX
    let hf_zero = PositionStorage::calculate_health_factor(collateral, 0, lt);
    assert_eq!(hf_zero, i128::MAX);
}

// ─── Read-only views ───────────────────────────

#[test]
#[should_panic(expected = "pool not found")]
fn test_get_pool_nonexistent() {
    let s = setup();
    let bad_pool = String::from_str(&s.env, "NOPE");
    s.contract_client.get_pool(&bad_pool);
}

#[test]
fn test_get_total_deposits_and_borrows() {
    let s = setup();
    let pool_id = create_default_pool(&s);

    assert_eq!(s.contract_client.get_total_deposits(&pool_id), 0);
    assert_eq!(s.contract_client.get_total_borrows(&pool_id), 0);

    let user = Address::generate(&s.env);
    mint_tokens(&s, &user, 500_000_000);
    s.contract_client
        .deposit(&user, &pool_id, &500_000_000_i128);

    assert_eq!(s.contract_client.get_total_deposits(&pool_id), 500_000_000);
    assert_eq!(s.contract_client.get_total_borrows(&pool_id), 0);
}

// ─── Interest rate model (unit) ────────────────

#[test]
fn test_interest_rate_model_unit() {
    let model = InterestRateModel::default();

    // 0% utilization → base rate only
    let rate_0 = model.calculate_borrow_rate(0);
    assert_eq!(rate_0, model.base_rate);

    // Optimal (80%) → base + slope1
    let rate_opt = model.calculate_borrow_rate(model.optimal_utilization);
    assert_eq!(rate_opt, model.base_rate + model.slope1);

    // 100% utilization → higher than optimal
    let rate_100 = model.calculate_borrow_rate(PRECISION);
    assert!(rate_100 > rate_opt);

    // Monotonically increasing
    let rate_50 = model.calculate_borrow_rate(PRECISION / 2);
    let rate_90 = model.calculate_borrow_rate(900_000_000_000_000_000);
    assert!(rate_50 > rate_0);
    assert!(rate_90 > rate_opt);
    assert!(rate_100 > rate_90);
}

#[test]
fn test_supply_rate_less_than_borrow_rate() {
    let model = InterestRateModel::default();
    let utilization = PRECISION / 2;
    let reserve_factor = 100_000_000_000_000_000_i128; // 10%

    let borrow_rate = model.calculate_borrow_rate(utilization);
    let supply_rate = model.calculate_supply_rate(borrow_rate, utilization, reserve_factor);

    assert!(supply_rate < borrow_rate);
    assert!(supply_rate > 0);
}

// ─── Utilization & liquidity (unit) ────────────

#[test]
fn test_utilization_calculations() {
    assert_eq!(PoolStorage::calculate_utilization(1_000, 0), 0);
    assert_eq!(
        PoolStorage::calculate_utilization(1_000, 500),
        PRECISION / 2
    );
    assert_eq!(PoolStorage::calculate_utilization(1_000, 1_000), PRECISION);
    assert_eq!(PoolStorage::calculate_utilization(0, 100), 0);

    assert_eq!(PoolStorage::calculate_available_liquidity(1_000, 500), 500);
    assert_eq!(PoolStorage::calculate_available_liquidity(1_000, 1_000), 0);
    assert_eq!(PoolStorage::calculate_available_liquidity(1_000, 1_100), 0);
}

// ─── Deposit-then-withdraw round trip ──────────

#[test]
fn test_deposit_withdraw_round_trip() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    let amount: i128 = 5_000_000_000;

    mint_tokens(&s, &user, amount);

    let token = TokenClient::new(&s.env, &s.token_address);
    assert_eq!(token.balance(&user), amount);

    // Deposit all
    s.contract_client.deposit(&user, &pool_id, &amount);
    assert_eq!(token.balance(&user), 0);
    assert_eq!(token.balance(&s.contract_address), amount);

    // Withdraw all
    s.contract_client.withdraw(&user, &pool_id, &amount);
    assert_eq!(token.balance(&user), amount);
    assert_eq!(token.balance(&s.contract_address), 0);
    assert_eq!(s.contract_client.get_total_deposits(&pool_id), 0);
}

// ─── Multiple pools isolation ──────────────────

#[test]
fn test_multiple_pools_isolation() {
    let s = setup();

    // Create two pools with different tokens
    let token_admin_2 = Address::generate(&s.env);
    let token_address_2 = s
        .env
        .register_stellar_asset_contract_v2(token_admin_2.clone())
        .address()
        .clone();

    let pool_a = String::from_str(&s.env, "POOL-A");
    let pool_b = String::from_str(&s.env, "POOL-B");

    s.contract_client.create_pool(
        &s.admin,
        &pool_a,
        &String::from_str(&s.env, "Pool A"),
        &String::from_str(&s.env, "TKNA"),
        &s.token_address,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &1000_u32,
    );

    s.contract_client.create_pool(
        &s.admin,
        &pool_b,
        &String::from_str(&s.env, "Pool B"),
        &String::from_str(&s.env, "TKNB"),
        &token_address_2,
        &700_000_000_000_000_000_i128,
        &750_000_000_000_000_000_i128,
        &60_000_000_000_000_000_i128,
        &1200_u32,
    );

    let user = Address::generate(&s.env);
    mint_tokens(&s, &user, 1_000_000_000);
    let sac_b = StellarAssetClient::new(&s.env, &token_address_2);
    sac_b.mint(&user, &2_000_000_000);

    s.contract_client
        .deposit(&user, &pool_a, &1_000_000_000_i128);
    s.contract_client
        .deposit(&user, &pool_b, &2_000_000_000_i128);

    assert_eq!(s.contract_client.get_total_deposits(&pool_a), 1_000_000_000);
    assert_eq!(s.contract_client.get_total_deposits(&pool_b), 2_000_000_000);

    let pos_a = s.contract_client.get_deposit_position(&user, &pool_a);
    let pos_b = s.contract_client.get_deposit_position(&user, &pool_b);
    assert_eq!(pos_a.amount, 1_000_000_000);
    assert_eq!(pos_b.amount, 2_000_000_000);

    let user_deposits = s.contract_client.get_user_deposits(&user);
    assert_eq!(user_deposits.len(), 2);
}

// ─── Paused pool rejection (AC-6 / TR-3) ──────

#[test]
#[should_panic(expected = "pool is paused")]
fn test_deposit_paused_pool() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 1_000_000_000);

    // Pause the pool via internal storage
    s.env.as_contract(&s.contract_address, || {
        PoolStorage::set_paused(&s.env, &pool_id, true);
    });

    // Deposit should panic
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);
}

// ─── Event assertions (AC-7) ──────────────────

#[test]
fn test_deposit_emits_event() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    let amount: i128 = 500_000_000;

    mint_tokens(&s, &user, amount);
    s.contract_client.deposit(&user, &pool_id, &amount);

    // Check that a deposit event was emitted
    let events = s.env.events().all();
    let expected_topics = (symbol_short!("deposit"),).into_val(&s.env);
    let mut found = false;
    for i in 0..events.len() {
        let (_, topics, _) = events.get(i).unwrap();
        if topics == expected_topics {
            found = true;
            break;
        }
    }
    assert!(found, "should emit at least one deposit event");
}

#[test]
fn test_withdraw_emits_event() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    let amount: i128 = 500_000_000;

    mint_tokens(&s, &user, amount);
    s.contract_client.deposit(&user, &pool_id, &amount);
    s.contract_client.withdraw(&user, &pool_id, &amount);

    // Check that a withdraw event was emitted
    let events = s.env.events().all();
    let expected_topics = (symbol_short!("withdraw"),).into_val(&s.env);
    let mut found = false;
    for i in 0..events.len() {
        let (_, topics, _) = events.get(i).unwrap();
        if topics == expected_topics {
            found = true;
            break;
        }
    }
    assert!(found, "should emit at least one withdraw event");
}
