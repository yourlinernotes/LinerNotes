// Client-side color extraction from album artwork using FastAverageColor
// Converts extracted colors to Palette format for gradient overlays

import { FastAverageColor } from "fast-average-color";
import type { Palette } from "./palette";

// Convert RGB to HSL
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
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * Extract colors from an image and generate a Palette
 * @param imgElement - The image element to extract colors from
 * @returns Promise<Palette> - A palette with deep, mid, lo, accent, and glow colors
 */
export async function extractPaletteFromImage(
  imgElement: HTMLImageElement
): Promise<Palette | null> {
  try {
    const fac = new FastAverageColor();
    const color = await fac.getColorAsync(imgElement);

    // Extract RGB values
    const [r, g, b] = color.value.slice(0, 3);
    const [h, s, l] = rgbToHsl(r, g, b);

    // Generate warm secondary hue (offset by 28°)
    const warm = (h + 28) % 360;

    // Create palette similar to paletteFromString but based on extracted hue
    const palette: Palette = {
      deep: hslToHex(h, Math.max(s * 0.9, 48), 13), // Dark base
      mid: hslToHex(h, Math.max(s * 0.95, 52), 31), // Medium tone
      lo: hslToHex(warm, Math.max(s * 0.85, 46), 9), // Secondary warm tone
      accent: hslToHex(h, Math.min(s * 1.2, 100), Math.min(l * 1.1, 56)), // Bright accent
      glow: hslToHex(warm, Math.min(s * 1.3, 100), 48), // Glow layer
    };

    return palette;
  } catch (error) {
    console.error("Failed to extract palette from image:", error);
    return null;
  }
}
