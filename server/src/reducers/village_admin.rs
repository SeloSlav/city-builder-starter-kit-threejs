use spacetimedb::{reducer, ReducerContext};

use crate::db::*;
use crate::economy::clamp_economic_activity_tax_rate;
use crate::lifecycle::ensure_player_resources;

#[reducer]
pub fn set_economic_activity_tax_rate(ctx: &ReducerContext, tax_rate: f64) -> Result<(), String> {
    let owner = ctx.sender();
    ensure_player_resources(ctx, owner);

    let clamped = clamp_economic_activity_tax_rate(tax_rate);
    let Some(mut resources) = ctx.db.player_resources().owner().find(&owner) else {
        return Err("Player resources not found.".to_string());
    };

    if (resources.economic_activity_tax_rate - clamped).abs() < 1e-9 {
        return Ok(());
    }

    resources.economic_activity_tax_rate = clamped;
    ctx.db.player_resources().owner().update(resources);
    Ok(())
}
