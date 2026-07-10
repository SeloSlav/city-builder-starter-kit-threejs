pub fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

pub fn clamp01(value: f64) -> f64 {
    if value < 0.0 {
        0.0
    } else if value > 1.0 {
        1.0
    } else {
        value
    }
}

pub fn saturate(value: f64) -> f64 {
    clamp01(value)
}

pub fn smoothstep(edge0: f64, edge1: f64, value: f64) -> f64 {
    if (edge1 - edge0).abs() <= f64::EPSILON {
        return if value < edge0 { 0.0 } else { 1.0 };
    }
    let t = saturate((value - edge0) / (edge1 - edge0));
    t * t * (3.0 - 2.0 * t)
}

pub struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Self { state: seed }
    }

    pub fn next(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6d2b79f5);
        let mut t = self.state;
        t = imul_u32(t ^ (t >> 15), t | 1);
        t ^= t.wrapping_add(imul_u32(t ^ (t >> 7), t | 61));
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
}

fn imul_u32(a: u32, b: u32) -> u32 {
    ((a as i32).wrapping_mul(b as i32)) as u32
}

const HASH_MUL: i32 = -2048144789; // 0x85ebca6b as i32 (Math.imul multiplier)

pub fn hash_f64(seed: i32, x: i32, z: i32) -> f64 {
    let mut h = imul_i32(seed.wrapping_add(x), HASH_MUL);
    h = imul_i32(h.wrapping_add(z), HASH_MUL);
    h ^= h >> 13;
    h = imul_i32(h, HASH_MUL);
    h ^= h >> 16;
    (h as u32 as f64) / 4294967295.0
}

fn imul_i32(a: i32, b: i32) -> i32 {
    a.wrapping_mul(b)
}

pub fn hash_grid2(x: f64, z: f64) -> f64 {
    let value = (x * 127.1 + z * 311.7).sin() * 43758.5453123;
    value - value.floor()
}

pub fn value_noise2(x: f64, z: f64) -> f64 {
    let x0 = x.floor();
    let z0 = z.floor();
    let tx = x - x0;
    let tz = z - z0;
    let sx = tx * tx * (3.0 - 2.0 * tx);
    let sz = tz * tz * (3.0 - 2.0 * tz);
    let a = hash_grid2(x0, z0);
    let b = hash_grid2(x0 + 1.0, z0);
    let c = hash_grid2(x0, z0 + 1.0);
    let d = hash_grid2(x0 + 1.0, z0 + 1.0);
    let x0_lerp = a + (b - a) * sx;
    let x1_lerp = c + (d - c) * sx;
    x0_lerp + (x1_lerp - x0_lerp) * sz
}

pub fn value_noise2_seeded(x: f64, z: f64, seed: i32) -> f64 {
    let x0 = x.floor();
    let z0 = z.floor();
    let fx = x - x0;
    let fz = z - z0;
    let ux = fx * fx * (3.0 - 2.0 * fx);
    let uz = fz * fz * (3.0 - 2.0 * fz);
    let a = hash_f64(seed, x0 as i32, z0 as i32);
    let b = hash_f64(seed, (x0 + 1.0) as i32, z0 as i32);
    let c = hash_f64(seed, x0 as i32, (z0 + 1.0) as i32);
    let d = hash_f64(seed, (x0 + 1.0) as i32, (z0 + 1.0) as i32);
    let ab = a + (b - a) * ux;
    let cd = c + (d - c) * ux;
    ab + (cd - ab) * uz
}

pub fn hypot(x: f64, z: f64) -> f64 {
    (x * x + z * z).sqrt()
}

pub fn has_minimum_distance(points: &[(f64, f64)], x: f64, z: f64, min_distance: f64) -> bool {
    let min_distance_sq = min_distance * min_distance;
    for &(px, pz) in points {
        let dx = x - px;
        let dz = z - pz;
        if dx * dx + dz * dz < min_distance_sq {
            return false;
        }
    }
    true
}
