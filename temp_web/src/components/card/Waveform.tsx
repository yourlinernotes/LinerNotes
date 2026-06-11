"use client";

interface WaveformProps {
  momentSeconds: number;
  duration: number;
  accentColor: string;
  baseColor: string;
  className?: string;
}

export function Waveform({
  momentSeconds,
  duration,
  accentColor,
  baseColor,
  className = "",
}: WaveformProps) {
  // Generate procedural waveform bars
  const barCount = 100;
  const bars = Array.from({ length: barCount }, (_, i) => {
    // Procedural heights with some variation
    const progress = i / barCount;
    const baseHeight = 30 + Math.sin(progress * Math.PI * 4) * 20;
    const noise = Math.sin(i * 0.5) * 10;
    return Math.max(10, Math.min(80, baseHeight + noise));
  });

  // Calculate moment position (0-1)
  const momentPosition = momentSeconds / duration;
  const momentBarIndex = Math.floor(momentPosition * barCount);

  return (
    <div className={`flex items-end gap-[2px] h-20 ${className}`}>
      {bars.map((height, i) => {
        const isMomentBar = Math.abs(i - momentBarIndex) <= 1;
        return (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all"
            style={{
              height: `${isMomentBar ? Math.min(height * 1.3, 100) : height}%`,
              backgroundColor: isMomentBar ? accentColor : baseColor,
              minWidth: "2px",
            }}
          />
        );
      })}
    </div>
  );
}
