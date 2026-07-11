use spacetimedb::ReducerContext;

use crate::balance_generated::TradeResource;
use super::marketplace_trade_policy::{trade_receive, trade_spend, TradeReceive, TradeSpend};
use crate::economy::{
    credit_treasury_firewood, credit_treasury_food, credit_treasury_gold, credit_treasury_stone,
    credit_treasury_timber, spend_aggregate_firewood, spend_aggregate_food, spend_aggregate_stone,
    spend_aggregate_timber, spend_treasury_gold,
};
use crate::balance_generated::{
    marketplace_trade_offer, MarketplaceTradeOffer, TradeResourceSpendScope,
};

pub fn execute_marketplace_trade(
    ctx: &ReducerContext,
    owner: spacetimedb::Identity,
    trade_id: &str,
) -> Result<(), String> {
    let offer = marketplace_trade_offer(trade_id)
        .ok_or_else(|| format!("Unknown trade offer: {trade_id}"))?;
    apply_marketplace_trade(ctx, owner, offer)
}

pub fn apply_marketplace_trade(
    ctx: &ReducerContext,
    owner: spacetimedb::Identity,
    offer: &MarketplaceTradeOffer,
) -> Result<(), String> {
    match trade_spend(offer) {
        TradeSpend::Gold(amount) => spend_treasury_gold(ctx, owner, amount)?,
        TradeSpend::Resource(leg) => spend_trade_resource(ctx, owner, leg.resource, leg.amount)?,
    }

    match trade_receive(offer) {
        TradeReceive::Gold(amount) => credit_treasury_gold(ctx, owner, amount),
        TradeReceive::Resource(leg) => credit_trade_resource(ctx, owner, leg.resource, leg.amount)?,
    }

    Ok(())
}

fn spend_trade_resource(
    ctx: &ReducerContext,
    owner: spacetimedb::Identity,
    resource: TradeResource,
    amount: f64,
) -> Result<(), String> {
    match resource.spend_scope() {
        TradeResourceSpendScope::Aggregate => match resource {
            TradeResource::Timber => spend_aggregate_timber(ctx, owner, amount),
            TradeResource::Stone => spend_aggregate_stone(ctx, owner, amount),
            TradeResource::Firewood => spend_aggregate_firewood(ctx, owner, amount),
            TradeResource::Food => spend_aggregate_food(ctx, owner, amount),
        },
        TradeResourceSpendScope::Treasury => {
            Err(format!("Treasury spend is not supported for {resource:?}"))
        }
    }
}

fn credit_trade_resource(
    ctx: &ReducerContext,
    owner: spacetimedb::Identity,
    resource: TradeResource,
    amount: f64,
) -> Result<(), String> {
    match resource {
        TradeResource::Timber => credit_treasury_timber(ctx, owner, amount),
        TradeResource::Stone => credit_treasury_stone(ctx, owner, amount),
        TradeResource::Firewood => credit_treasury_firewood(ctx, owner, amount),
        TradeResource::Food => credit_treasury_food(ctx, owner, amount),
    }
    Ok(())
}
