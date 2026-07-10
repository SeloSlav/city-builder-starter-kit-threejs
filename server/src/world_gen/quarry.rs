use super::math::{has_minimum_distance, hypot, smoothstep, value_noise2, Mulberry32};
use super::river::RiverLayout;

const PLAYABLE_HALF: f64 = 410.0;
const CENTRAL_CLEARING_RADIUS: f64 = 34.0;
const MIN_LARGE_QUARRY_SPACING: f64 = 200.0;
const MIN_SMALL_QUARRY_SPACING: f64 = 110.0;
const RIVER_AVOIDANCE_MASK: f64 = 0.22;
const DRAIN_AVOIDANCE_RADIUS: f64 = 130.0;
const LARGE_QUARRY_YIELD: f64 = 800.0;
const SMALL_QUARRY_YIELD: f64 = 350.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum QuarryKind {
    Large,
    Small,
}

#[derive(Clone, Debug)]
struct QuarrySite {
    x: f64,
    z: f64,
    kind: QuarryKind,
}

#[derive(Debug, Clone)]
pub struct GeneratedQuarry {
    pub quarry_id: String,
    pub x: f64,
    pub z: f64,
    pub max_yield: f64,
}

pub fn generate_quarries(seed: u64) -> Vec<GeneratedQuarry> {
    let river_layout = RiverLayout::create_default();
    let seed_i32 = seed as i32;
    let mut rng = Mulberry32::new(seed as u32);
    let mut sites: Vec<QuarrySite> = Vec::new();

    if let Some(site) = pick_quarry_site(
        &mut rng,
        seed_i32,
        PLAYABLE_HALF,
        &river_layout,
        &sites,
        QuarryKind::Large,
    ) {
        sites.push(site);
    }

    for i in 0..2 {
        let small_seed = seed_i32 ^ ((i + 3) * 0x5151);
        if let Some(site) = pick_quarry_site(
            &mut rng,
            small_seed,
            PLAYABLE_HALF,
            &river_layout,
            &sites,
            QuarryKind::Small,
        ) {
            sites.push(site);
        }
    }

    let mut large_index = 0;
    let mut small_index = 0;
    sites
        .into_iter()
        .map(|site| {
            let quarry_id = match site.kind {
                QuarryKind::Large => {
                    let id = format!("quarry-large-{large_index}");
                    large_index += 1;
                    id
                }
                QuarryKind::Small => {
                    let id = format!("quarry-small-{small_index}");
                    small_index += 1;
                    id
                }
            };
            GeneratedQuarry {
                quarry_id,
                x: site.x,
                z: site.z,
                max_yield: match site.kind {
                    QuarryKind::Large => LARGE_QUARRY_YIELD,
                    QuarryKind::Small => SMALL_QUARRY_YIELD,
                },
            }
        })
        .collect()
}

fn pick_quarry_site(
    rng: &mut Mulberry32,
    _seed: i32,
    playable_half: f64,
    river_layout: &RiverLayout,
    existing: &[QuarrySite],
    kind: QuarryKind,
) -> Option<QuarrySite> {
    let margin = playable_half * 0.08;
    let max_attempts = match kind {
        QuarryKind::Large => 280,
        QuarryKind::Small => 220,
    };
    let min_spacing = match kind {
        QuarryKind::Large => MIN_LARGE_QUARRY_SPACING,
        QuarryKind::Small => MIN_SMALL_QUARRY_SPACING,
    };

    let existing_points: Vec<(f64, f64)> = existing.iter().map(|site| (site.x, site.z)).collect();

    for _attempt in 0..max_attempts {
        let x = (rng.next() * 2.0 - 1.0) * (playable_half - margin);
        let z = (rng.next() * 2.0 - 1.0) * (playable_half - margin);
        if hypot(x, z) < CENTRAL_CLEARING_RADIUS + 48.0 {
            continue;
        }
        if hypot(x, z + 88.0) < DRAIN_AVOIDANCE_RADIUS {
            continue;
        }
        if river_layout.sample_river_mask(x, z) > RIVER_AVOIDANCE_MASK {
            continue;
        }
        if !has_minimum_distance(&existing_points, x, z, min_spacing) {
            continue;
        }

        let suitability = quarry_suitability_at(x, z, playable_half);
        if suitability < 0.34 || rng.next() > suitability * 0.94 {
            continue;
        }

        return Some(QuarrySite { x, z, kind });
    }

    create_fallback_site(existing, kind)
}

fn create_fallback_site(existing: &[QuarrySite], kind: QuarryKind) -> Option<QuarrySite> {
    let presets: &[Point2Preset] = match kind {
        QuarryKind::Large => &[
            Point2Preset { x: 168.0, z: 142.0 },
            Point2Preset { x: -182.0, z: 96.0 },
            Point2Preset { x: 124.0, z: -176.0 },
        ],
        QuarryKind::Small => &[
            Point2Preset { x: -148.0, z: -118.0 },
            Point2Preset { x: 196.0, z: -64.0 },
            Point2Preset { x: -96.0, z: 184.0 },
        ],
    };

    let min_spacing = match kind {
        QuarryKind::Large => MIN_LARGE_QUARRY_SPACING,
        QuarryKind::Small => MIN_SMALL_QUARRY_SPACING,
    };
    let existing_points: Vec<(f64, f64)> = existing.iter().map(|site| (site.x, site.z)).collect();

    for preset in presets {
        if !has_minimum_distance(&existing_points, preset.x, preset.z, min_spacing) {
            continue;
        }
        return Some(QuarrySite {
            x: preset.x,
            z: preset.z,
            kind,
        });
    }

    None
}

struct Point2Preset {
    x: f64,
    z: f64,
}

fn quarry_suitability_at(x: f64, z: f64, playable_half: f64) -> f64 {
    let edge_distance = x.abs().max(z.abs());
    let ridge_bias = smoothstep(playable_half * 0.34, playable_half * 0.78, edge_distance) * 0.28;
    let stone_noise = value_noise2(x * 0.016 + 24.6, z * 0.016 - 11.3);
    let open_ground = 1.0 - smoothstep(0.68, 0.96, value_noise2(x * 0.008 + 5.2, z * 0.008 - 8.4));
    saturate(ridge_bias + stone_noise * 0.46 + open_ground * 0.18)
}

fn saturate(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}
