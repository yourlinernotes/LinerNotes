// Deterministic album/user colour derivation.
//
// The design bundle ships hand-extracted album palettes ({deep,mid,lo,accent,glow}).
// Real data has no palette, so we synthesise a stable one from a seed string
// (albumId / trackId / title). Output is always 6-digit hex so callers can append
// an alpha suffix (e.g. `${p.accent}55`) the way the design does.

export type Palette = {
  deep: string;
  mid: string;
  lo: string;
  accent: string;
  glow: string;
};

function hashString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

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

export function paletteFromString(seed: string | undefined | null): Palette {
  const s = (seed && seed.length ? seed : "linernotes").toString();
  const hue = hashString(s) % 360;
  // a warm secondary hue offset keeps the floods from looking flat
  const warm = (hue + 28) % 360;
  return {
    deep: hslToHex(hue, 48, 13),
    mid: hslToHex(hue, 52, 31),
    lo: hslToHex(warm, 46, 9),
    accent: hslToHex(hue, 66, 56),
    glow: hslToHex(warm, 70, 48),
  };
}

// A single warm tint for a user's monogram avatar / profile band.
export function tintFromString(seed: string | undefined | null): string {
  const s = (seed && seed.length ? seed : "ln").toString();
  const hue = hashString(s + "·tint") % 360;
  return hslToHex(hue, 58, 62);
}
