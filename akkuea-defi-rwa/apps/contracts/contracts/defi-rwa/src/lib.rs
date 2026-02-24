#![no_std]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::needless_borrows_for_generic_args)]
#![allow(deprecated)]

mod lending;

// Public re-exports for consumers and tests
pub use lending::{
    events::{DepositEvent, PoolCreatedEvent, WithdrawEvent},
    lending_bump, BorrowPosition, DepositPosition, InterestRateModel, InterestStorage, LendingKey,
    LendingPool, PoolStorage, PositionStorage, PRECISION, SECONDS_PER_YEAR,
};

use soroban_sdk::{contract, contractimpl, token, Address, Env, String, Vec};

// Internal imports (non-overlapping with pub use)
use lending::events;

// ───────────────────────────────────────────────
// Contract definition
// ───────────────────────────────────────────────

#[contract]
pub struct LendingPoolContract;

// ───────────────────────────────────────────────
// Admin helpers
// ───────────────────────────────────────────────

fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&LendingKey::Admin)
        .expect("admin not set")
}

fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&LendingKey::Admin, admin);
    env.storage()
        .instance()
        .extend_ttl(lending_bump::INSTANCE_BUMP, lending_bump::INSTANCE_BUMP);
}

fn require_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    let admin = get_admin(env);
    if *caller != admin {
        panic!("only admin");
    }
}

// ───────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────

/// Accrue interest for a pool – updates the global interest index, reserves,
/// and last-accrual timestamp. Safe to call multiple times in the same ledger.
fn accrue_interest_internal(env: &Env, pool_id: &String) {
    let last_accrual = InterestStorage::get_last_accrual(env, pool_id);
    let now = env.ledger().timestamp();

    if now <= last_accrual {
        return;
    }

    let time_elapsed = now - last_accrual;
    let total_deposits = PoolStorage::get_total_deposits(env, pool_id);
    let total_borrows = PoolStorage::get_total_borrows(env, pool_id);

    if total_deposits == 0 {
        InterestStorage::set_last_accrual(env, pool_id, now);
        return;
    }

    let utilization = PoolStorage::calculate_utilization(total_deposits, total_borrows);
    let model = InterestStorage::get_model(env, pool_id);
    let borrow_rate = model.calculate_borrow_rate(utilization);

    // Update interest index
    let current_index = InterestStorage::get_interest_index(env, pool_id);
    let new_index = InterestStorage::calculate_new_index(current_index, borrow_rate, time_elapsed);
    InterestStorage::set_interest_index(env, pool_id, new_index);

    // Calculate and add reserve income
    if total_borrows > 0 {
        let pool = PoolStorage::get(env, pool_id).expect("pool must exist");
        let reserve_factor_precision = (pool.reserve_factor as i128) * PRECISION / 10_000; // basis points → PRECISION
        let interest_income = (total_borrows * (new_index - current_index)) / current_index;
        let reserve_income = (interest_income * reserve_factor_precision) / PRECISION;
        if reserve_income > 0 {
            PoolStorage::add_reserves(env, pool_id, reserve_income);
        }
    }

    InterestStorage::set_last_accrual(env, pool_id, now);
}

// ───────────────────────────────────────────────
// Contract implementation
// ───────────────────────────────────────────────

#[contractimpl]
impl LendingPoolContract {
    // ─── Constructor ───────────────────────────
    /// Initialize the contract with an admin address.
    pub fn __constructor(env: Env, admin: Address) {
        set_admin(&env, &admin);
    }

    // ─── Admin functions ───────────────────────

    /// Create a new lending pool.
    ///
    /// # Arguments
    /// * `admin` – must match the stored admin and `require_auth()`
    /// * `pool_id` – unique pool identifier
    /// * `name` – human readable name
    /// * `asset` – symbol (e.g. "USDC")
    /// * `asset_address` – SEP-41 token contract address
    /// * `collateral_factor` – in PRECISION units (e.g. 75 % = 0.75 × 10^18)
    /// * `liquidation_threshold` – in PRECISION units
    /// * `liquidation_penalty` – in PRECISION units
    /// * `reserve_factor` – in basis points (e.g. 1000 = 10 %)
    #[allow(clippy::too_many_arguments)]
    pub fn create_pool(
        env: Env,
        admin: Address,
        pool_id: String,
        name: String,
        asset: String,
        asset_address: Address,
        collateral_factor: i128,
        liquidation_threshold: i128,
        liquidation_penalty: i128,
        reserve_factor: u32,
    ) {
        require_admin(&env, &admin);

        // Pool must not exist already
        if PoolStorage::exists(&env, &pool_id) {
            panic!("pool already exists");
        }

        let pool = LendingPool {
            id: pool_id.clone(),
            name,
            asset,
            asset_address,
            collateral_factor,
            liquidation_threshold,
            liquidation_penalty,
            reserve_factor,
            is_active: true,
            created_at: env.ledger().timestamp(),
        };

        PoolStorage::set(&env, &pool);
        PoolStorage::add_to_list(&env, &pool_id);

        // Initialize interest model and index
        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        // Initialize totals
        PoolStorage::set_total_deposits(&env, &pool_id, 0);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        events::emit_pool_created(&env, &admin, &pool_id);
    }

    // ─── User functions ────────────────────────

