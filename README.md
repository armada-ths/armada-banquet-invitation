# THS Armada Grand Banquet invitation

A one-page, winter-themed invitation. The envelope is frozen in a slab of ice:

1. First tap: a small shake and hairline cracks.
2. Second tap: a bigger shake and spreading cracks.
3. Third tap: the ice shatters, the flap opens and the letter slides out into the invitation card.

The card ends with a link to the Ticketmaster registration, where dietary needs and guest details are collected.

Plain HTML, CSS and JavaScript, with no build step. [GSAP](https://gsap.com) (free, loaded from jsDelivr) handles the load-in and card reveal.

## Fill in the details

Edit `js/config.js`. Any value still starting with `[NEEDS INPUT` shows a red dashed outline on the page, and a red "Draft" banner counts how many are left.

The Armada logo is in `assets/armada-logo.svg`. Its ship shape is also reused inline in `index.html`, in the ice seal and the postage stamp.

The card's title is handwritten in frosted ice-blue ink (Mrs Saint Delafield). The card also carries an icy ink stamp of the Armada logo, the `inkStamp` symbol in `index.html`.

`assets/armada-logo-ice.webp` is a rendered ice version of the logo. The page doesn't currently use it; it's kept in case it's wanted again. To regenerate it, you need the logo PDF and the ambientCG Ice002 texture:

```bash
python tools/make_ice_logo.py path/to/armada_logo.pdf path/to/Ice002_1K-JPG
```

## Preview locally

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

The full opening (breaking the ice, handwriting, stamp) plays once per browser. After that the envelope starts open and the card just fades in. Add `?replay` to the URL to see the full version again.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Markup: envelope, seal, ice, invitation card |
| `css/style.css` | Theme, envelope, ice, card |
| `js/config.js` | All event text and links |
| `js/envelope.js` | Tap logic: spring-based shake, cracks, shatter/open sequence |
| `js/fx.js` | Effects canvas: frost dust, snow burst, flying ice shards |
| `js/snow.js` | Background snowfall: crystal snowflakes up close, soft specks in the distance |
| `js/main.js` | Fills in the config, load-in animation, card open/close |
| `assets/frost.webp` | Frost texture (see credits) |

## Hosting (free)

Any static host works:

- **GitHub Pages**: Settings, then Pages, then deploy from branch `main`, folder `/ (root)`. On github.com's free plan, the repo must be public.
- **Cloudflare Pages**: free, allows private repos. Connect the repo, or upload the folder directly with `npx wrangler pages deploy .`

## Accessibility

- The envelope is a real button, so it works from the keyboard.
- The card is a native `<dialog>`: Esc closes it, and so does clicking outside it.
- With "reduce motion" turned on, one tap opens the envelope with no animation.

## Credits

- Ice texture in the logo: [ambientCG Ice002](https://ambientcg.com/view?id=Ice002), CC0.
- Frost texture: [Pixabay image 2054297](https://pixabay.com/photos/winter-cold-surface-ice-texture-2054297/), Pixabay Content License. Converted to a transparent WebP layer.
- Fonts: Cinzel, Cormorant Garamond, Manrope (Google Fonts, SIL Open Font License).
