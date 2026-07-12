import {
  MARKETPLACE_TRADE_OFFERS,
  TRADE_RESOURCE_SPEND_SCOPES,
  type MarketplaceBarterOffer,
  type MarketplaceTradeOffer,
  type TradeResourceKind,
} from '../generated/gameBalance.ts';
import type { RegionalMarketState } from './regionalMarket.ts';
import {
  DEFAULT_REGIONAL_MARKET_STATE,
  describeCommodityOffer,
  describeMarketplaceTradeOfferWithPrices,
  describeWaterCommodityOffer,
  effectiveCommodityGoldCost,
  effectiveTradeGoldCost,
  effectiveWaterCommodityGoldCost,
  MARKET_COMMODITIES,
  MARKET_WATER_COMMODITIES,
} from './regionalMarket.ts';
import type { MarketCommodityOffer, MarketWaterCommodityOffer } from '../generated/gameBalance.ts';

export type MarketplaceTradeAvailability = Record<TradeResourceKind | 'gold', number>;

const RESOURCE_LABELS: Record<TradeResourceKind | 'gold', string> = {
  timber: 'Timber',
  stone: 'Stone',
  firewood: 'Firewood',
  food: 'Food',
  gold: 'Gold',
};

export function tradeResourceLabel(resource: TradeResourceKind | 'gold'): string {
  return RESOURCE_LABELS[resource];
}

export function describeMarketplaceTradeOffer(offer: MarketplaceTradeOffer): string {
  return describeMarketplaceTradeOfferWithPrices(offer, DEFAULT_REGIONAL_MARKET_STATE, tradeResourceLabel);
}

export function describeMarketplaceTradeOfferForMarket(
  offer: MarketplaceTradeOffer,
  marketState: RegionalMarketState,
): string {
  return describeMarketplaceTradeOfferWithPrices(offer, marketState, tradeResourceLabel);
}

export function marketplaceTradeOfferCost(
  offer: MarketplaceTradeOffer,
  marketState: RegionalMarketState = DEFAULT_REGIONAL_MARKET_STATE,
): { resource: TradeResourceKind | 'gold'; amount: number } {
  switch (offer.kind) {
    case 'goldBuy':
      return { resource: 'gold', amount: effectiveTradeGoldCost(offer, marketState) };
    case 'goldSell':
      return { resource: offer.resource, amount: offer.amount };
    case 'barter':
      return { resource: offer.give, amount: offer.giveAmount };
    default: {
      const unhandled: never = offer;
      return unhandled;
    }
  }
}

export function commodityOfferCost(
  commodity: MarketCommodityOffer,
  marketState: RegionalMarketState = DEFAULT_REGIONAL_MARKET_STATE,
): { resource: 'gold'; amount: number } {
  return { resource: 'gold', amount: effectiveCommodityGoldCost(commodity, marketState) };
}

export function waterCommodityOfferCost(
  commodity: MarketWaterCommodityOffer,
  marketState: RegionalMarketState = DEFAULT_REGIONAL_MARKET_STATE,
): { resource: 'gold'; amount: number } {
  return { resource: 'gold', amount: effectiveWaterCommodityGoldCost(commodity, marketState) };
}

function tradeStock(availability: MarketplaceTradeAvailability, resource: TradeResourceKind | 'gold'): number {
  return availability[resource];
}

export function canAffordMarketplaceTrade(
  availability: MarketplaceTradeAvailability,
  offer: MarketplaceTradeOffer,
  marketState: RegionalMarketState = DEFAULT_REGIONAL_MARKET_STATE,
): boolean {
  const cost = marketplaceTradeOfferCost(offer, marketState);
  return tradeStock(availability, cost.resource) + 1e-6 >= cost.amount;
}

export function canAffordCommodityTrade(
  availability: MarketplaceTradeAvailability,
  commodity: MarketCommodityOffer,
  marketState: RegionalMarketState = DEFAULT_REGIONAL_MARKET_STATE,
): boolean {
  const cost = commodityOfferCost(commodity, marketState);
  return tradeStock(availability, cost.resource) + 1e-6 >= cost.amount;
}

export function canAffordWaterCommodityTrade(
  availability: MarketplaceTradeAvailability,
  commodity: MarketWaterCommodityOffer,
  marketState: RegionalMarketState = DEFAULT_REGIONAL_MARKET_STATE,
): boolean {
  const cost = waterCommodityOfferCost(commodity, marketState);
  return tradeStock(availability, cost.resource) + 1e-6 >= cost.amount;
}

export function formatTradeAvailabilitySummary(availability: MarketplaceTradeAvailability): string {
  const parts = (['gold', 'timber', 'stone', 'firewood', 'food'] as const).map((resource) => {
    const amount = Math.round(availability[resource]);
    return `${tradeResourceLabel(resource)} ${amount}`;
  });
  return `Available: ${parts.join(' · ')}`;
}

export function marketplaceTradeOffersBySection(): {
  goldBuy: MarketplaceTradeOffer[];
  goldSell: MarketplaceTradeOffer[];
  barter: MarketplaceBarterOffer[];
} {
  const goldBuy: MarketplaceTradeOffer[] = [];
  const goldSell: MarketplaceTradeOffer[] = [];
  const barter: MarketplaceBarterOffer[] = [];
  for (const offer of MARKETPLACE_TRADE_OFFERS) {
    if (offer.kind === 'goldBuy') goldBuy.push(offer);
    else if (offer.kind === 'goldSell') goldSell.push(offer);
    else barter.push(offer);
  }
  return { goldBuy, goldSell, barter };
}

export function parseMarketplaceTradeId(button: HTMLElement): string | null {
  if (button.closest('[data-inspector-action="marketplace-trade"]') === null) {
    return null;
  }
  return button.closest('[data-trade-id]')?.getAttribute('data-trade-id') ?? null;
}

export function tradeResourceSpendScope(resource: TradeResourceKind): (typeof TRADE_RESOURCE_SPEND_SCOPES)[TradeResourceKind] {
  return TRADE_RESOURCE_SPEND_SCOPES[resource];
}

export {
  describeCommodityOffer,
  describeWaterCommodityOffer,
  MARKET_COMMODITIES,
  MARKET_WATER_COMMODITIES,
};
