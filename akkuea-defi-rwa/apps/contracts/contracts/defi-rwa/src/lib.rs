#![no_std]
//! # Property Tokenization Smart Contract
//!
//! This contract enables tokenization of real-world properties on the Stellar/Soroban blockchain.
//! It provides functionality for property registration, share management, and ownership tracking.

mod access;
mod events;
mod lending;
mod storage;

pub use access::*;
pub use events::*;
pub use lending::*;
pub use storage::*;

// Import necessary types for the contract (always available, not just in tests)
use soroban_sdk::{contract, contractimpl, token, vec, Address, Env, String, Vec};

#[cfg(test)]
mod test;

#[contract]
pub struct PropertyTokenContract;

#[contractimpl]
impl PropertyTokenContract {
    /// Placeholder function - will be replaced with actual contract logic
    pub fn hello(env: Env, to: String) -> Vec<String> {
        // vec![&env, String::from_str(&env, "Hello"), to]
        vec![&env, String::from_str(&env, "Hello"), to]
    }

    pub fn set_oracle(env: Env, oracle_address: Address, caller: Address) {
        // Todo: Admin auth check
        caller.require_auth();
        AdminControl::require_admin(&env, &caller);
        PriceOracle::set_oracle_address(&env, &oracle_address);
    }

    pub fn borrow(
        env: Env,
        borrower: Address,
        pool_id: String,
        amount: i128,
        collateral_asset: Address,
        collateral_amount: i128,
    ) -> BorrowPosition {
        borrower.require_auth();

        let pool = PoolStorage::get(&env, &pool_id).expect("Pool not found");
        if !pool.is_active {
            panic!("Pool is not active");
        }
        if PoolStorage::is_paused(&env, &pool_id) {
            panic!("Pool is paused");
        }

        let total_deposits = PoolStorage::get_total_deposits(&env, &pool_id);
        let total_borrows = PoolStorage::get_total_borrows(&env, &pool_id);
        let available = PoolStorage::calculate_available_liquidity(total_deposits, total_borrows);

        if amount > available {
            panic!("Insufficient liquidity");
        }

        let current_time = env.ledger().timestamp();
        let last_accrual = InterestStorage::get_last_accrual(&env, &pool_id);
        let time_elapsed = current_time - last_accrual;

        let current_index = InterestStorage::get_interest_index(&env, &pool_id);
        let model = InterestStorage::get_model(&env, &pool_id);
        let utilization = PoolStorage::calculate_utilization(total_deposits, total_borrows);
        let borrow_rate = model.calculate_borrow_rate(utilization);
        let new_index =
            InterestStorage::calculate_new_index(current_index, borrow_rate, time_elapsed);

        if new_index == 0 {
            panic!("Interest index is zero - invariant violation");
        }

        InterestStorage::set_interest_index(&env, &pool_id, new_index);
        InterestStorage::set_last_accrual(&env, &pool_id, current_time);

        // let collateral_price = PriceOracle::get_price(&env, &collateral_asset);
        let collateral_price = PriceOracle::get_price(&env, &collateral_asset);
        let collateral_value = (collateral_price * collateral_amount) / PRECISION;

        let debt_value = amount; // Initial debt is borrowed amount
        let health_factor = PositionStorage::calculate_health_factor(
            collateral_value,
            debt_value,
            pool.liquidation_threshold,
        );

        let min_health_factor = (15 * PRECISION) / 10; //1.5
        if health_factor < min_health_factor {
            panic!("Health factor too low");
        }

        let collateral_token = token::Client::new(&env, &collateral_asset);
        collateral_token.transfer(
            &borrower,
            env.current_contract_address(),
            &collateral_amount,
        );

        let pool_token = token::Client::new(&env, &pool.asset_address);
        pool_token.transfer(&env.current_contract_address(), &borrower, &amount);

        let position = BorrowPosition {
            pool_id: pool_id.clone(),
            borrower: borrower.clone(),
            principal: amount,
            index_at_borrow: new_index,
            collateral_amount,
            collateral_asset: collateral_asset.clone(),
            borrowed_at: current_time,
        };

        PositionStorage::set_borrow(&env, &position);
        PoolStorage::set_total_borrows(&env, &pool_id, total_borrows + amount);

        LendingEvents::borrow(
            &env,
            pool_id,
            borrower,
            amount,
            collateral_amount,
            collateral_asset,
            health_factor,
        );

        position
    }
}
