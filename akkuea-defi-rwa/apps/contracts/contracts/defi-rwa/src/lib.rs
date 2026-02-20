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

use soroban_sdk::{contract, contractimpl, Address, Env, String};

#[cfg(test)]
mod test;

// Helper function: Convert u64 to Soroban String for Event mapping in no_std
fn u64_to_string(env: &Env, mut val: u64) -> String {
    if val == 0 {
        return String::from_str(env, "0");
    }
    let mut buffer = [0u8; 20];
    let mut i = 20;
    while val > 0 {
        i -= 1;
        buffer[i] = (val % 10) as u8 + b'0';
        val /= 10;
    }
    let slice = &buffer[i..20];
    String::from_str(env, core::str::from_utf8(slice).unwrap())
}

#[contract]
pub struct PropertyTokenContract;

#[contractimpl]
impl PropertyTokenContract {
    /// Mint shares to a recipient (Admin only)
    pub fn mint_shares(
        env: Env,
        admin: Address,
        property_id: u64,
        recipient: Address,
        amount: u64,
    ) {
        // Authorization check
        admin.require_auth();
        AdminControl::require_admin(&env, &admin);

        if amount == 0 {
            panic!("Amount must be greater than zero");
        }

        let total = get_total_shares(&env, property_id);
        let new_total = total.checked_add(amount).expect("Total shares overflow");
        set_total_shares(&env, property_id, new_total);

        increase_balance(&env, property_id, &recipient, amount);

        // Wire event emission
        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, admin, recipient, amount as i128);
    }

    /// Burn shares from owner
    pub fn burn_shares(env: Env, owner: Address, property_id: u64, amount: u64) {
        // Authorization check
        owner.require_auth();

        if amount == 0 {
            panic!("Amount must be greater than zero");
        }

        decrease_balance(&env, property_id, &owner, amount);

        let total = get_total_shares(&env, property_id);
        let new_total = total.checked_sub(amount).expect("Total shares underflow");
        set_total_shares(&env, property_id, new_total);

        // Wire event emission
        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, owner.clone(), owner, amount as i128);
    }

    /// Transfer shares between addresses
    pub fn transfer_shares(env: Env, from: Address, to: Address, property_id: u64, amount: u64) {
        // Authorization check
        from.require_auth();

        if amount == 0 {
            panic!("Amount must be greater than zero");
        }

        transfer_shares(&env, property_id, &from, &to, amount);

        // Wire event emission
        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, from, to, amount as i128);
    }

    /// Approve owner allowance to spender
    pub fn approve(env: Env, owner: Address, spender: Address, property_id: u64, amount: u64) {
        // Authorization check
        owner.require_auth();
        set_allowance(&env, property_id, &owner, &spender, amount);
    }

    /// Spend allowance directly to transfer shares
    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        property_id: u64,
        amount: u64,
    ) {
        // Authorization check
        spender.require_auth();

        if amount == 0 {
            panic!("Amount must be greater than zero");
        }

        spend_allowance(&env, property_id, &from, &spender, amount);
        transfer_shares(&env, property_id, &from, &to, amount);

        // Wire event emission
        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, from, to, amount as i128);
    }

    /// Query functions
    pub fn get_balance(env: Env, property_id: u64, owner: Address) -> u64 {
        get_balance(&env, property_id, &owner)
    }

    pub fn get_total_shares(env: Env, property_id: u64) -> u64 {
        get_total_shares(&env, property_id)
    }

    pub fn get_allowance(env: Env, property_id: u64, owner: Address, spender: Address) -> u64 {
        get_allowance(&env, property_id, &owner, &spender)
    }
}
