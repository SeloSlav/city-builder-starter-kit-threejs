//! Road-graph distance and branch claims for firewood logistics.

use spacetimedb::Identity;

use crate::roads::RoadNetwork;
use crate::tables::{building, Building, Residence};

pub fn road_path_distance(
    network: &RoadNetwork,
    ax: f64,
    az: f64,
    bx: f64,
    bz: f64,
) -> Option<f64> {
    network.road_path_distance(ax, az, bx, bz)
}

/// Each residence is claimed by the nearest road-connected woodcutter's lodge.
pub fn claim_residences_for_lodges(
    network: &RoadNetwork,
    lodges: &[Building],
    residences: &[Residence],
) -> std::collections::HashMap<u64, u64> {
    let mut claims = std::collections::HashMap::new();
    for residence in residences {
        if residence.abandoned {
            continue;
        }
        let mut best_lodge: Option<&Building> = None;
        let mut best_distance = f64::INFINITY;
        for lodge in lodges {
            if lodge.kind != "woodcutters_lodge" {
                continue;
            }
            let Some(distance) =
                road_path_distance(network, lodge.x, lodge.z, residence.x, residence.z)
            else {
                continue;
            };
            if distance + 1e-6 < best_distance
                || ((distance - best_distance).abs() <= 1e-6
                    && best_lodge.map_or(true, |current| lodge.id < current.id))
            {
                best_distance = distance;
                best_lodge = Some(lodge);
            }
        }
        if let Some(lodge) = best_lodge {
            claims.insert(residence.id, lodge.id);
        }
    }
    claims
}

pub fn sort_mills_by_road_path(
    network: &RoadNetwork,
    lodge: &Building,
    mills: &mut [Building],
) {
    mills.sort_by(|a, b| {
        let da = road_path_distance(network, a.x, a.z, lodge.x, lodge.z).unwrap_or(f64::INFINITY);
        let db = road_path_distance(network, b.x, b.z, lodge.x, lodge.z).unwrap_or(f64::INFINITY);
        da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
    });
}

pub fn owner_lodges(ctx: &spacetimedb::ReducerContext, owner: Identity) -> Vec<Building> {
    ctx.db
        .building()
        .owner()
        .filter(&owner)
        .filter(|row| row.kind == "woodcutters_lodge")
        .collect()
}
