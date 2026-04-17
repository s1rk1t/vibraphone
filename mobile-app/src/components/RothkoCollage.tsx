import { useEffect, useMemo, useRef } from "react";
import type { CollageCell, CollageResponse } from "../api";

interface RothkoCollageProps {
  collage: CollageResponse | null;
}

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

interface BlobSeed {
  key: string;
  color: string;
  baseX: number;
  baseY: number;
  radius: number;
  xAmplitude: number;
  yAmplitude: number;
  xFrequency: number;
  yFrequency: number;
  phase: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
}

interface BlobState {
  color: string;
  x: number;
  y: number;
  radius: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
}

const FIELD_ANCHORS = [
  { x: 0.22, y: 0.24 },
  { x: 0.76, y: 0.3 },
  { x: 0.54, y: 0.72 },
  { x: 0.18, y: 0.68 },
  { x: 0.82, y: 0.66 }
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hexColor: string): RgbColor {
  const normalized = hexColor.replace("#", "");

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgba(hexColor: string, alpha: number): string {
  const { red, green, blue } = hexToRgb(hexColor);
  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha, 0, 1)})`;
}

function rgbToHex(color: RgbColor): string {
  const toChannel = (value: number) => Math.round(value).toString(16).padStart(2, "0").toUpperCase();
  return `#${toChannel(color.red)}${toChannel(color.green)}${toChannel(color.blue)}`;
}

function mixHexColors(colors: string[]): string {
  const total = colors.length || 1;
  const mixed = colors.reduce<RgbColor>(
    (accumulator, color) => {
      const rgb = hexToRgb(color);

      return {
        red: accumulator.red + rgb.red,
        green: accumulator.green + rgb.green,
        blue: accumulator.blue + rgb.blue
      };
    },
    { red: 0, green: 0, blue: 0 }
  );

  return rgbToHex({
    red: mixed.red / total,
    green: mixed.green / total,
    blue: mixed.blue / total
  });
}

function getPalette(collage: CollageResponse): string[] {
  const dominant = collage.dominantColors.map((color) => color.hexColor);

  if (dominant.length >= 3) {
    return dominant.slice(0, 5);
  }

  return collage.cells.slice(0, 5).map((cell) => cell.hexColor);
}

function rankedCells(collage: CollageResponse): CollageCell[] {
  const populated = [...collage.cells]
    .sort((left, right) => right.sampleCount - left.sampleCount || right.intensity - left.intensity);

  const selected = populated.filter((cell) => cell.sampleCount > 0).slice(0, 6);

  if (selected.length >= 6) {
    return selected;
  }

  const fallback = populated
    .filter((cell) => !selected.some((chosen) => chosen.index === cell.index))
    .slice(0, 6 - selected.length);

  return [...selected, ...fallback];
}

function buildBlobSeeds(collage: CollageResponse): BlobSeed[] {
  const palette = getPalette(collage);
  const cellSeeds = rankedCells(collage).map((cell, index) => {
    const density = Math.min(1, cell.sampleCount / 5);
    const baseX = 0.12 + (((cell.column + 0.5) / collage.width) * 0.76);
    const baseY = 0.12 + (((cell.row + 0.5) / collage.height) * 0.74);

    return {
      key: `cell-${cell.index}`,
      color: cell.hexColor,
      baseX,
      baseY,
      radius: 0.12 + (cell.intensity * 0.08) + (density * 0.06),
      xAmplitude: 0.028 + (density * 0.012) + ((index % 3) * 0.005),
      yAmplitude: 0.032 + (cell.intensity * 0.014) + (((index + 1) % 3) * 0.004),
      xFrequency: 0.22 + ((index % 4) * 0.035),
      yFrequency: 0.18 + (((index + 2) % 4) * 0.032),
      phase: (index * 1.6) + (cell.row * 0.45) + (cell.column * 0.35),
      scaleX: 1.08 + (density * 0.1),
      scaleY: 0.92 + (cell.intensity * 0.08),
      rotation: ((index % 5) - 2) * 0.18,
      alpha: 0.3 + (cell.intensity * 0.18) + (density * 0.08)
    };
  });

  const anchorSeeds = palette.slice(0, 3).map((color, index) => ({
    key: `anchor-${index}`,
    color,
    baseX: FIELD_ANCHORS[index].x,
    baseY: FIELD_ANCHORS[index].y,
    radius: 0.19 - (index * 0.012),
    xAmplitude: 0.02 + (index * 0.004),
    yAmplitude: 0.024 + (index * 0.005),
    xFrequency: 0.12 + (index * 0.024),
    yFrequency: 0.1 + (index * 0.02),
    phase: index * 2.1,
    scaleX: 1.18 - (index * 0.04),
    scaleY: 0.96 + (index * 0.03),
    rotation: (index - 1) * 0.12,
    alpha: 0.22 + (index * 0.03)
  }));

  return [...anchorSeeds, ...cellSeeds];
}

