mod math;
mod quarry;
mod river;

use quarry::generate_quarries;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct EmbeddedTree {
    tree_id: String,
    layout_index: u32,
    wood_yield: f64,
    x: f64,
    z: f64,
}

#[derive(Debug, Deserialize)]
struct EmbeddedTreesFile {
    trees: Vec<EmbeddedTree>,
}

pub struct WorldBootstrapQuarry {
    pub quarry_id: String,
    pub x: f64,
    pub z: f64,
    pub max_yield: f64,
}

pub struct WorldBootstrapTree {
    pub tree_id: String,
    pub layout_index: u32,
    pub wood_yield: f64,
    pub x: f64,
    pub z: f64,
}

fn parse_embedded_trees() -> Vec<EmbeddedTree> {
    let json = include_str!("../../generated/world_trees.json");
    let file: EmbeddedTreesFile = serde_json::from_str(json).expect("world_trees.json must be valid");
    file.trees
}

pub fn bootstrap_quarry_rows(seed: u64) -> Vec<WorldBootstrapQuarry> {
    generate_quarries(seed)
        .into_iter()
        .map(|quarry| WorldBootstrapQuarry {
            quarry_id: quarry.quarry_id,
            x: quarry.x,
            z: quarry.z,
            max_yield: quarry.max_yield,
        })
        .collect()
}

pub fn bootstrap_tree_rows() -> Vec<WorldBootstrapTree> {
    parse_embedded_trees()
        .into_iter()
        .map(|tree| WorldBootstrapTree {
            tree_id: tree.tree_id,
            layout_index: tree.layout_index,
            wood_yield: tree.wood_yield,
            x: tree.x,
            z: tree.z,
        })
        .collect()
}
