use super::math::{clamp01, hash_f64, lerp, smoothstep, value_noise2_seeded};

const TAU: f64 = std::f64::consts::PI * 2.0;
const CONFLUENCE_LAKE_RADIUS: f64 = 54.0;
const RIVER_LAYOUT_SEED: i32 = 0x7e57e1e;

#[derive(Clone, Copy, Debug)]
pub struct Point2 {
    pub x: f64,
    pub z: f64,
}

#[derive(Clone, Debug)]
pub struct RiverPoint {
    pub x: f64,
    pub z: f64,
    pub progress: f64,
    pub half_width: f64,
    pub channel_depth: f64,
}

#[derive(Clone, Debug)]
pub struct RiverCorridor {
    pub points: Vec<RiverPoint>,
}

#[derive(Clone, Debug)]
pub struct RiverLayout {
    pub drain: Point2,
    pub seed: i32,
    pub corridors: Vec<RiverCorridor>,
}

impl RiverLayout {
    pub fn create_default() -> Self {
        Self::create(RIVER_LAYOUT_SEED)
    }

    pub fn create(seed: i32) -> Self {
        let river_count = 4;
        let tributary_count = 1;
        let drain = Point2 { x: 0.0, z: -88.0 };
        let mut corridors = Vec::new();

        for i in 0..river_count {
            let jitter = hash_f64(seed ^ 0x5151, i, 0) * 0.22 - 0.11;
            let edge_angle = (i as f64 / river_count as f64) * TAU + jitter;
            let mountain_angle =
                -std::f64::consts::PI * 0.5 + (hash_f64(seed ^ 0x7171, i, 2) - 0.5) * std::f64::consts::PI * 0.95;
            let angle = mountain_angle * 0.58 + edge_angle * 0.42;
            let start = point_on_bounds_edge(angle);
            corridors.push(build_corridor(
                start,
                drain,
                seed ^ ((i + 1) * 0x1337),
                i,
                1.0,
            ));
        }

        if tributary_count > 0 && !corridors.is_empty() {
            for i in 0..tributary_count {
                let parent = &corridors[i % corridors.len()];
                let branch_index = ((parent.points.len() as f64) * (0.36 + i as f64 * 0.08)) as usize;
                let Some(branch_point) = parent.points.get(branch_index) else {
                    continue;
                };
                let angle = hash_f64(seed ^ 0x9393, i as i32, 2) * TAU;
                let start = Point2 {
                    x: branch_point.x + angle.cos() * 58.0,
                    z: branch_point.z + angle.sin() * 58.0,
                };
                let tributary = build_corridor(
                    start,
                    drain,
                    seed ^ (((i + 11) * 0x2424) as i32),
                    i as i32 + 100,
                    0.62,
                );
                if tributary.points.len() > 30 {
                    corridors.push(tributary);
                }
            }
        }

        Self {
            drain,
            seed,
            corridors,
        }
    }

    pub fn sample_river_mask(&self, x: f64, z: f64) -> f64 {
        let lake_mask = sample_confluence_lake_mask(x, z, self.drain, self.seed);
        let hit = self.sample_corridor(x, z);
        let corridor_mask = if let Some(hit) = hit {
            1.0 - smoothstep(hit.half_width * 0.28, hit.half_width * 0.72, hit.distance)
        } else {
            0.0
        };
        lake_mask.max(corridor_mask)
    }
}

struct CorridorHit {
    distance: f64,
    half_width: f64,
}

impl RiverLayout {
    fn sample_corridor(&self, x: f64, z: f64) -> Option<CorridorHit> {
        let mut best_distance = f64::INFINITY;
        let mut best_half_width = 0.0;

        for corridor in &self.corridors {
            let points = &corridor.points;
            for window in points.windows(2) {
                let a = &window[0];
                let b = &window[1];
                let hit = distance_to_segment(x, z, a.x, a.z, b.x, b.z);
                if hit.distance >= best_distance {
                    continue;
                }
                best_distance = hit.distance;
                best_half_width = lerp(a.half_width, b.half_width, hit.t);
                let _ = lerp(a.channel_depth, b.channel_depth, hit.t);
                let _ = lerp(a.progress, b.progress, hit.t);
            }
        }

        if !best_distance.is_finite() || best_distance > best_half_width * 0.95 {
            None
        } else {
            Some(CorridorHit {
                distance: best_distance,
                half_width: best_half_width,
            })
        }
    }
}

