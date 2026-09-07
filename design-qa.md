# Design QA — réparation bannière et météo

- Source visual truth: `/workspace/scratch/4eb0a6702eba/upload/01-1000061944.jpg` and `/workspace/scratch/4eb0a6702eba/upload/02-1000061943.jpg`
- Supplied banner artwork: `/workspace/scratch/4eb0a6702eba/upload/01-1000061935.png`
- Implementation screenshot: `/workspace/scratch/4eb0a6702eba/Travel-Api-fix-assets/qa-fixed-mobile.png`
- Side-by-side comparison: `/workspace/scratch/4eb0a6702eba/Travel-Api-fix-assets/qa-comparison.png`
- Browser viewport: 1363 × 936 CSS px, devicePixelRatio 1
- Mobile content frame: 390 × 844 CSS px
- Source captures: 688 × 1536 px; implementation capture: 390 × 844 px
- State: authenticated homepage components reproduced in the QA harness

## Full-view comparison evidence

The combined comparison shows the reported broken dark banner and missing weather icon on the left, and the repaired components on the right. The supplied API Travel banner now renders at its original 1536 × 576 resolution. The weather card renders a local animated SVG for the current condition rather than a broken external image.

## Focused comparison evidence

The browser confirmed `assets/api-travel-banner.jpg` loaded completely at 1536 × 576 and `assets/weather/drizzle.svg` loaded completely at 150 × 150. The account dock remains visible above the banner. The weather card measures 362 × 156 CSS px inside a 390 px mobile frame, with no clipping or overflow.

## Required fidelity surfaces

- Fonts and typography: existing Inter hierarchy and weights are unchanged; labels and weather values remain legible.
- Spacing and layout rhythm: existing mobile margins, card radius, account-dock position, and weather two-column layout are preserved.
- Colors and visual tokens: existing navy, cyan, white, and pale-blue Travel palette is preserved.
- Image quality and asset fidelity: the original supplied banner is used directly; nine official Meteocons animated SVG assets are stored locally.
- Copy and content: API Travel banner text and live weather copy are unchanged.

## Primary interactions and console

- Banner and condition icon loaded successfully in the Cloud Browser.
- Weather link remains present.
- No page console errors were found. One unrelated browser-extension metadata error was ignored.

## Findings

- Initial P0: banner asset was corrupt and rendered as a dark empty card. Fixed with the valid supplied raster.
- Initial P1: weather icon URL returned no usable image on the device. Fixed by bundling local animated SVGs and using relative asset URLs.
- No remaining actionable P0, P1, or P2 issue in the repaired components.

## Comparison history

1. User captures showed both image resources broken.
2. Local browser pass confirmed the replacement banner and weather SVG load with valid intrinsic dimensions.
3. Mobile-frame capture confirmed the repaired layout without clipping.

## Implementation checklist

- Deploy the valid banner asset.
- Deploy all nine local weather icons and their license notice.
- Publish the relative weather icon paths.
- Bump CSS and JavaScript cache versions.
- Recheck production assets and runtime errors.

## Follow-up polish

- None required for this repair.

final result: passed
