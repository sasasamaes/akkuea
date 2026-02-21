use sep_40_oracle::{Asset, PriceData, PriceFeedClient};
use soroban_sdk::{Address, Env};

use super::keys::LendingKey;

pub struct PriceOracle;

impl PriceOracle {
    pub fn set_oracle_address(env: &Env, oracle_address: &Address) {
        let key = LendingKey::OracleAddress;
        env.storage().instance().set(&key, oracle_address);
    }

    pub fn get_oracle_address(env: &Env) -> Address {
        let key = LendingKey::OracleAddress;
        env.storage()
            .instance()
            .get(&key)
            .expect("Oracle address not configured")
    }

    pub fn get_price(env: &Env, asset: &Address) -> i128 {
        let oracle_address = Self::get_oracle_address(env);
        let price_feed_client = PriceFeedClient::new(&env, &oracle_address);

        let asset_enum = Asset::Stellar(asset.clone());
        let price_data = price_feed_client
            .lastprice(&asset_enum)
            .expect("Price not available for asset");

        let current_time = env.ledger().timestamp();
        let max_age = 3600;

        if current_time > price_data.timestamp && (current_time - price_data.timestamp) > max_age {
            panic!("Price data is stale");
        }

        let oracle_decimals = price_feed_client.decimals();

        let decimals_diff = 18_i32 - oracle_decimals as i32;
        if decimals_diff >= 0 {
            let scale_factor = 10_i128.pow(decimals_diff as u32);
            price_data
                .price
                .checked_mul(scale_factor)
                .expect("Price Scaling overflow")
        } else {
            let scale_factor = 10_i128.pow((-decimals_diff) as u32);
            price_data.price / scale_factor
        }
    }

    pub fn get_raw_price_data(env: &Env, asset: &Address) -> PriceData {
        let oracle_address = Self::get_oracle_address(&env);
        let price_feed_client = PriceFeedClient::new(&env, &oracle_address);
        let asset_enum = Asset::Stellar(asset.clone());
        price_feed_client
            .lastprice(&asset_enum)
            .expect("Price not available for asset")
    }
}