fn point_on_bounds_edge(angle: f64) -> Point2 {
    let half = 540.0;
    let dx = angle.cos();
    let dz = angle.sin();
    let mut t = f64::INFINITY;
    if dx.abs() > 1e-6 {
        t = t.min(half / dx.abs());
    }
    if dz.abs() > 1e-6 {
        t = t.min(half / dz.abs());
    }
    Point2 {
        x: dx * t,
        z: dz * t,
    }
}

fn build_corridor(start: Point2, drain: Point2, seed: i32, river_index: i32, scale: f64) -> RiverCorridor {
    let control_count = 11;
    let dx = drain.x - start.x;
    let dz = drain.z - start.z;
    let length = (dx * dx + dz * dz).sqrt().max(1.0);
    let perp_x = -dz / length;
    let perp_z = dx / length;
    let upstream_reach = 140.0_f64.min(length * 0.2);
    let upstream = Point2 {
        x: start.x - (dx / length) * upstream_reach,
        z: start.z - (dz / length) * upstream_reach,
    };
    let mut controls = vec![upstream, start];

    for i in 1..control_count {
        let t = i as f64 / control_count as f64;
        let base_x = start.x + dx * t;
        let base_z = start.z + dz * t;
        let convergence = smoothstep(0.68, 1.0, t);
        let upstream_damp = 1.0 - smoothstep(0.0, 0.24, t) * 0.82;
        let meander_envelope = (t * std::f64::consts::PI).sin()
            * (72.0 + hash_f64(seed ^ 0x6161, i, river_index) * 48.0)
            * scale
            * (1.0 - convergence * 0.88)
            * upstream_damp;
        let wave_a = (t * (7.4 + river_index as f64 * 0.31) + seed as f64 * 0.002).sin() * 0.58;
        let wave_b = (t * (12.8 + river_index as f64 * 0.17) - seed as f64 * 0.003).sin() * 0.42;
        let offset = meander_envelope * (wave_a + wave_b);
        controls.push(Point2 {
            x: base_x + perp_x * offset,
            z: base_z + perp_z * offset,
        });
    }
    controls.push(drain);

    let dense = catmull_rom_samples(&controls, 12);
    let resampled = resample_by_distance(&dense, 2.6);
    let max_index = resampled.len().saturating_sub(1).max(1) as f64;
    let points = resampled
        .iter()
        .enumerate()
        .map(|(index, point)| {
            let progress = index as f64 / max_index;
            let mut half_width = lerp(2.4, 12.0, progress.powf(0.68)) * scale;
            let headwater_blend = 1.0 - smoothstep(0.0, 0.18, progress);
            half_width = lerp(half_width, half_width.max(8.5 * scale), headwater_blend);
            let mut channel_depth = lerp(0.9, 2.65, progress.powf(0.82)) * scale;
            channel_depth = lerp(
                channel_depth,
                channel_depth.max(1.65 * scale),
                headwater_blend * 0.75,
            );
            let dist_to_drain = ((point.x - drain.x).powi(2) + (point.z - drain.z).powi(2)).sqrt();
            let mouth_blend = 1.0 - smoothstep(0.0, 130.0, dist_to_drain);
            half_width = lerp(half_width, 26.0, mouth_blend * 0.82);
            channel_depth = lerp(channel_depth, 3.65, mouth_blend * 0.6);
            RiverPoint {
                x: point.x,
                z: point.z,
                progress,
                half_width,
                channel_depth,
            }
        })
        .collect();

    RiverCorridor { points }
}

