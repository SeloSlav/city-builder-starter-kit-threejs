import type { BuildingState } from '../types.ts';
import {
  canAffordMarketplaceTrade,
  describeMarketplaceTradeOffer,
  formatTradeAvailabilitySummary,
  marketplaceTradeOffersBySection,
} from '../../economy/marketplaceTrade.ts';
import type { MarketplaceTradeAvailability } from '../../economy/marketplaceTrade.ts';

export function renderMarketplaceTradePanel(
  building: BuildingState,
  availability: MarketplaceTradeAvailability,
): string {
  const sections = marketplaceTradeOffersBySection();
  const renderOffer = (offer: (typeof sections.goldBuy)[number]) => {
    const affordable = canAffordMarketplaceTrade(availability, offer);
    const disabled = affordable ? '' : ' disabled aria-disabled="true"';
    return `
      <li class="marketplace-trade-row">
        <button
          type="button"
          class="marketplace-trade-option"
          data-inspector-action="marketplace-trade"
          data-trade-id="${offer.id}"
          data-building-id="${building.id}"
          ${disabled}
        >
          <span class="marketplace-trade-option__title">${describeMarketplaceTradeOffer(offer)}</span>
          <span class="marketplace-trade-option__hint">Caravan from a neighboring village</span>
        </button>
      </li>`;
  };

  return `
    <div class="marketplace-trade-panel">
      <p class="marketplace-trade-intro">Trade with caravans from neighboring villages. Backyard sales still need road-linked homes.</p>
      <p class="marketplace-trade-stock">${formatTradeAvailabilitySummary(availability)}</p>
      <section class="marketplace-trade-section" aria-label="Buy with gold">
        <h3 class="marketplace-trade-section__title">Buy with gold</h3>
        <ul class="marketplace-trade-list">${sections.goldBuy.map(renderOffer).join('')}</ul>
      </section>
      <section class="marketplace-trade-section" aria-label="Sell for gold">
        <h3 class="marketplace-trade-section__title">Sell for gold</h3>
        <ul class="marketplace-trade-list">${sections.goldSell.map(renderOffer).join('')}</ul>
      </section>
      <section class="marketplace-trade-section" aria-label="Barter">
        <h3 class="marketplace-trade-section__title">Barter</h3>
        <ul class="marketplace-trade-list">${sections.barter.map(renderOffer).join('')}</ul>
      </section>
    </div>`;
}
