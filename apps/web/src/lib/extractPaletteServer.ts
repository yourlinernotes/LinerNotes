// Server-side color extraction from album artwork using node-vibrant
// Extracts real colors from Spotify/Last.fm images without CORS issues

import { Vibrant } from 'node-vibrant/node';
import type { Palette } from './palette';

// Convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert RGB to HSL for manipulation
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s * 100, l * 100];
}

// Convert HSL to hex
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * Extract colors from an image URL and generate a Palette
 * Server-side only - uses node-vibrant to avoid CORS issues
 */
export async function extractPaletteFromUrl(
  imageUrl: string
): Promise<Palette | null> {
  try {
    if (!imageUrl || imageUrl.includes('2a96cbd8b46e442fc41c2b86b821562f')) {
      return null; // Placeholder image
    }

    const palette = await Vibrant.from(imageUrl).getPalette();

    // Get the dominant/vibrant color
    const swatch = palette.Vibrant || palette.DarkVibrant || palette.Muted;
    if (!swatch) return null;

    const [r, g, b] = swatch.rgb;
    const [h, s, l] = rgbToHsl(r, g, b);

    // Generate warm secondary hue (offset by 28°)
    const warm = (h + 28) % 360;

    // For low-saturation images, use minimal saturation
    const isLowSat = s < 15;
    const baseSat = isLowSat ? Math.min(s * 1.2, 12) : Math.min(s * 1.1, 100);

    // Create palette based on extracted colors
    const result: Palette = {
      deep: hslToHex(h, baseSat * 0.85, 13), // Dark base
      mid: hslToHex(h, baseSat * 0.9, 31), // Medium tone
      lo: hslToHex(warm, baseSat * 0.8, 9), // Secondary warm tone
      accent: hslToHex(h, Math.min(baseSat * 1.2, 100), Math.min(l * 1.1, 56)), // Bright accent
      glow: hslToHex(warm, Math.min(baseSat * 1.3, 100), 48), // Glow layer
    };

    return result;
  } catch (error) {
    console.error('[extractPaletteServer] Failed to extract palette:', error);
    return null;
  }
}
