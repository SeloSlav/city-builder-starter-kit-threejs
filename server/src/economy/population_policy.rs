/// Labor requests cannot increase a building beyond the settlement's current population.
pub fn population_limit_blocks_labor_request(
    current_labor: u32,
    requested_labor: u32,
    total_population: u32,
    assigned_elsewhere: u32,
) -> bool {
    requested_labor > current_labor
        && requested_labor > total_population.saturating_sub(assigned_elsewhere)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LaborAssignment {
    pub building_id: u64,
    pub assigned_labor: u32,
    pub construction_complete: bool,
}

/// Returns only the building assignments that must change after population loss.
///
/// Construction crews are released before productive workers, then newer buildings are
/// released before older ones. This keeps the result stable across simulation ticks and
/// preserves the settlement's established production chain whenever possible.
pub fn labor_reconciliation_updates(
    mut assignments: Vec<LaborAssignment>,
    total_population: u32,
) -> Vec<(u64, u32)> {
    let total_assigned = assignments
        .iter()
        .map(|assignment| assignment.assigned_labor)
        .sum::<u32>();
    let mut excess = total_assigned.saturating_sub(total_population);
    if excess == 0 {
        return Vec::new();
    }

    assignments.sort_by(|a, b| {
        a.construction_complete
            .cmp(&b.construction_complete)
            .then_with(|| b.building_id.cmp(&a.building_id))
    });

    let mut updates = Vec::new();
    for assignment in assignments {
        if excess == 0 {
            break;
        }
        let released = assignment.assigned_labor.min(excess);
        if released == 0 {
            continue;
        }
        updates.push((assignment.building_id, assignment.assigned_labor - released));
        excess -= released;
    }
    updates
}

#[cfg(test)]
mod tests {
    use super::{
        labor_reconciliation_updates, population_limit_blocks_labor_request, LaborAssignment,
    };

    #[test]
    fn overassigned_settlements_can_reduce_building_labor() {
        assert!(!population_limit_blocks_labor_request(2, 1, 5, 6));
        assert!(!population_limit_blocks_labor_request(2, 0, 5, 6));
        assert!(!population_limit_blocks_labor_request(2, 2, 5, 6));
    }

    #[test]
    fn population_limit_still_blocks_labor_increases() {
        assert!(population_limit_blocks_labor_request(2, 3, 5, 6));
        assert!(population_limit_blocks_labor_request(1, 2, 5, 4));
        assert!(!population_limit_blocks_labor_request(1, 2, 6, 4));
    }

    #[test]
    fn population_loss_releases_construction_then_newest_productive_labor() {
        let updates = labor_reconciliation_updates(
            vec![
                LaborAssignment {
                    building_id: 10,
                    assigned_labor: 3,
                    construction_complete: true,
                },
                LaborAssignment {
                    building_id: 20,
                    assigned_labor: 2,
                    construction_complete: true,
                },
                LaborAssignment {
                    building_id: 30,
                    assigned_labor: 4,
                    construction_complete: false,
                },
            ],
            4,
        );

        assert_eq!(updates, vec![(30, 0), (20, 1)]);
    }

    #[test]
    fn valid_assignments_are_left_untouched() {
        assert!(labor_reconciliation_updates(
            vec![LaborAssignment {
                building_id: 10,
                assigned_labor: 2,
                construction_complete: true,
            }],
            5,
        )
        .is_empty());
    }
}
