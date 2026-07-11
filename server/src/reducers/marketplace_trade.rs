use spacetimedb::{reducer, ReducerContext};

use crate::db::*;
use crate::economy::execute_marketplace_trade;
use crate::lifecycle::ensure_player_resources;

#[reducer]
pub fn marketplace_trade(
    ctx: &ReducerContext,
    building_id: u64,
    trade_id: String,
) -> Result<(), String> {
    let owner = ctx.sender();
    ensure_player_resources(ctx, owner);

    let building = ctx
        .db
        .building()
        .id()
        .find(&building_id)
        .ok_or_else(|| "Marketplace not found.".to_string())?;

    if building.owner != owner {
        return Err("You do not own this marketplace.".to_string());
    }

    if building.kind != "marketplace" {
        return Err("Only marketplaces can broker foreign trade.".to_string());
    }

    execute_marketplace_trade(ctx, owner, trade_id.trim())?;

    Ok(())
}
