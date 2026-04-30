# PageHeader visual regression

Automated screenshot diffing for the `<PageHeader>` component across the key
top-level routes. Catches typography, spacing, hairline, and action-alignment
regressions immediately.

## How it works

1. The `PageHeader` component renders a stable `data-visual-id="page-header"`
   anchor on its root element.
2. `pageheader-diff.mjs` boots Chromium via Playwright, navigates to each
   route, disables animations, and screenshots the header element.
3. Each capture is diffed against a baseline PNG with `pixelmatch`. Any route
   exceeding the mismatch ratio (default `0.5%`) fails the run with exit 1.

Routes covered: `/`, `/tasks`, `/agents`, `/plans`, `/jobs`, `/inbox`,
`/analytics`, `/deliverables`, `/integrations`.

Each route is captured at three viewports: **tablet 768×1024**, **laptop
1366×768**, **wide 1920×1080**. Mobile (<640px) is excluded by policy — see
`mem://constraints/viewport-support`. Baselines and diffs are filenamed
`<viewport>__<route>.png`.

## One-time setup

```bash
bun add -d playwright pixelmatch pngjs
bunx playwright install chromium
```

## Run the diff

```bash
# against local dev server
bun run dev &
node scripts/visual/pageheader-diff.mjs

# against the deployed preview
BASE_URL=https://id-preview--<project>.lovable.app \
  node scripts/visual/pageheader-diff.mjs
```

## Refresh baselines (after an intentional design change)

```bash
node scripts/visual/pageheader-diff.mjs --update
```

Commit the updated PNGs in `scripts/visual/baselines/`.

## Output

- `scripts/visual/baselines/<route>.png` — committed source of truth
- `scripts/visual/actual/<route>.png` — last captured screenshot
- `scripts/visual/diff/<route>.png` — red overlay of mismatched pixels

## CI integration

Add to your CI workflow after a build + preview server is up:

```yaml
- run: bunx playwright install --with-deps chromium
- run: node scripts/visual/pageheader-diff.mjs
- if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: pageheader-visual-diff
    path: scripts/visual/diff
```
