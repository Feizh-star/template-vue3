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

The renderer batches each boundary style into one Canvas path. It can run on an
`OffscreenCanvas` by setting `preferOffscreenCanvas: true`, so the same function can be called
from a dedicated Web Worker when the caller supplies transferable image sources such as an
`ImageBitmap`.