function materializeBlobs(seeds: BlobSeed[], width: number, height: number, time: number): BlobState[] {
  const minDimension = Math.min(width, height);

  return seeds.map((seed) => {
    const x = clamp(
      seed.baseX
        + (Math.sin((time * seed.xFrequency) + seed.phase) * seed.xAmplitude)
        + (Math.cos((time * (seed.yFrequency * 0.66)) + seed.phase) * 0.01),
      0.04,
      0.96
    );
    const y = clamp(
      seed.baseY
        + (Math.cos((time * seed.yFrequency) + seed.phase) * seed.yAmplitude)
        + (Math.sin((time * (seed.xFrequency * 0.72)) + seed.phase) * 0.01),
      0.06,
      0.94
    );
    const pulse = 1 + (Math.sin((time * 0.46) + seed.phase) * 0.08);

    return {
      color: seed.color,
      x: x * width,
      y: y * height,
      radius: seed.radius * minDimension * pulse,
      scaleX: seed.scaleX + (Math.sin((time * 0.34) + seed.phase) * 0.08),
      scaleY: seed.scaleY + (Math.cos((time * 0.28) + seed.phase) * 0.07),
      rotation: seed.rotation + (Math.sin((time * 0.16) + seed.phase) * 0.12),
      alpha: seed.alpha
    };
  });
}

function drawBackdrop(context: CanvasRenderingContext2D, width: number, height: number, palette: string[], time: number) {
  context.clearRect(0, 0, width, height);

  const baseGradient = context.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, rgba(mixHexColors(palette.slice(0, 2)), 0.96));
  baseGradient.addColorStop(0.5, rgba(mixHexColors(palette.slice(1, 4)), 0.92));
  baseGradient.addColorStop(1, rgba(mixHexColors(palette.slice(-2)), 0.9));
  context.fillStyle = baseGradient;
  context.fillRect(0, 0, width, height);

  palette.slice(0, 5).forEach((color, index) => {
    const anchor = FIELD_ANCHORS[index % FIELD_ANCHORS.length];
    const driftX = Math.sin((time * (0.08 + (index * 0.02))) + index) * width * 0.025;
    const driftY = Math.cos((time * (0.06 + (index * 0.018))) + index) * height * 0.03;
    const radius = Math.max(width, height) * (0.54 - (index * 0.05));
    const gradient = context.createRadialGradient(
      (anchor.x * width) + driftX,
      (anchor.y * height) + driftY,
      radius * 0.08,
      (anchor.x * width) + driftX,
      (anchor.y * height) + driftY,
      radius
    );

    gradient.addColorStop(0, rgba(color, 0.34 - (index * 0.04)));
    gradient.addColorStop(0.45, rgba(color, 0.18 - (index * 0.02)));
    gradient.addColorStop(1, rgba(color, 0));

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  });

  const glaze = context.createLinearGradient(0, 0, width, height);
  glaze.addColorStop(0, "rgba(255,255,255,0.08)");
  glaze.addColorStop(0.5, "rgba(255,255,255,0)");
  glaze.addColorStop(1, "rgba(38,24,30,0.1)");
  context.fillStyle = glaze;
  context.fillRect(0, 0, width, height);
}

