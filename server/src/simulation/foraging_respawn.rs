use spacetimedb::ReducerContext;

use crate::constants::{
    BERRIES_RESPAWN_RADIUS, BERRIES_RESPAWN_SEC, GAME_RESPAWN_SEC, TICK_DT,
};
use crate::db::*;
use crate::tables::ForagingNode;
use crate::world_gen;

pub fn step_foraging_respawn(ctx: &ReducerContext) {
    for node in ctx.db.foraging_node().iter() {
        if node.remaining > 0.0 {
            if node.respawn_cooldown > 0.0 {
                ctx.db.foraging_node().node_id().update(ForagingNode {
                    respawn_cooldown: 0.0,
                    ..node
                });
            }
            continue;
        }

        let cooldown = (node.respawn_cooldown - TICK_DT).max(0.0);
        if cooldown > 0.0 {
            ctx.db.foraging_node().node_id().update(ForagingNode {
                respawn_cooldown: cooldown,
                ..node
            });
            continue;
        }

        let respawn_target = match node.node_kind.as_str() {
            "game" => respawn_game_location(ctx, &node),
            "berries" => Some(respawn_berries_location(ctx, &node)),
            _ => None,
        };

        let Some((x, z)) = respawn_target else {
            let retry_after = match node.node_kind.as_str() {
                "game" => GAME_RESPAWN_SEC,
                "berries" => BERRIES_RESPAWN_SEC,
                _ => GAME_RESPAWN_SEC,
            };
            ctx.db.foraging_node().node_id().update(ForagingNode {
                respawn_cooldown: retry_after,
                ..node
            });
            continue;
        };

        ctx.db.foraging_node().node_id().update(ForagingNode {
            x,
            z,
            remaining: node.max_yield,
            respawn_cooldown: 0.0,
            ..node
        });
    }
}

fn respawn_game_location(ctx: &ReducerContext, node: &ForagingNode) -> Option<(f64, f64)> {
    let candidates = world_gen::game_respawn_candidates();
    if candidates.is_empty() {
        return None;
    }
    let tick = ctx
        .db
        .world_config()
        .id()
        .find(&0)
        .map(|config| config.sim_tick)
        .unwrap_or(0);
    let index = (tick as usize + node.node_id.len()) % candidates.len();
    let point = &candidates[index];
    Some((point.x, point.z))
}

fn respawn_berries_location(ctx: &ReducerContext, node: &ForagingNode) -> (f64, f64) {
    let tick = ctx
        .db
        .world_config()
        .id()
        .find(&0)
        .map(|config| config.sim_tick)
        .unwrap_or(0);
    let angle = ((tick % 360) as f64).to_radians() + node.anchor_x * 0.01;
    let radius = BERRIES_RESPAWN_RADIUS * (0.35 + ((tick % 17) as f64) / 34.0);
    (
        node.anchor_x + angle.cos() * radius,
        node.anchor_z + angle.sin() * radius,
    )
}

pub fn mark_foraging_depleted(ctx: &ReducerContext, node: ForagingNode) {
    let cooldown = match node.node_kind.as_str() {
        "game" => GAME_RESPAWN_SEC,
        "berries" => BERRIES_RESPAWN_SEC,
        _ => GAME_RESPAWN_SEC,
    };
    ctx.db.foraging_node().node_id().update(ForagingNode {
        remaining: 0.0,
        respawn_cooldown: cooldown,
        ..node
    });
}
