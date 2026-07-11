use spacetimedb::ReducerContext;

use crate::db::*;
use crate::tables::{ForagingNode, Quarry, TreeEntity};

pub fn clear_global_world_entities(ctx: &ReducerContext) {
    for tree in ctx.db.tree_entity().iter().collect::<Vec<TreeEntity>>() {
        ctx.db.tree_entity().tree_id().delete(&tree.tree_id);
    }

    for quarry in ctx.db.quarry().iter().collect::<Vec<Quarry>>() {
        ctx.db.quarry().quarry_id().delete(&quarry.quarry_id);
    }

    for node in ctx.db.foraging_node().iter().collect::<Vec<ForagingNode>>() {
        ctx.db.foraging_node().node_id().delete(&node.node_id);
    }
}

pub fn has_global_world_entities(ctx: &ReducerContext) -> bool {
    ctx.db.tree_entity().iter().count() > 0
        || ctx.db.quarry().iter().count() > 0
        || ctx.db.foraging_node().iter().count() > 0
}
