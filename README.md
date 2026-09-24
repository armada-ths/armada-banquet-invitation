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

Then open this URL. The fixed `dev` token only works on localhost:

```text
http://localhost:5173/#access=dev&name=Local%20Preview
```

The full opening (breaking the ice, handwriting, stamp) plays on every page load. If the card is closed and reopened, it just fades in with everything already written.

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

## Invitation links and access

Production links contain a shared access token and the invitee's name in the URL fragment:

```text
https://banquet.armada.nu/#access=TOKEN&name=URL_ENCODED_NAME
```

The fragment is not sent to GitHub Pages. After a successful check, the page stores the token in a host-only cookie and the name in local storage, then removes the fragment from the address bar. The cookie expires at `2026-11-18T23:00:00Z` (midnight in Stockholm after 18 November). A later visit from the same browser therefore works without the fragment until that time.

Always URL-encode the full name. For example, this browser-console snippet creates a link without modifying the token:

```js
const token = "PASTE_THE_SAVED_TOKEN_HERE";
const name = "Anna Andersson";
const link = `https://banquet.armada.nu/#${new URLSearchParams({ access: token, name })}`;
console.log(link);
```

The access check is intentionally a lightweight client-side gate. GitHub Pages publishes the HTML, CSS and JavaScript publicly, so this is not authentication and must not be used to protect sensitive information.

### Create and configure the production token

Generate at least 32 random bytes as a Base64URL value and keep a recoverable copy outside GitHub. GitHub does not show a secret again after it has been saved.

PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
```

OpenSSL:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n'
```

In the repository, open **Settings → Secrets and variables → Actions**, create a repository secret named `BANQUET_ACCESS_TOKEN`, and paste the generated value. Rotating the token means replacing that secret, redeploying the workflow, and issuing new links. Previously stored cookies stop working as soon as the new deployment is live.

## GitHub Pages deployment

`.github/workflows/deploy-pages.yml` validates every pull request but only deploys pushes to `main` or manual workflow runs. During a production build it hashes `BANQUET_ACCESS_TOKEN`, injects only the hash into the static artifact, verifies that the raw token is absent, and publishes through GitHub Pages.

One-time repository setup:

1. Add the `BANQUET_ACCESS_TOKEN` repository secret described above.
2. Open **Settings → Pages** and choose **GitHub Actions** as the source.
3. Set the custom domain to `banquet.armada.nu` and enable **Enforce HTTPS** when GitHub makes it available.
4. At the authoritative DNS provider, add `CNAME banquet → armada-ths.github.io.`
5. Push to `main` or run **Deploy to GitHub Pages** manually, then verify a complete invitation link in a clean browser profile.

The workflow deliberately excludes repository metadata, development tools and documentation from the published artifact.

## Accessibility

- The envelope is a real button, so it works from the keyboard.
- The card is a native `<dialog>`: Esc closes it, and so does clicking outside it.
- With "reduce motion" turned on, one tap opens the envelope with no animation.

## Credits

- Ice texture in the logo: [ambientCG Ice002](https://ambientcg.com/view?id=Ice002), CC0.
- Frost texture: [Pixabay image 2054297](https://pixabay.com/photos/winter-cold-surface-ice-texture-2054297/), Pixabay Content License. Converted to a transparent WebP layer.
- Fonts: Cinzel, Cormorant Garamond, Manrope (Google Fonts, SIL Open Font License).
