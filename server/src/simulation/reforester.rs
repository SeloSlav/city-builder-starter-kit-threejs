use spacetimedb::ReducerContext;

use crate::building_defs::building_def;
use crate::constants::{REFORESTER_REGROW_PER_SEC, TICK_DT};
use crate::db::*;
use crate::tables::{Building, TreeEntity};

pub fn step_reforester(ctx: &ReducerContext, building: Building) {
    let Some(def) = building_def(&building.kind) else {
        return;
    };
    if building.assigned_labor == 0 {
        return;
    }

    let work_radius = def.work_radius;
    let regrow_rate = REFORESTER_REGROW_PER_SEC * building.assigned_labor as f64;

    for tree in ctx.db.tree_entity().iter() {
        let dx = tree.x - building.x;
        let dz = tree.z - building.z;
        if dx * dx + dz * dz > work_radius * work_radius {
            continue;
        }

        match tree.phase.as_str() {
            "stump" => {
                ctx.db.tree_entity().tree_id().update(TreeEntity {
                    phase: "growing".to_string(),
                    growth_progress: regrow_rate * TICK_DT,
                    ..tree
                });
            }
            "growing" => {
                let progress = tree.growth_progress + regrow_rate * TICK_DT;
                if progress >= 1.0 {
                    ctx.db.tree_entity().tree_id().update(TreeEntity {
                        phase: "mature".to_string(),
                        growth_progress: 1.0,
                        ..tree
                    });
                } else {
                    ctx.db.tree_entity().tree_id().update(TreeEntity {
                        growth_progress: progress,
                        ..tree
                    });
                }
            }
            _ => {}
        }
    }
}
