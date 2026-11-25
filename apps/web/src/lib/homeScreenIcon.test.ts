import { describe, expect, it } from 'vitest'
import { analyseLogoPixels, createHomeScreenIcon } from './homeScreenIcon'

/** RGBA pixels: each entry is [r, g, b, a]. */
const pixels = (...rgba: number[][]) => new Uint8ClampedArray(rgba.flat())

describe('analyseLogoPixels', () => {
  it('lets an opaque logo fill the icon', () => {
    expect(analyseLogoPixels(pixels([20, 20, 20, 255], [240, 240, 240, 255]))).toEqual({
      transparent: false,
      light: false,
    })
  })

  it('puts a dark logo with transparent parts on white', () => {
    expect(analyseLogoPixels(pixels([0, 0, 0, 0], [30, 30, 30, 255]))).toEqual({
      transparent: true,
      light: false,
    })
  })

  it('puts a white logo with transparent parts on a dark background', () => {
    expect(
      analyseLogoPixels(pixels([0, 0, 0, 0], [255, 255, 255, 255], [250, 250, 250, 200])),
    ).toEqual({
      transparent: true,
      light: true,
    })
  })

  it('treats a fully transparent image as dark, so it goes on white', () => {
    expect(analyseLogoPixels(pixels([255, 255, 255, 0], [255, 255, 255, 0]))).toEqual({
      transparent: true,
      light: false,
    })
  })
})

describe('createHomeScreenIcon', () => {
  it('gives up without failing when the browser cannot draw images', async () => {
    // jsdom has no createImageBitmap: the logo is then uploaded without an icon.
    await expect(createHomeScreenIcon(new Blob(['x'], { type: 'image/png' }))).resolves.toBeNull()
  })
})
