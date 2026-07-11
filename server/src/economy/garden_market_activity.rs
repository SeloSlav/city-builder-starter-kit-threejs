use crate::balance_generated::{BackyardGardenDef, FOOD_SALE_GOLD_PER_UNIT};

/// Taxable market activity from a garden over a time window (seconds).
pub fn garden_market_activity(def: &BackyardGardenDef, population: f64, seconds: f64) -> f64 {
    let population = population.max(0.0);
    let mut activity = def.gold_per_person_per_sec * population * seconds;

    if def.food_per_person_per_sec > 1e-9 {
        let total_food = def.food_per_person_per_sec * population * seconds;
        let sold_food = total_food * (1.0 - def.food_self_share.clamp(0.0, 1.0));
        activity += sold_food * FOOD_SALE_GOLD_PER_UNIT;
    }

    activity
}
