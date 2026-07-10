use spacetimedb::ReducerContext;

use crate::building_defs::building_def;
use crate::constants::{
    LODGE_FIREWOOD_PER_CYCLE, LODGE_TIMBER_PER_CYCLE, TICK_DT,
};
use crate::db::*;
use crate::economy::{building_storage_caps, deposit_building, withdraw_building};
use crate::simulation::tick_context::SimTickContext;
use crate::tables::{Building, Residence};

pub fn step_woodcutters_lodge(ctx: &ReducerContext, tick: &SimTickContext, building: Building) {
    let Some(def) = building_def(&building.kind) else {
        return;
    };

    let cooldown = (building.action_cooldown - TICK_DT).max(0.0);
    if cooldown > 0.0 {
        ctx.db.building().id().update(Building {
            action_cooldown: cooldown,
            ..building
        });
        return;
    }

    let mut lodge = building;
    if lodge.assigned_labor > 0 {
        lodge = process_timber_to_firewood(ctx, tick, lodge);
    }
    deliver_firewood_to_residences(ctx, tick, &mut lodge);
    lodge.action_cooldown = def.action_interval;
    ctx.db.building().id().update(lodge);
}

fn process_timber_to_firewood(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    lodge: Building,
) -> Building {
    let caps = building_storage_caps(&lodge.kind);
    if lodge.firewood >= caps.firewood - 1e-6 {
        return lodge;
    }

    let lodge = ensure_lodge_timber(ctx, tick, lodge, LODGE_TIMBER_PER_CYCLE);
    if lodge.timber + 1e-6 < LODGE_TIMBER_PER_CYCLE {
        return lodge;
    }

    let (_, _, _, lodge_after_withdraw) =
        withdraw_building(&lodge, LODGE_TIMBER_PER_CYCLE, 0.0, 0.0);
    let (_, firewood_added, _, processed) =
        deposit_building(&lodge_after_withdraw, caps, 0.0, LODGE_FIREWOOD_PER_CYCLE, 0.0);
    if firewood_added <= 0.0 {
        return lodge;
    }
    processed
}

fn ensure_lodge_timber(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    mut lodge: Building,
    needed: f64,
) -> Building {
    if lodge.timber + 1e-6 >= needed {
        return lodge;
    }

    let caps = building_storage_caps(&lodge.kind);
    let mut remaining = needed - lodge.timber;
    let mut mills: Vec<Building> = ctx
        .db
        .building()
        .owner()
        .filter(&lodge.owner)
        .filter(|row| {
            row.kind == "lumber_mill"
                && row.timber > 0.0
                && tick.road_connected(lodge.owner, row.x, row.z, lodge.x, lodge.z)
        })
        .collect();
    mills.sort_by(|a, b| {
        euclidean_distance_key(a.x, a.z, lodge.x, lodge.z)
            .partial_cmp(&euclidean_distance_key(b.x, b.z, lodge.x, lodge.z))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    for mill in mills {
        if remaining <= 1e-6 {
            break;
        }
        let lodge_room = (caps.timber - lodge.timber).max(0.0);
        if lodge_room <= 1e-6 {
            break;
        }
        let request = remaining.min(lodge_room).min(mill.timber);
        let (withdrawn, _, _, reduced_mill) = withdraw_building(&mill, request, 0.0, 0.0);
        if withdrawn <= 0.0 {
            continue;
        }
        ctx.db.building().id().update(reduced_mill);
        let (_, _, _, updated_lodge) = deposit_building(&lodge, caps, withdrawn, 0.0, 0.0);
        lodge = updated_lodge;
        remaining = needed - lodge.timber;
    }

    lodge
}

fn deliver_firewood_to_residences(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    lodge: &mut Building,
) {
    if lodge.firewood <= 0.0 {
        return;
    }

    let mut residences: Vec<Residence> = ctx
        .db
        .residence()
        .owner()
        .filter(&lodge.owner)
        .filter(|residence| !residence.abandoned)
        .collect();
    residences.sort_by(|a, b| {
        euclidean_distance_key(a.x, a.z, lodge.x, lodge.z)
            .partial_cmp(&euclidean_distance_key(b.x, b.z, lodge.x, lodge.z))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let capacity = crate::economy::residence_firewood_capacity();
    let mut available = lodge.firewood;
    for residence in residences {
        if available <= 1e-6 {
            break;
        }
        if !tick.road_connected(
            lodge.owner,
            residence.x,
            residence.z,
            lodge.x,
            lodge.z,
        ) {
            continue;
        }
        let room = (capacity - residence.firewood_stock).max(0.0);
        if room <= 1e-6 {
            continue;
        }
        let delivered = available.min(room);
        available -= delivered;
        ctx.db.residence().id().update(Residence {
            firewood_stock: residence.firewood_stock + delivered,
            needs_deficit_ticks: 0,
            ..residence
        });
    }

    lodge.firewood = available;
}

fn euclidean_distance_key(ax: f64, az: f64, bx: f64, bz: f64) -> f64 {
    ((ax - bx).powi(2) + (az - bz).powi(2)).sqrt()
}
