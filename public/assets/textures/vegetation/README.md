# Vegetation card textures

`cattail_reed_card.png` is a transparent albedo card generated with the Codex built-in image generator, then chroma-keyed and resized locally for the SeedThree ground-cover renderer.

Generation prompt:

> Use case: stylized-concept. Asset type: game vegetation alpha-card texture for a realistic medieval temperate landscape. Create a natural clump of European common cattails (Typha latifolia) with long narrow green reed leaves and several distinct dark brown cylindrical cattail seed heads on slender upright stems. Use a perfectly flat solid #ff00ff chroma-key background. Render a realistic high-detail botanical game texture with soft diffuse overcast daylight. Keep the isolated full-height clump rooted at the exact bottom center with generous padding. Use olive and fresh reed greens, muted straw highlights, and dark warm brown cattail heads. No shadows, floor, water, landscape, text, watermark, flowers, wheat, bamboo, or pampas grass.

`rose_blossom_card.png` is a transparent blossom texture generated with the Codex built-in image generator, chroma-keyed locally, and resized to 1024×1024. The garden renderer layers it over the existing modeled rose petals so blossoms retain 3D depth while reading clearly as roses at gameplay distance.

Generation prompt:

> Use case: background-extraction. Asset type: game vegetation texture card for a rose blossom. Primary request: one botanically convincing old garden rose blossom viewed directly face-on, fully open, with many distinct layered petals curling naturally toward a dense center. Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal. Subject: a single pale ivory rose with subtle blush-pink petal edges and warm natural shadow variation inside the blossom; no stem and no leaves. Style/medium: photorealistic botanical cutout suitable for a high-quality Three.js foliage card. Composition/framing: blossom centered, symmetrical overall but naturally irregular, fills about 82 percent of the square, crisp complete silhouette with generous clean padding. Lighting/mood: soft diffuse daylight with restrained internal petal shading; no cast shadow. Constraints: background must be one uniform #00ff00 color with no gradients, texture, floor, reflections, shadow, or lighting variation; do not use green anywhere in the flower; no stem, leaves, thorns, buds, vase, text, border, or watermark; crisp separated edges. Avoid: circular painted disk, simple five-petal flower, plastic appearance, orb shape, top-down bouquet, multiple blossoms.
