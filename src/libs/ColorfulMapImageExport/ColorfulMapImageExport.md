# ColorfulMapImage static export

`exportColorfulMapImage` renders the data texture without MapLibre or any map instance.
The default projection is Web Mercator (`EPSG:3857`).

```ts
import {
  exportColorfulMapImage,
  type IColorfulMapImageExportOptions,
} from '@/libs/ColorfulMapImageExport'

const options: IColorfulMapImageExportOptions = {
  imageData: {
    image: dataTextureUrl,
    lonmin: 72,
    lonmax: 136,
    latmin: 17,
    latmax: 55,
  },
  outputBounds: {
    lonmin: 70,
    lonmax: 140,
    latmin: 15,
    latmax: 58,
  },
  scale: imgScale,
  colors: imgColor,
  colorScale: { enabled: true, blockWidth: 12, blockHeight: 16, position: [2410, 10], labelGap: 8 },
  margin: [10, 12, 56, 64],
  linear: 1,
  flipy: 0,
  format: 'png',
  cut: {
    image: cutTextureUrl,
    lonmin: 73.49,
    lonmax: 135.1,
    latmin: 18.15,
    latmax: 53.57,
  },
  boundaries: [
    {
      data: [provinceFeatureCollection, cityFeatureCollection],
      color: '#55394f',
      lineWidth: 1.5,
      label: { font: '14px Arial, sans-serif', color: '#1f2a36' },
    },
  ],
  axes: {
    width: 2400,
    lonStep: 10,
    latStep: 5,
  },
}

const blob = await exportColorfulMapImage(options)
```

For off-main-thread rendering, call `exportColorfulMapImageInWorker(options)` with the same
structured-cloneable data. It creates a dedicated Worker, renders through `OffscreenCanvas`,
returns a `Blob`, and terminates the Worker. The caller downloads the Blob. Worker input supports
texture URLs, `ImageData`, and transferable `ImageBitmap` sources; custom projection functions and
`AbortSignal` cannot be posted to the Worker. The Worker uses the default Web Mercator projection.
Vite emits the Worker entry and its renderer dependencies as a separate JavaScript asset.

`imageData` accepts one `{ image, lonmin, lonmax, latmin, latmax }` object or an array of them.
For a single object, omitting `outputBounds` exports that texture's extent, as before. Move the
previous top-level `image/lonmin/lonmax/latmin/latmax` fields into `imageData` when migrating.

For an array, `outputBounds` is required, even for an empty or one-item array. Each output pixel
is projected back to longitude/latitude and sampled using the matching texture's independent
extent. Later entries take precedence where extents overlap; encoded values are not blended
between textures. When `minOpacity: true`, samples with zero final opacity are skipped so an
earlier texture can supply the pixel instead. Partially transparent samples retain later-entry
precedence; if no sample remains, the pixel keeps the PNG transparency or JPG background.
`scale`, `colors`, `flipy`, `grid`, `minOpacity`, and `cut` apply to all textures.
An empty array renders only the background, boundaries, axes, and optional color scale.

`minOpacity` defaults to `false`. When enabled, decoded sample values strictly below
`colors.v[0]` are fully transparent. Values equal to or above that minimum retain the opacity
from the color ramp (`colors.o`); there is no additional fade near the threshold. This matches
`ColorfulMapImage` with or without clipping and applies to both main-thread and Worker exports.
When disabled, values below the minimum use the first color's configured opacity as usual.
The old `minOpacityMode` option has been removed; delete it from existing configurations.
For overlapping textures, a skipped low-value sample can reveal an earlier texture rather
than leave a transparent pixel; PNG transparency or the JPG background remains only when
no eligible sample is found.

```ts
const blob = await exportColorfulMapImage({
  imageData: [
    { image: westTextureUrl, lonmin: 70, lonmax: 100, latmin: 15, latmax: 55 },
    { image: eastTextureUrl, lonmin: 100, lonmax: 140, latmin: 15, latmax: 55 },
  ],
  outputBounds: { lonmin: 70, lonmax: 140, latmin: 15, latmax: 58 },
  scale: imgScale,
  colors: imgColor,
  axes: { width: 2400 },
})
```

`outputBounds` controls the exported image extent, axis range, and aspect ratio. The four
`lonmin/lonmax/latmin/latmax` fields on each `imageData` entry describe that data texture itself.
Pixels not covered by any texture remain transparent in PNG or use the JPG background.
`getColorfulMapExportSize` accepts the same extent configuration (without loading images),
or just `outputBounds` plus layout options when no texture configuration is needed.
`axes.width` is the coordinate plot width in pixels. The plot height is calculated from the
projected `outputBounds` aspect ratio. PNG keeps the outside of the cut transparent; JPG uses a
white background by default.

