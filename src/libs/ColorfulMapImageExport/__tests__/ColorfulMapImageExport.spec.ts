import { describe, expect, it } from 'vitest'
import { getColorfulMapExportSize, webMercatorProjection } from '../ColorfulMapImageExport'

describe('ColorfulMapImage export sizing', () => {
  it('derives the plot height from axes.width and the projected aspect ratio', () => {
    const result = getColorfulMapExportSize({
      lonmin: 72,
      lonmax: 136,
      latmin: 17,
      latmax: 55,
      axes: { enabled: false, width: 1200 },
      projection: webMercatorProjection,
    })

    expect(result.width).toBe(1200)
    expect(result.height).toBeGreaterThan(900)
    expect(result.aspectRatio).toBeGreaterThan(1)
  })

  it('accepts a switchable projection for axes.width sizing', () => {
    const equirectangular = {
      id: 'EPSG:4326',
      forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
      inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
    }
    const result = getColorfulMapExportSize({
      lonmin: 0,
      lonmax: 20,
      latmin: 10,
      latmax: 20,
      axes: { enabled: false, width: 1000 },
      projection: equirectangular,
    })

    expect(result.width).toBe(1000)
    expect(result.height).toBe(500)
    expect(result.aspectRatio).toBe(2)
  })

  it('uses outputBounds for image sizing while keeping the data extent separate', () => {
    const result = getColorfulMapExportSize({
      lonmin: 10,
      lonmax: 20,
      latmin: 10,
      latmax: 20,
      outputBounds: { lonmin: 0, lonmax: 30, latmin: 0, latmax: 60 },
      axes: { enabled: false, width: 900 },
      projection: webMercatorProjection,
    })

    expect(result.width).toBe(900)
    const projectedWidth =
      webMercatorProjection.forward(30, 0).x - webMercatorProjection.forward(0, 0).x
    const projectedHeight =
      webMercatorProjection.forward(0, 0).y - webMercatorProjection.forward(0, 60).y
    expect(result.aspectRatio).toBeCloseTo(projectedWidth / projectedHeight)
  })

  it('adds CSS-style axis margins around the coordinate plot', () => {
    const result = getColorfulMapExportSize({
      lonmin: 10,
      lonmax: 20,
      latmin: 10,
      latmax: 20,
      outputBounds: { lonmin: 0, lonmax: 20, latmin: 0, latmax: 10 },
      axes: { width: 900, margin: [10, 20, 30, 40] },
      projection: {
        id: 'EPSG:4326',
        forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
        inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
      },
    })

    expect(result.width).toBe(960)
    expect(result.height).toBe(490)
  })

  it.each([
    { margin: 20, width: 940, height: 490 },
    { margin: [10, 20] as [number, number], width: 940, height: 470 },
  ])('expands $margin around the plot', ({ margin, width, height }) => {
    const result = getColorfulMapExportSize({
      lonmin: 0,
      lonmax: 20,
      latmin: 0,
      latmax: 10,
      axes: { width: 900, margin },
      projection: {
        id: 'EPSG:4326',
        forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
        inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
      },
    })

    expect(result.width).toBe(width)
    expect(result.height).toBe(height)
  })

  it('keeps the default plot width and axis margins', () => {
    const result = getColorfulMapExportSize({
      lonmin: 0,
      lonmax: 20,
      latmin: 0,
      latmax: 10,
      projection: {
        id: 'EPSG:4326',
        forward: (lon: number, lat: number) => ({ x: lon, y: -lat }),
        inverse: (x: number, y: number) => ({ lon: x, lat: -y }),
      },
    })

    expect(result.width).toBe(1666)
    expect(result.height).toBe(866)
  })
})