function drawBlob(context: CanvasRenderingContext2D, blob: BlobState) {
  context.save();
  context.translate(blob.x, blob.y);
  context.rotate(blob.rotation);
  context.scale(blob.scaleX, blob.scaleY);

  const gradient = context.createRadialGradient(
    -blob.radius * 0.18,
    -blob.radius * 0.1,
    blob.radius * 0.12,
    0,
    0,
    blob.radius
  );
  gradient.addColorStop(0, rgba(blob.color, blob.alpha));
  gradient.addColorStop(0.4, rgba(blob.color, blob.alpha * 0.86));
  gradient.addColorStop(0.72, rgba(blob.color, blob.alpha * 0.28));
  gradient.addColorStop(1, rgba(blob.color, 0));

  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, blob.radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawConnector(context: CanvasRenderingContext2D, left: BlobState, right: BlobState) {
  const deltaX = right.x - left.x;
  const deltaY = right.y - left.y;
  const distance = Math.hypot(deltaX, deltaY);
  const mergeDistance = (left.radius + right.radius) * 1.02;

  if (distance === 0 || distance > mergeDistance) {
    return;
  }

  const closeness = 1 - (distance / mergeDistance);
  const mixedColor = mixHexColors([left.color, right.color]);
  const midpointX = (left.x + right.x) / 2;
  const midpointY = (left.y + right.y) / 2;
  const radius = ((left.radius + right.radius) * 0.22) + (closeness * 56);
  const rotation = Math.atan2(deltaY, deltaX);

  context.save();
  context.translate(midpointX, midpointY);
  context.rotate(rotation);
  context.scale(1.3 + (closeness * 0.22), 0.56 + (closeness * 0.14));

  const bridgeGradient = context.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
  bridgeGradient.addColorStop(0, rgba(mixedColor, 0.18 + (closeness * 0.2)));
  bridgeGradient.addColorStop(0.5, rgba(mixedColor, 0.12 + (closeness * 0.12)));
  bridgeGradient.addColorStop(1, rgba(mixedColor, 0));

  context.fillStyle = bridgeGradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  palette: string[],
  seeds: BlobSeed[]
) {
  drawBackdrop(context, width, height, palette, time);

  const blobs = materializeBlobs(seeds, width, height, time);

  for (let index = 0; index < blobs.length; index += 1) {
    for (let neighborIndex = index + 1; neighborIndex < blobs.length; neighborIndex += 1) {
      drawConnector(context, blobs[index], blobs[neighborIndex]);
    }
  }

  blobs.forEach((blob) => drawBlob(context, blob));
}

function LavaLampField({ collage }: { collage: CollageResponse }) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const palette = useMemo(() => getPalette(collage), [collage]);
  const seeds = useMemo(() => buildBlobSeeds(collage), [collage]);

  useEffect(() => {
    const surface = surfaceRef.current;
    const canvas = canvasRef.current;

    if (!surface || !canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return undefined;
    }

    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let animationFrameId = 0;

    const resize = () => {
      const bounds = surface.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const observer = new ResizeObserver(() => resize());
    observer.observe(surface);
    resize();

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      drawFrame(context, width, height, elapsed, palette, seeds);
      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [palette, seeds]);

  return (
    <div className="field-surface" ref={surfaceRef}>
      <canvas aria-hidden="true" className="field-canvas" ref={canvasRef} />
    </div>
  );
}

export function RothkoCollage({ collage }: RothkoCollageProps) {
  if (!collage) {
    return (
      <section className="panel panel-large">
        <p className="eyebrow">Collective field</p>
        <h2>Waiting for the first pulse of color.</h2>
        <p className="muted">
          Once submissions arrive, this panel turns into a living collage built from the latest choices.
        </p>
      </section>
    );
  }

  return (
    <section className="panel panel-large field-panel">
      <LavaLampField collage={collage} />

      <div className="field-panel-copy">
        <div className="panel-header field-panel-header">
          <div>
            <p className="eyebrow">Collective field</p>
            <h2>Rothko-style color atmosphere</h2>
          </div>
          <p className="muted">
            {collage.activeContributors} contributors, {collage.totalSubmissions} recent selections
          </p>
        </div>

        <div className="dominant-strip">
          {collage.dominantColors.map((color) => (
            <div className="dominant-chip" key={color.hexColor}>
              <span className="chip-swatch" style={{ backgroundColor: color.hexColor }} />
              <span>{color.hexColor}</span>
              <span>{Math.round(color.percentage * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
