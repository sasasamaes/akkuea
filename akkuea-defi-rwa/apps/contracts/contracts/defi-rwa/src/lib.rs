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
        vec![&env, String::from_str(&env, "Hello"), to]
    }

    /// Purchase shares of a property
    ///
    /// This function allows users to purchase property token shares by transferring
    /// payment tokens via SEP-41. The function validates the property exists, is verified,
    /// has available shares, calculates the total cost, transfers payment, mints shares,
    /// and emits a SharePurchase event.
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `buyer` - Address of the buyer (must be authorized)
    /// * `property_id` - ID of the property to purchase shares from
    /// * `amount` - Number of shares to purchase (must be positive)
    /// * `payment_token` - Address of the SEP-41 payment token contract
    ///
    /// # Panics
    /// Panics if:
    /// - Buyer is not authorized
    /// - Contract is paused
    /// - Property does not exist
    /// - Property is not verified
    /// - Property has no available shares
    /// - Amount is zero or exceeds available shares
    /// - Payment token transfer fails
    pub fn purchase_shares(
        env: Env,
        buyer: Address,
        property_id: u64,
        amount: u64,
        payment_token: Address,
    ) {
        buyer.require_auth();
        PauseControl::require_not_paused(&env);

        if amount == 0 {
            panic!("Amount must be positive");
        }

        let property = storage::property::PropertyMetadata::load(&env, property_id)
            .unwrap_or_else(|| panic!("Property not found"));

        if !storage::property::is_verified(&env, property_id) {
            panic!("Property is not verified");
        }

        let available_shares = storage::property::get_available_shares(&env, property_id);
        if available_shares == 0 {
            panic!("No shares available");
        }

        if amount > available_shares {
            panic!("Insufficient shares available");
        }

        let price_per_share = storage::property::get_price_per_share(&env, property_id);
        if price_per_share <= 0 {
            panic!("Price per share not set");
        }

        let total_cost = (amount as i128)
            .checked_mul(price_per_share)
            .expect("Cost calculation overflow");

        let token_client = token::Client::new(&env, &payment_token);
        token_client.transfer(&buyer, &property.owner, &total_cost);

        storage::shares::increase_balance(&env, property_id, &buyer, amount);
        storage::property::decrease_available_shares(&env, property_id, amount);

        let mut buffer = itoa::Buffer::new();
        let property_id_str = String::from_str(&env, buffer.format(property_id));
        PropertyEvents::share_purchase(
            &env,
            property_id_str,
            buyer,
            amount as i128,
            total_cost,
        );
    }
}