    /// Deposit tokens into a lending pool.
    ///
    /// Transfers `amount` of the pool's underlying asset from `depositor`
    /// to the contract, creates / updates the deposit position, and
    /// updates the pool's total deposits.
    pub fn deposit(env: Env, depositor: Address, pool_id: String, amount: i128) {
        depositor.require_auth();

        // Validations
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let pool = PoolStorage::get(&env, &pool_id).expect("pool not found");
        if !pool.is_active {
            panic!("pool is not active");
        }
        if PoolStorage::is_paused(&env, &pool_id) {
            panic!("pool is paused");
        }

        // Accrue interest before mutating state
        accrue_interest_internal(&env, &pool_id);

        // SEP-41 token transfer: depositor → contract
        let token_client = token::Client::new(&env, &pool.asset_address);
        token_client.transfer(&depositor, &env.current_contract_address(), &amount);

        // Get current interest index for the position snapshot
        let current_index = InterestStorage::get_interest_index(&env, &pool_id);

        // Create or update deposit position
        match PositionStorage::get_deposit(&env, &depositor, &pool_id) {
            Some(mut existing) => {
                // Weighted-average index for the combined position
                let total_amount = existing.amount + amount;
                existing.index_at_deposit = ((existing.amount * existing.index_at_deposit)
                    + (amount * current_index))
                    / total_amount;
                existing.amount = total_amount;
                existing.shares = total_amount; // 1:1 for now
                PositionStorage::set_deposit(&env, &existing);
            }
            None => {
                let position = DepositPosition {
                    pool_id: pool_id.clone(),
                    depositor: depositor.clone(),
                    amount,
                    shares: amount, // 1:1 initial
                    index_at_deposit: current_index,
                    deposited_at: env.ledger().timestamp(),
                };
                PositionStorage::set_deposit(&env, &position);
            }
        }

        // Update pool total deposits
        let total = PoolStorage::get_total_deposits(&env, &pool_id);
        PoolStorage::set_total_deposits(&env, &pool_id, total + amount);

        events::emit_deposit(&env, &depositor, &pool_id, amount);
    }

    /// Withdraw tokens from a lending pool.
    ///
    /// Transfers `amount` of the pool's underlying asset from the contract
    /// back to `depositor`, updates or removes the deposit position, and
    /// updates the pool's total deposits.
    pub fn withdraw(env: Env, depositor: Address, pool_id: String, amount: i128) {
        depositor.require_auth();

        // Validations
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let pool = PoolStorage::get(&env, &pool_id).expect("pool not found");

        // Accrue interest before mutating state
        accrue_interest_internal(&env, &pool_id);

        // Get the deposit position
        let position =
            PositionStorage::get_deposit(&env, &depositor, &pool_id).expect("no deposit position");

        // Calculate accrued interest
        let accrued = PositionStorage::calculate_deposit_interest(&env, &position);
        let total_available = position.amount + accrued;

        if amount > total_available {
            panic!("insufficient balance");
        }

        // Check pool liquidity
        let total_deposits = PoolStorage::get_total_deposits(&env, &pool_id);
        let total_borrows = PoolStorage::get_total_borrows(&env, &pool_id);
        let available_liquidity =
            PoolStorage::calculate_available_liquidity(total_deposits, total_borrows);
        if amount > available_liquidity {
            panic!("insufficient pool liquidity");
        }

        // SEP-41 token transfer: contract → depositor
        let token_client = token::Client::new(&env, &pool.asset_address);
        token_client.transfer(&env.current_contract_address(), &depositor, &amount);

        // Update or remove position
        if amount >= total_available {
            // Full withdrawal – remove position entirely
            PositionStorage::remove_deposit(&env, &depositor, &pool_id);
        } else {
            // Partial withdrawal
            let mut updated = position;
            updated.amount = total_available - amount;
            updated.shares = updated.amount; // 1:1
            updated.index_at_deposit = InterestStorage::get_interest_index(&env, &pool_id);
            PositionStorage::set_deposit(&env, &updated);
        }

        // Update pool total deposits
        PoolStorage::set_total_deposits(&env, &pool_id, total_deposits - amount);

        events::emit_withdraw(&env, &depositor, &pool_id, amount);
    }

    // ─── Public interest accrual ───────────────

    /// Accrue interest for a pool. Anyone may call this.
    pub fn accrue_interest(env: Env, pool_id: String) {
        if !PoolStorage::exists(&env, &pool_id) {
            panic!("pool not found");
        }
        accrue_interest_internal(&env, &pool_id);
    }

    // ─── Read-only views ───────────────────────

    /// Return pool metadata.
    pub fn get_pool(env: Env, pool_id: String) -> LendingPool {
        PoolStorage::get(&env, &pool_id).expect("pool not found")
    }

    /// Return the pool IDs a user has deposited into.
    pub fn get_user_deposits(env: Env, user: Address) -> Vec<String> {
        PositionStorage::get_user_deposits(&env, &user)
    }

    /// Return total deposits for a pool.
    pub fn get_total_deposits(env: Env, pool_id: String) -> i128 {
        PoolStorage::get_total_deposits(&env, &pool_id)
    }

    /// Return total borrows for a pool.
    pub fn get_total_borrows(env: Env, pool_id: String) -> i128 {
        PoolStorage::get_total_borrows(&env, &pool_id)
    }

    /// Return the current interest index for a pool.
    pub fn get_interest_index(env: Env, pool_id: String) -> i128 {
        InterestStorage::get_interest_index(&env, &pool_id)
    }

    /// Return a user's deposit position in a pool.
    pub fn get_deposit_position(env: Env, user: Address, pool_id: String) -> DepositPosition {
        PositionStorage::get_deposit(&env, &user, &pool_id).expect("no deposit position")
    }
}

#[cfg(test)]
mod test;
