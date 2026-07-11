use spacetimedb::ReducerContext;

use crate::db::*;
use crate::economy::{credit_treasury_gold, debit_residence_wealth};
use crate::simulation::chapel_community::{chapel_attendance_chance, chapel_tithe_gold_per_tick};
use crate::simulation::landmark_access::{is_chapel_staffed, residence_has_chapel_access};
use crate::simulation::tick_context::SimTickContext;
use crate::tables::{Building, Residence};

pub fn step_chapels(
    ctx: &ReducerContext,
    tick: &SimTickContext,
    sim_tick: u64,
    chapels: &[Building],
) {
    for residence in ctx.db.residence().iter() {
        if residence.abandoned || residence.population == 0 {
            continue;
        }

        if !residence_has_chapel_access(tick, residence.owner, &residence, chapels) {
            continue;
        }

        let Some(chapel) = find_serving_chapel(tick, &residence, chapels) else {
            continue;
        };

        let attendance_chance = chapel_attendance_chance(chapel.assigned_labor);
        if !roll_chapel_attendance(residence.id, sim_tick, attendance_chance) {
            continue;
        }

        let tithe_due = chapel_tithe_gold_per_tick(residence.population);
        let paid = debit_residence_wealth(ctx, &residence, tithe_due);
        if paid > 1e-9 {
            credit_treasury_gold(ctx, residence.owner, paid);
        }
    }
}

fn find_serving_chapel<'a>(
    tick: &SimTickContext,
    residence: &Residence,
    chapels: &'a [Building],
) -> Option<&'a Building> {
    chapels.iter().find(|chapel| {
        chapel.owner == residence.owner
            && is_chapel_staffed(chapel)
            && tick.road_connected(
                residence.owner,
                residence.x,
                residence.z,
                chapel.x,
                chapel.z,
            )
    })
}

fn roll_chapel_attendance(residence_id: u64, sim_tick: u64, chance: f64) -> bool {
    if chance <= 1e-9 {
        return false;
    }
    if chance >= 1.0 - 1e-9 {
        return true;
    }

    let hash = residence_id
        .wrapping_mul(0xD6E8_FEB8_6659_FD93)
        .wrapping_add(sim_tick.wrapping_mul(0xA5C6_5F3E_2B91_C7D1));
    let roll = (hash % 10_000) as f64 / 10_000.0;
    roll < chance
}
