import {
  MARKETPLACE_TRADE_OFFERS,
  TRADE_RESOURCE_SPEND_SCOPES,
  type MarketplaceBarterOffer,
  type MarketplaceTradeOffer,
  type TradeResourceKind,
} from '../generated/gameBalance.ts';

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
  switch (offer.kind) {
    case 'goldBuy':
      return `Buy ${offer.amount} ${tradeResourceLabel(offer.resource).toLowerCase()} for ${offer.goldCost} gold`;
    case 'goldSell':
      return `Sell ${offer.amount} ${tradeResourceLabel(offer.resource).toLowerCase()} for ${offer.goldYield} gold`;
    case 'barter':
      return `Trade ${offer.giveAmount} ${tradeResourceLabel(offer.give).toLowerCase()} for ${offer.receiveAmount} ${tradeResourceLabel(offer.receive).toLowerCase()}`;
    default: {
      const unhandled: never = offer;
      return unhandled;
    }
  }
}

export function marketplaceTradeOfferCost(
  offer: MarketplaceTradeOffer,
): { resource: TradeResourceKind | 'gold'; amount: number } {
  switch (offer.kind) {
    case 'goldBuy':
      return { resource: 'gold', amount: offer.goldCost };
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

function tradeStock(availability: MarketplaceTradeAvailability, resource: TradeResourceKind | 'gold'): number {
  return availability[resource];
}

export function canAffordMarketplaceTrade(
  availability: MarketplaceTradeAvailability,
  offer: MarketplaceTradeOffer,
): boolean {
  const cost = marketplaceTradeOfferCost(offer);
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
