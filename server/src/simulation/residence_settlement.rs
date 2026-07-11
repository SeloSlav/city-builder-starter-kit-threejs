use spacetimedb::ReducerContext;

use crate::constants::RESIDENCE_SETTLE_TICKS;
use crate::db::*;
use crate::tables::Residence;

pub fn step_residence_settlement(ctx: &ReducerContext, residence: Residence) {
    if residence.abandoned || residence.population_capacity == 0 {
        return;
    }
    if residence.population >= residence.population_capacity {
        return;
    }

    let next_ticks = residence.settlement_ticks.saturating_add(1);
    if next_ticks < RESIDENCE_SETTLE_TICKS {
        ctx.db.residence().id().update(Residence {
            settlement_ticks: next_ticks,
            ..residence
        });
        return;
    }

    ctx.db.residence().id().update(Residence {
        population: residence.population.saturating_add(1),
        settlement_ticks: 0,
        ..residence
    });
}