The plot rectangle and the measured color scale rectangle form a union bounding box (`content`).
Only the plot rectangle counts toward content, not axis tick marks or longitude/latitude labels.
The image size is `content width + left margin + right margin` by
`content height + top margin + bottom margin`. Moving the scale never stretches the plot.

Top-level `margin` accepts the CSS shorthand forms `number`, `[vertical, horizontal]`, or
`[top, right, bottom, left]`, defaulting to `[10, 10, 56, 56]`. It lies outside content and applies
whether axes are enabled or disabled. Margins are rounded to non-negative integer pixels.
Use `margin: 0` for no outer whitespace. Tick marks and coordinate labels may extend into the
margin and can be clipped if it is too small. Migrate older `axes.margin` to top-level `margin`.

A boundary layer can also draw region names: set `label` to render each feature's
`properties.name` at `properties.center`, horizontally and vertically centered on that point.
`label.enabled` defaults to `true` when the option object is present, so omit `label` to skip names.

`colorScale` draws one swatch per entry of `colors` (`blockWidth` default 12px, `blockHeight`
default 16px), lowest value at the bottom. `position: [x, y]` places the bottom-left corner of the
entire measured scale relative to the plot's bottom-left corner, in pixels, with x pointing right
and y pointing up. The default is `[plot width + 10, 10]`. Negative coordinates and placement
inside the plot are supported; the scale is always drawn last, above all other layers.
The old `offset` option is replaced by `position`.

`labelAlign` controls vertical label alignment: `'threshold'` (default) centers each label on
its swatch's bottom edge, preserving the original threshold alignment; `'center'` centers it
vertically within the swatch. Both modes place labels `labelGap` px to the right (default 8).
Set `showFirstLabel: false` to hide the lowest value label.
Labels default to `colors.v`; pass `labels` to display the unshifted values when the coloring
pipeline offsets `v`, falling back to `colors.v[i]` for any index without a finite value.
`font` and `color` are configurable. `colorScale.enabled` defaults to `true` when the object is
present. Set `endLabel` to a string such as `'1000 mm'` to draw an additional label centered
vertically on the highest swatch's top edge. It uses the same `labelGap`, `font`, and `color` as
the other labels and is independent of `showFirstLabel`. In `'center'` mode, `endLabel` is ignored:
it is neither drawn nor included in the measured bounds. Both swatches and visible text,
including `endLabel`, are included in the measured width and height. When `endLabel` is omitted
or empty, no top label is drawn and no fixed extra height is reserved; only actual text overflow
is included. The bottom includes any visible first label's overflow.
Thus `position` anchors the scale's measured bounds, not just the bottom swatch. Content expands
in every direction as needed, including when the scale is taller than the plot.

## Title and subtitle

The optional root `title` adds a separate, full-width border-box above the existing exported
image, including its original margins. It does not draw a border or change the image width.

```ts
title: {
  main: { text: '累计降水量', font: 'bold 24px Arial, sans-serif', color: '#1f2a36' },
  sub: { text: '2026-10-27 08:00 — 2026-10-28 08:00', font: '16px Arial, sans-serif', color: '#566574' },
  gap: 8,
  padding: [16, 24, 16, 24],
}
```

`main` and `sub` are optional. Each accepts `text`, a Canvas `font` shorthand (size, family,
weight, and style), and `color`. The styles above are the defaults. Both lines are horizontally
centered within the title box's content area, after subtracting left and right padding.
Each stays on a single line: line breaks become spaces, and overlong text is clipped to the
content area rather than wrapping or widening the image.

`gap` is the vertical space between the two visible text lines, defaulting to 8px. It is only
included when both lines are non-empty. `padding` applies to the entire title box, defaults to
16px, and accepts the same CSS shorthand forms as `margin`: a number, `[vertical, horizontal]`,
or `[top, right, bottom, left]`. Negative or non-finite padding becomes zero; negative gaps become
zero and non-finite gaps use the default. Blank or missing lines occupy no space. If neither
line has text, no title box or padding is added.

Line heights use the measured text's ascent plus descent, with a font-size fallback when Canvas
text metrics are unavailable. The final title box height is rounded upward to whole pixels:

```text
title height = ceil(top padding + visible line heights + interline gap + bottom padding)
final image height = previous image height + title height
```

The plot, boundaries, axes, and color scale move down by exactly the title height; their sizes,
relative positions, the original image margins, and the geographic `aspectRatio` remain unchanged.
`getColorfulMapExportSize` includes this same additional height. Main-thread and Worker exports
both support this configuration. PNG retains the transparent title background; JPG fills it
with the same background as the rest of the image.

The renderer batches each boundary style into one Canvas path. It can run on an
`OffscreenCanvas` by setting `preferOffscreenCanvas: true`, so the same function can be called
from a dedicated Web Worker when the caller supplies transferable image sources such as an
`ImageBitmap`.
