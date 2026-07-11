use spacetimedb::{Identity, ReducerContext};

use crate::db::*;
use crate::simulation::game_calendar::GameClock;

pub fn owner_has_staffed_chapel(ctx: &ReducerContext, owner: Identity) -> bool {
    ctx.db
        .building()
        .iter()
        .any(|building| building.owner == owner && building.kind == "chapel" && building.assigned_labor > 0)
}

pub fn owner_sabbath_observance_enabled(ctx: &ReducerContext, owner: Identity) -> bool {
    ctx.db
        .player_resources()
        .owner()
        .find(&owner)
        .map(|resources| resources.sabbath_observance_enabled)
        .unwrap_or(false)
}

pub fn labor_and_logistics_paused(
    ctx: &ReducerContext,
    owner: Identity,
    clock: &GameClock,
) -> bool {
    if !clock.is_work_hours {
        return true;
    }

    if !clock.is_sunday {
        return false;
    }

    if !owner_sabbath_observance_enabled(ctx, owner) {
        return false;
    }

    owner_has_staffed_chapel(ctx, owner)
}

pub fn labor_pause_reason(clock: &GameClock, sabbath_observance: bool, staffed_chapel: bool) -> Option<&'static str> {
    if !clock.is_work_hours {
        return Some("Night hours");
    }
    if clock.is_sunday && sabbath_observance && staffed_chapel {
        return Some("Sunday sabbath");
    }
    None
}
