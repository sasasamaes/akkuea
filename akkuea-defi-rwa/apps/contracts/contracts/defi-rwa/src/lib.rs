#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
    Property(u64),
    Shares(u64, Address),
    DistCount(u64),
    Dist(u64, u32),
    Claimed(u64, u32, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PropertyInfo {
    pub id: u64,
    pub admin: Address,
    pub total_shares: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Distribution {
    pub id: u32,
    pub property_id: u64,
    pub total_amount: i128,
    pub period: u64,
    pub total_shares: u32,
    pub claimed_amount: i128,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn register_property(env: Env, admin: Address, property_id: u64, total_shares: u32) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("not admin");
        }

        let info = PropertyInfo {
            id: property_id,
            admin: admin.clone(),
            total_shares,
        };
        env.storage().persistent().set(&DataKey::Property(property_id), &info);
        env.storage().persistent().set(&DataKey::DistCount(property_id), &0u32);

        env.events()
            .publish(("property", "registered"), (property_id, total_shares));
    }

    pub fn register_shareholder(
        env: Env,
        admin: Address,
        property_id: u64,
        holder: Address,
        shares: u32,
    ) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("not admin");
        }

        let _info: PropertyInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Property(property_id))
            .expect("property not found");

        env.storage()
            .persistent()
            .set(&DataKey::Shares(property_id, holder.clone()), &shares);

        env.events()
            .publish(("shareholder", "registered"), (property_id, holder, shares));
    }

    pub fn create_distribution(
        env: Env,
        admin: Address,
        property_id: u64,
        total_amount: i128,
        period: u64,
    ) -> u32 {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("not admin");
        }

        let info: PropertyInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Property(property_id))
            .expect("property not found");

        let dist_id: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::DistCount(property_id))
            .unwrap_or(0);

        let dist = Distribution {
            id: dist_id,
            property_id,
            total_amount,
            period,
            total_shares: info.total_shares,
            claimed_amount: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Dist(property_id, dist_id), &dist);
        env.storage()
            .persistent()
            .set(&DataKey::DistCount(property_id), &(dist_id + 1));

        env.events().publish(
            ("distribution", "created"),
            (property_id, dist_id, total_amount, period),
        );

        dist_id
    }

    pub fn claim_distribution(
        env: Env,
        holder: Address,
        property_id: u64,
        dist_id: u32,
    ) -> i128 {
        holder.require_auth();

        let claimed_key = DataKey::Claimed(property_id, dist_id, holder.clone());
        if env.storage().persistent().has(&claimed_key) {
            panic!("already claimed");
        }

        let shares: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Shares(property_id, holder.clone()))
            .expect("no shares registered");

        if shares == 0 {
            panic!("no shares registered");
        }

        let mut dist: Distribution = env
            .storage()
            .persistent()
            .get(&DataKey::Dist(property_id, dist_id))
            .expect("distribution not found");

        let amount = (dist.total_amount * shares as i128) / dist.total_shares as i128;

        dist.claimed_amount += amount;
        env.storage()
            .persistent()
            .set(&DataKey::Dist(property_id, dist_id), &dist);
        env.storage().persistent().set(&claimed_key, &true);

        env.events().publish(
            ("distribution", "claimed"),
            (property_id, dist_id, holder, amount),
        );

        amount
    }

    pub fn get_distribution(env: Env, property_id: u64, dist_id: u32) -> Distribution {
        env.storage()
            .persistent()
            .get(&DataKey::Dist(property_id, dist_id))
            .expect("distribution not found")
    }

    pub fn get_claimable(env: Env, holder: Address, property_id: u64, dist_id: u32) -> i128 {
        let claimed_key = DataKey::Claimed(property_id, dist_id, holder.clone());
        if env.storage().persistent().has(&claimed_key) {
            return 0;
        }

        let shares: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Shares(property_id, holder))
            .unwrap_or(0);

        if shares == 0 {
            return 0;
        }

        let dist: Distribution = match env
            .storage()
            .persistent()
            .get(&DataKey::Dist(property_id, dist_id))
        {
            Some(d) => d,
            None => return 0,
        };

        (dist.total_amount * shares as i128) / dist.total_shares as i128
    }
}

mod test;
