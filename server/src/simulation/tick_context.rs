//! Per-tick caches shared across simulation steps.

use std::collections::HashMap;

use spacetimedb::{Identity, ReducerContext};

use crate::db::*;
use crate::roads::RoadNetwork;

pub struct SimTickContext {
    road_networks: HashMap<Identity, RoadNetwork>,
}

impl SimTickContext {
    pub fn new(ctx: &ReducerContext) -> Self {
        let mut road_networks = HashMap::new();
        for state in ctx.db.road_network_state().iter() {
            if let Some(network) = RoadNetwork::from_snapshot_json(&state.snapshot_json) {
                road_networks.insert(state.owner, network);
            }
        }
        Self { road_networks }
    }

    pub fn road_network(&self, owner: Identity) -> Option<&RoadNetwork> {
        self.road_networks.get(&owner)
    }

    pub fn road_connected(&self, owner: Identity, ax: f64, az: f64, bx: f64, bz: f64) -> bool {
        self.road_network(owner)
            .map(|network| network.road_connected(ax, az, bx, bz))
            .unwrap_or(false)
    }
}
