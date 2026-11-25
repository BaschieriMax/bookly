/** Side of the icon the server accepts (TenantSettingsService.HomeIconSize, DEC-043). */
export const HOME_ICON_SIZE = 256

/** Share of the side a logo with transparent parts takes, centred on its background. */
const PADDED_LOGO_RATIO = 0.76
const LIGHT_BACKGROUND = '#ffffff'
const DARK_BACKGROUND = '#18181b'
/** Average luminance above which a transparent logo goes on the dark background. */
const LIGHT_LOGO_LUMINANCE = 0.75
const SAMPLE_SIZE = 32

export interface LogoAppearance {
  /** Some pixels are (partly) transparent: iOS would paint them black. */
  transparent: boolean
  /** The visible pixels are mostly light: on white the logo would disappear. */
  light: boolean
}

/** Reads RGBA pixels (as from getImageData) and tells how the logo must be laid out. */
export function analyseLogoPixels(rgba: Uint8ClampedArray): LogoAppearance {
  let transparent = false
  let weight = 0
  let luminance = 0
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const [r = 0, g = 0, b = 0, a = 0] = rgba.subarray(i, i + 4)
    const alpha = a / 255
    if (alpha < 0.98) {
      transparent = true
    }
    weight += alpha
    luminance += alpha * ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255)
  }
  return { transparent, light: weight > 0 && luminance / weight > LIGHT_LOGO_LUMINANCE }
}

/**
 * Makes the home-screen icon of a business from its logo (DEC-043): a 256×256 PNG with no
 * transparency, because iOS paints transparent pixels black. An opaque logo fills the square;
 * one with transparent parts is centred on white, or on near-black when it is mostly light.
 * Returns null when the browser cannot decode or draw it: the logo is then saved without an icon
 * and the home screen shows Turnora's.
 */
export async function createHomeScreenIcon(logo: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') {
    return null
  }
  try {
    const bitmap = await createImageBitmap(logo)
    try {
      const appearance = analyseLogoPixels(samplePixels(bitmap))
      const canvas = document.createElement('canvas')
      canvas.width = HOME_ICON_SIZE
      canvas.height = HOME_ICON_SIZE
      const context = canvas.getContext('2d')
      if (!context) {
        return null
      }
      context.fillStyle =
        appearance.transparent && appearance.light ? DARK_BACKGROUND : LIGHT_BACKGROUND
      context.fillRect(0, 0, HOME_ICON_SIZE, HOME_ICON_SIZE)
      const box = appearance.transparent ? HOME_ICON_SIZE * PADDED_LOGO_RATIO : HOME_ICON_SIZE
      drawContained(context, bitmap, box)
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    } finally {
      bitmap.close()
    }
  } catch {
    return null
  }
}

function samplePixels(bitmap: ImageBitmap): Uint8ClampedArray {
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('2D canvas not available')
  }
  context.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  return context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data
}

/** Draws the image as large as fits in a centred box of the given side, keeping its proportions. */
function drawContained(context: CanvasRenderingContext2D, bitmap: ImageBitmap, box: number) {
  const scale = Math.min(box / bitmap.width, box / bitmap.height)
  const width = bitmap.width * scale
  const height = bitmap.height * scale
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    bitmap,
    (HOME_ICON_SIZE - width) / 2,
    (HOME_ICON_SIZE - height) / 2,
    width,
    height,
  )
}
