# ColorfulMapImage static export

`exportColorfulMapImage` renders the data texture without MapLibre or any map instance.
The default projection is Web Mercator (`EPSG:3857`).

```ts
import {
  exportColorfulMapImage,
  type IColorfulMapImageExportOptions,
} from '@/libs/ColorfulMapImageExport'

const options: IColorfulMapImageExportOptions = {
  image: dataTextureUrl,
  lonmin: 72,
  lonmax: 136,
  latmin: 17,
  latmax: 55,
  outputBounds: {
    lonmin: 70,
    lonmax: 140,
    latmin: 15,
    latmax: 58,
  },
  scale: imgScale,
  colors: imgColor,
  colorScale: { enabled: true, blockWidth: 12, blockHeight: 16, offset: 16, labelGap: 8 },
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
    margin: [10, 12, 56, 64],
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

`outputBounds` controls the exported image extent, axis range, and aspect ratio. The four
`lonmin/lonmax/latmin/latmax` fields continue to describe the data texture itself. Pixels in
the output extent outside the data texture remain transparent in PNG or use the JPG background.
`axes.width` is the coordinate plot width in pixels. The plot height is calculated from the
projected `outputBounds` aspect ratio, then the axis margins are added to produce the final image
size. PNG keeps the outside of the cut transparent; JPG uses a white background by default.

`axes.margin` accepts the CSS shorthand forms `number`, `[vertical, horizontal]`, or
`[top, right, bottom, left]`. When omitted, the renderer keeps its default axis layout margins.

A boundary layer can also draw region names: set `label` to render each feature's
`properties.name` at `properties.center`, horizontally and vertically centered on that point.
`label.enabled` defaults to `true` when the option object is present, so omit `label` to skip names.

`colorScale` draws a vertical color scale in the right margin, outside the coordinate plot: one
swatch per entry of `colors` (`blockWidth` default 12px, `blockHeight` default 16px), lowest value
at the bottom, its stack bottom aligned with the plot bottom and its left edge `offset` px to the
right of the plot (default 16). Each value label is vertically centered on its swatch's bottom edge
and sits `labelGap` px to the right of the swatch (default 8); set `showFirstLabel: false` to hide
the lowest value label. Labels default to `colors.v`; pass `values` to display a different value
axis per swatch (useful when the coloring pipeline offsets the `v` component), falling back to
`colors.v[i]` for any index without a finite value.
`font` and `color` are configurable. The renderer measures the label text and reserves a band of
`16 + blockWidth + 8 + widest label` to the right of the plot; this band is added to `axes.margin`,
so `margin[1]` stays exactly as configured and remains as blank space to the right of the scale.
The exported width becomes `left margin + axes.width + color scale band + right margin`.
`colorScale.enabled` defaults to `true` when the object is present. Because the scale is anchored at
the plot bottom and grows upward, it clips if its height exceeds the plot.

The renderer batches each boundary style into one Canvas path. It can run on an
`OffscreenCanvas` by setting `preferOffscreenCanvas: true`, so the same function can be called
from a dedicated Web Worker when the caller supplies transferable image sources such as an
`ImageBitmap`.
