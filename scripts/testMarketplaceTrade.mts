import assert from 'node:assert/strict';
import {
  canAffordMarketplaceTrade,
  describeMarketplaceTradeOffer,
  formatTradeAvailabilitySummary,
  marketplaceTradeOfferCost,
  tradeResourceSpendScope,
} from '../src/economy/marketplaceTrade.ts';
import { MARKETPLACE_TRADE_OFFERS } from '../src/generated/gameBalance.ts';

const buyTimber = MARKETPLACE_TRADE_OFFERS.find((offer) => offer.id === 'buy_timber');
const sellStone = MARKETPLACE_TRADE_OFFERS.find((offer) => offer.id === 'sell_stone');
const timberForStone = MARKETPLACE_TRADE_OFFERS.find((offer) => offer.id === 'timber_for_stone');

assert.ok(buyTimber, 'buy_timber offer exists');
assert.ok(sellStone, 'sell_stone offer exists');
assert.ok(timberForStone, 'timber_for_stone offer exists');

assert.equal(describeMarketplaceTradeOffer(buyTimber), 'Buy 10 timber for 16 gold');
assert.equal(marketplaceTradeOfferCost(buyTimber).resource, 'gold');
assert.equal(tradeResourceSpendScope('timber'), 'aggregate');
assert.equal(tradeResourceSpendScope('food'), 'aggregate');

assert.equal(canAffordMarketplaceTrade({ timber: 0, stone: 0, gold: 16, firewood: 0, food: 0 }, buyTimber), true);
assert.equal(canAffordMarketplaceTrade({ timber: 0, stone: 0, gold: 10, firewood: 0, food: 0 }, buyTimber), false);

assert.equal(canAffordMarketplaceTrade({ timber: 0, stone: 10, gold: 0, firewood: 0, food: 0 }, sellStone), true);
assert.equal(canAffordMarketplaceTrade({ timber: 0, stone: 5, gold: 0, firewood: 0, food: 0 }, sellStone), false);

assert.equal(canAffordMarketplaceTrade({ timber: 25, stone: 0, gold: 0, firewood: 0, food: 0 }, timberForStone), true);
assert.equal(canAffordMarketplaceTrade({ timber: 20, stone: 0, gold: 0, firewood: 0, food: 0 }, timberForStone), false);

assert.match(
  formatTradeAvailabilitySummary({ timber: 12, stone: 8, gold: 3.5, firewood: 40, food: 6 }),
  /Timber 12/,
);

console.log('marketplace trade tests passed');
