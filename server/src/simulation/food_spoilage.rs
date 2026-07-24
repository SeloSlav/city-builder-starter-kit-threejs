use spacetimedb::ReducerContext;

use crate::balance_generated::TICK_DT;
use crate::db::*;
use crate::season_policy::EnvironmentState;
use crate::tables::{Building, PlayerResources};

/// Fresh food decays everywhere it can be held. Preserved food, grain, flour,
/// honey, wine, and ale are deliberately excluded.
pub fn step_fresh_food_spoilage(ctx: &ReducerContext, environment: EnvironmentState) {
    let rate = environment.fresh_food_spoilage_fraction_per_second();
    if rate <= 0.0 {
        return;
    }

    for building in ctx.db.building().iter().collect::<Vec<Building>>() {
        if building.food <= 1e-9 {
            continue;
        }
        let storage_factor = match building.kind.as_str() {
            "granary" => 0.35,
            "smokehouse" => 0.55,
            "monastery" => 0.65,
            "marketplace" => 0.8,
            _ => 1.0,
        };
        let spoiled = building.food * rate * storage_factor * TICK_DT;
        ctx.db.building().id().update(Building {
            food: (building.food - spoiled).max(0.0),
            ..building
        });
    }

    for resources in ctx
        .db
        .player_resources()
        .iter()
        .collect::<Vec<PlayerResources>>()
    {
        if resources.food <= 1e-9 {
            continue;
        }
        let spoiled = resources.food * rate * 1.2 * TICK_DT;
        ctx.db.player_resources().owner().update(PlayerResources {
            food: (resources.food - spoiled).max(0.0),
            ..resources
        });
    }
}