fn resample_by_distance(points: &[Point2], spacing: f64) -> Vec<Point2> {
    if points.len() < 2 {
        return points.to_vec();
    }
    let mut out = vec![points[0]];
    let mut carry = 0.0;

    for window in points.windows(2) {
        let a = window[0];
        let b = window[1];
        let seg_len = ((b.x - a.x).powi(2) + (b.z - a.z).powi(2)).sqrt();
        if seg_len <= 1e-4 {
            continue;
        }

        let mut traveled = spacing - carry;
        while traveled < seg_len {
            let t = traveled / seg_len;
            out.push(Point2 {
                x: a.x + (b.x - a.x) * t,
                z: a.z + (b.z - a.z) * t,
            });
            traveled += spacing;
        }
        carry = seg_len - (traveled - spacing);
    }

    if let Some(last) = points.last() {
        out.push(*last);
    }
    out
}

fn sample_confluence_lake_mask(x: f64, z: f64, drain: Point2, seed: i32) -> f64 {
    let dx = x - drain.x;
    let dz = z - drain.z;
    let dist = (dx * dx + dz * dz).sqrt();
    let shore_noise = (value_noise2_seeded(x * 0.045 + seed as f64 * 0.001, z * 0.045 - 6.8, seed)
        - 0.5)
        * 9.0
        + (value_noise2_seeded(x * 0.11 - 3.2, z * 0.11 + 8.1, seed ^ 0x33) - 0.5) * 4.0;
    let radius = CONFLUENCE_LAKE_RADIUS + shore_noise;
    if dist > radius * 1.05 {
        return 0.0;
    }
    1.0 - smoothstep(radius * 0.2, radius, dist)
}

fn catmull_rom_samples(controls: &[Point2], samples_per_segment: usize) -> Vec<Point2> {
    if controls.len() < 2 {
        return controls.to_vec();
    }
    let mut out = Vec::new();
    for i in 0..controls.len() - 1 {
        let p0 = controls[i.saturating_sub(1)];
        let p1 = controls[i];
        let p2 = controls[i + 1];
        let p3 = controls[(i + 2).min(controls.len() - 1)];
        for s in 0..samples_per_segment {
            let t = s as f64 / samples_per_segment as f64;
            out.push(catmull_rom(p0, p1, p2, p3, t));
        }
    }
    if let Some(last) = controls.last() {
        out.push(*last);
    }
    out
}

fn catmull_rom(p0: Point2, p1: Point2, p2: Point2, p3: Point2, t: f64) -> Point2 {
    let t2 = t * t;
    let t3 = t2 * t;
    Point2 {
        x: 0.5
            * (2.0 * p1.x
                + (-p0.x + p2.x) * t
                + (2.0 * p0.x - 5.0 * p1.x + 4.0 * p2.x - p3.x) * t2
                + (-p0.x + 3.0 * p1.x - 3.0 * p2.x + p3.x) * t3),
        z: 0.5
            * (2.0 * p1.z
                + (-p0.z + p2.z) * t
                + (2.0 * p0.z - 5.0 * p1.z + 4.0 * p2.z - p3.z) * t2
                + (-p0.z + 3.0 * p1.z - 3.0 * p2.z + p3.z) * t3),
    }
}

struct SegmentHit {
    distance: f64,
    t: f64,
}

fn distance_to_segment(px: f64, pz: f64, ax: f64, az: f64, bx: f64, bz: f64) -> SegmentHit {
    let abx = bx - ax;
    let abz = bz - az;
    let len_sq = abx * abx + abz * abz;
    let t = if len_sq <= 1e-6 {
        0.0
    } else {
        clamp01(((px - ax) * abx + (pz - az) * abz) / len_sq)
    };
    let cx = ax + abx * t;
    let cz = az + abz * t;
    SegmentHit {
        distance: ((px - cx).powi(2) + (pz - cz).powi(2)).sqrt(),
        t,
    }
}
