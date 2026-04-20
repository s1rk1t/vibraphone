import { useEffect, useMemo, useRef } from "react";
import type { CollageResponse } from "../api";

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
  row: number;
  column: number;
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
  edgeCount: number;
  morphDepth: number;
  morphSpeed: number;
}

interface BlobState {
  key: string;
  color: string;
  row: number;
  column: number;
  x: number;
  y: number;
  radius: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  contourOffsets: number[];
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
  if (colors.length === 0) {
    return "#AF6175";
  }

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
    red: mixed.red / colors.length,
    green: mixed.green / colors.length,
    blue: mixed.blue / colors.length
  });
}

function saturateColor(hexColor: string, amount: number): string {
  const { red, green, blue } = hexToRgb(hexColor);
  const average = (red + green + blue) / 3;
  const factor = 1 + Math.max(0, amount);

  return rgbToHex({
    red: clamp(Math.round(average + ((red - average) * factor)), 0, 255),
    green: clamp(Math.round(average + ((green - average) * factor)), 0, 255),
    blue: clamp(Math.round(average + ((blue - average) * factor)), 0, 255)
  });
}

function colorDistance(left: string, right: string): number {
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);
  const distance = Math.hypot(
    leftRgb.red - rightRgb.red,
    leftRgb.green - rightRgb.green,
    leftRgb.blue - rightRgb.blue
  );

  return clamp(distance / 441.6729559300637, 0, 1);
}

function getPalette(collage: CollageResponse): string[] {
  const focalIndexes = [
    0,
    collage.width - 1,
    Math.floor(collage.cells.length / 2),
    collage.cells.length - collage.width,
    collage.cells.length - 1
  ];
  const colors = [
    ...collage.dominantColors.map((color) => color.hexColor),
    ...focalIndexes
      .map((index) => collage.cells[index]?.hexColor)
      .filter((color): color is string => Boolean(color))
  ];
  const unique = [...new Set(colors)];

  return unique.length > 0 ? unique.slice(0, 6) : ["#AF6175", "#D18A7A", "#4F6EA9"];
}

function buildBlobSeeds(collage: CollageResponse): BlobSeed[] {
  const palette = getPalette(collage);
  const cellSpan = Math.min(0.82 / collage.width, 0.76 / collage.height);
  const cellSeeds = collage.cells.map((cell, index) => {
    const density = Math.min(1, cell.sampleCount / 4);
    const baseX = 0.09 + (((cell.column + 0.5) / collage.width) * 0.82);
    const baseY = 0.12 + (((cell.row + 0.5) / collage.height) * 0.76);

    return {
      key: `cell-${cell.index}`,
      color: cell.hexColor,
      row: cell.row,
      column: cell.column,
      baseX,
      baseY,
      radius: (cellSpan * 0.52) + (cell.intensity * 0.022) + (density * 0.02),
      xAmplitude: 0.006 + (density * 0.006) + ((index % 3) * 0.0015),
      yAmplitude: 0.008 + (cell.intensity * 0.004) + (((index + 1) % 3) * 0.0015),
      xFrequency: 0.11 + ((index % 4) * 0.012),
      yFrequency: 0.1 + (((index + 2) % 4) * 0.011),
      phase: (index * 0.55) + (cell.row * 0.42) + (cell.column * 0.31),
      scaleX: 1.04 + ((cell.column % 2) * 0.05) + (density * 0.04),
      scaleY: 0.94 + ((cell.row % 2) * 0.05) + (cell.intensity * 0.05),
      rotation: (((cell.column + cell.row) % 4) - 1.5) * 0.08,
      alpha: 0.2 + (cell.intensity * 0.18) + (density * 0.08),
      edgeCount: 6 + ((cell.row + cell.column) % 3),
      morphDepth: 0.12 + (cell.intensity * 0.08) + (density * 0.06),
      morphSpeed: 0.66 + ((index % 4) * 0.08)
    };
  });

  const anchorSeeds = palette.slice(0, 2).map((color, index) => ({
    key: `anchor-${index}`,
    color,
    row: -1,
    column: -1,
    baseX: FIELD_ANCHORS[index].x,
    baseY: FIELD_ANCHORS[index].y,
    radius: 0.11 - (index * 0.01),
    xAmplitude: 0.012 + (index * 0.002),
    yAmplitude: 0.014 + (index * 0.003),
    xFrequency: 0.08 + (index * 0.02),
    yFrequency: 0.07 + (index * 0.018),
    phase: index * 2.1,
    scaleX: 1.12 - (index * 0.04),
    scaleY: 0.94 + (index * 0.03),
    rotation: (index - 1) * 0.08,
    alpha: 0.08 + (index * 0.02),
    edgeCount: 8,
    morphDepth: 0.08 + (index * 0.02),
    morphSpeed: 0.42 + (index * 0.06)
  }));

  return [...anchorSeeds, ...cellSeeds];
}

function materializeBlobs(seeds: BlobSeed[], width: number, height: number, time: number): BlobState[] {
  const minDimension = Math.min(width, height);

  return seeds.map((seed) => {
    const x = clamp(
      seed.baseX
        + (Math.sin((time * seed.xFrequency) + seed.phase) * seed.xAmplitude)
        + (Math.cos((time * (seed.yFrequency * 0.66)) + seed.phase) * 0.005),
      0.04,
      0.96
    );
    const y = clamp(
      seed.baseY
        + (Math.cos((time * seed.yFrequency) + seed.phase) * seed.yAmplitude)
        + (Math.sin((time * (seed.xFrequency * 0.72)) + seed.phase) * 0.006),
      0.06,
      0.94
    );
    const pulse = 1 + (Math.sin((time * 0.38) + seed.phase) * 0.05);
    const contourOffsets = Array.from({ length: seed.edgeCount }, (_, edgeIndex) => {
      const primaryWave = Math.sin((time * seed.morphSpeed) + seed.phase + (edgeIndex * 1.31)) * seed.morphDepth;
      const secondaryWave = Math.cos((time * (seed.morphSpeed * 0.58)) + (seed.phase * 0.7) + (edgeIndex * 0.97))
        * seed.morphDepth
        * 0.55;

      return clamp(0.82 + primaryWave + secondaryWave, 0.58, 1.22);
    });

    return {
      key: seed.key,
      color: seed.color,
      row: seed.row,
      column: seed.column,
      x: x * width,
      y: y * height,
      radius: seed.radius * minDimension * pulse,
      scaleX: seed.scaleX + (Math.sin((time * 0.26) + seed.phase) * 0.05),
      scaleY: seed.scaleY + (Math.cos((time * 0.22) + seed.phase) * 0.05),
      rotation: seed.rotation + (Math.sin((time * 0.12) + seed.phase) * 0.08),
      alpha: seed.alpha,
      contourOffsets
    };
  });
}

function traceBlobPath(context: CanvasRenderingContext2D, blob: BlobState, radiusScale = 1) {
  const points = blob.contourOffsets.map((offset, index) => {
    const angle = (Math.PI * 2 * index) / blob.contourOffsets.length;
    const directionalStretch = 0.94 + (Math.sin((angle * 2) + blob.rotation) * 0.08);
    const radius = blob.radius * radiusScale * clamp(offset * directionalStretch, 0.55, 1.28);

    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  });

  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const startX = (lastPoint.x + firstPoint.x) / 2;
  const startY = (lastPoint.y + firstPoint.y) / 2;

  context.beginPath();
  context.moveTo(startX, startY);

  points.forEach((point, index) => {
    const nextPoint = points[(index + 1) % points.length];
    const midX = (point.x + nextPoint.x) / 2;
    const midY = (point.y + nextPoint.y) / 2;
    context.quadraticCurveTo(point.x, point.y, midX, midY);
  });

  context.closePath();
}

function getBlobPairGeometry(left: BlobState, right: BlobState) {
  const deltaX = right.x - left.x;
  const deltaY = right.y - left.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance === 0) {
    return null;
  }

  const unitX = deltaX / distance;
  const unitY = deltaY / distance;

  return {
    distance,
    rotation: Math.atan2(deltaY, deltaX),
    startX: left.x + (unitX * left.radius * 0.64),
    startY: left.y + (unitY * left.radius * 0.64),
    endX: right.x - (unitX * right.radius * 0.64),
    endY: right.y - (unitY * right.radius * 0.64)
  };
}

function drawBackdrop(context: CanvasRenderingContext2D, width: number, height: number, palette: string[], time: number) {
  context.clearRect(0, 0, width, height);

  const baseGradient = context.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, rgba(mixHexColors(palette.slice(0, 3)), 0.92));
  baseGradient.addColorStop(0.5, rgba(mixHexColors(palette.slice(1, 5)), 0.88));
  baseGradient.addColorStop(1, rgba(mixHexColors(palette.slice(-3)), 0.9));
  context.fillStyle = baseGradient;
  context.fillRect(0, 0, width, height);

  palette.slice(0, 6).forEach((color, index) => {
    const anchor = FIELD_ANCHORS[index % FIELD_ANCHORS.length];
    const driftX = Math.sin((time * (0.08 + (index * 0.02))) + index) * width * 0.025;
    const driftY = Math.cos((time * (0.06 + (index * 0.018))) + index) * height * 0.03;
    const radius = Math.max(width, height) * (0.4 - (index * 0.03));
    const gradient = context.createRadialGradient(
      (anchor.x * width) + driftX,
      (anchor.y * height) + driftY,
      radius * 0.08,
      (anchor.x * width) + driftX,
      (anchor.y * height) + driftY,
      radius
    );

    gradient.addColorStop(0, rgba(color, 0.2 - (index * 0.02)));
    gradient.addColorStop(0.45, rgba(color, 0.1 - (index * 0.012)));
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

  const hotColor = saturateColor(blob.color, 0.18);
  const glowGradient = context.createRadialGradient(
    -blob.radius * 0.2,
    -blob.radius * 0.16,
    blob.radius * 0.08,
    0,
    0,
    blob.radius * 1.18
  );
  glowGradient.addColorStop(0, rgba(hotColor, blob.alpha * 0.32));
  glowGradient.addColorStop(0.55, rgba(blob.color, blob.alpha * 0.18));
  glowGradient.addColorStop(1, rgba(blob.color, 0));

  context.fillStyle = glowGradient;
  traceBlobPath(context, blob, 1.14);
  context.fill();

  const gradient = context.createRadialGradient(
    -blob.radius * 0.18,
    -blob.radius * 0.1,
    blob.radius * 0.12,
    0,
    0,
    blob.radius
  );
  gradient.addColorStop(0, rgba(hotColor, blob.alpha * 1.08));
  gradient.addColorStop(0.38, rgba(blob.color, blob.alpha * 0.92));
  gradient.addColorStop(0.76, rgba(blob.color, blob.alpha * 0.3));
  gradient.addColorStop(1, rgba(blob.color, 0));

  context.fillStyle = gradient;
  traceBlobPath(context, blob);
  context.fill();

  context.strokeStyle = rgba(saturateColor(blob.color, 0.28), blob.alpha * 0.18);
  context.lineWidth = Math.max(2, blob.radius * 0.035);
  traceBlobPath(context, blob, 0.94);
  context.stroke();

  const highlight = context.createRadialGradient(
    -blob.radius * 0.28,
    -blob.radius * 0.24,
    blob.radius * 0.04,
    -blob.radius * 0.08,
    -blob.radius * 0.04,
    blob.radius * 0.58
  );
  highlight.addColorStop(0, "rgba(255,255,255,0.18)");
  highlight.addColorStop(0.45, "rgba(255,255,255,0.06)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = highlight;
  traceBlobPath(context, blob, 0.62);
  context.fill();
  context.restore();
}

function drawConnector(context: CanvasRenderingContext2D, left: BlobState, right: BlobState) {
  const pair = getBlobPairGeometry(left, right);

  if (!pair) {
    return;
  }

  const contrast = colorDistance(left.color, right.color);
  const mergeDistance = (left.radius + right.radius) * (1.08 + (contrast * 0.2));

  if (pair.distance > mergeDistance) {
    return;
  }

  const closeness = 1 - (pair.distance / mergeDistance);
  const mixedColor = saturateColor(mixHexColors([left.color, right.color]), 0.3 + (contrast * 0.55));
  const midpointX = (pair.startX + pair.endX) / 2;
  const midpointY = (pair.startY + pair.endY) / 2;
  const radius = Math.max(24, (Math.min(left.radius, right.radius) * (0.58 + (closeness * 0.44))));

  context.save();
  context.translate(midpointX, midpointY);
  context.rotate(pair.rotation);
  context.scale(1.22 + (closeness * 0.26), 0.72 + (closeness * 0.16));

  const bridgeGradient = context.createRadialGradient(0, 0, radius * 0.08, 0, 0, radius);
  bridgeGradient.addColorStop(0, rgba(mixedColor, 0.22 + (closeness * 0.18) + (contrast * 0.08)));
  bridgeGradient.addColorStop(0.5, rgba(mixedColor, 0.14 + (closeness * 0.12) + (contrast * 0.06)));
  bridgeGradient.addColorStop(1, rgba(mixedColor, 0));

  context.fillStyle = bridgeGradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBorderGlow(context: CanvasRenderingContext2D, left: BlobState, right: BlobState) {
  const pair = getBlobPairGeometry(left, right);

  if (!pair) {
    return;
  }

  const contrast = colorDistance(left.color, right.color);
  const touchDistance = (left.radius + right.radius) * 1.28;

  if (contrast < 0.08 || pair.distance > touchDistance) {
    return;
  }

  const closeness = 1 - (pair.distance / touchDistance);
  const gradient = context.createLinearGradient(pair.startX, pair.startY, pair.endX, pair.endY);
  gradient.addColorStop(0, rgba(saturateColor(left.color, 0.35), 0));
  gradient.addColorStop(0.28, rgba(saturateColor(left.color, 0.55), 0.14 + (contrast * 0.1) + (closeness * 0.08)));
  gradient.addColorStop(0.5, rgba(saturateColor(mixHexColors([left.color, right.color]), 0.82), 0.26 + (contrast * 0.16) + (closeness * 0.12)));
  gradient.addColorStop(0.72, rgba(saturateColor(right.color, 0.55), 0.14 + (contrast * 0.1) + (closeness * 0.08)));
  gradient.addColorStop(1, rgba(saturateColor(right.color, 0.35), 0));

  context.save();
  context.filter = `blur(${14 + (contrast * 18)}px)`;
  context.strokeStyle = gradient;
  context.lineCap = "round";
  context.lineWidth = Math.min(left.radius, right.radius) * (0.3 + (contrast * 0.18) + (closeness * 0.16));
  context.beginPath();
  context.moveTo(pair.startX, pair.startY);
  context.lineTo(pair.endX, pair.endY);
  context.stroke();

  context.filter = `blur(${6 + (contrast * 8)}px)`;
  context.lineWidth *= 0.48;
  context.beginPath();
  context.moveTo(pair.startX, pair.startY);
  context.lineTo(pair.endX, pair.endY);
  context.stroke();
  context.restore();
}

function drawFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  palette: string[],
  seeds: BlobSeed[],
  collageWidth: number
) {
  drawBackdrop(context, width, height, palette, time);

  const blobs = materializeBlobs(seeds, width, height, time);
  const cellBlobs = blobs.filter((blob) => blob.row >= 0 && blob.column >= 0);
  const blobByKey = new Map(cellBlobs.map((blob) => [blob.key, blob]));
  const touchingPairs: Array<[BlobState, BlobState]> = [];

  cellBlobs.forEach((blob) => {
    const rightNeighbor = blobByKey.get(`cell-${(blob.row * collageWidth) + blob.column + 1}`);
    const bottomNeighbor = blobByKey.get(`cell-${((blob.row + 1) * collageWidth) + blob.column}`);

    if (rightNeighbor && rightNeighbor.row === blob.row) {
      touchingPairs.push([blob, rightNeighbor]);
    }

    if (bottomNeighbor) {
      touchingPairs.push([blob, bottomNeighbor]);
    }
  });

  touchingPairs.forEach(([left, right]) => drawConnector(context, left, right));

  for (let index = 0; index < blobs.length; index += 1) {
    for (let neighborIndex = index + 1; neighborIndex < blobs.length; neighborIndex += 1) {
      if (blobs[index].row < 0 || blobs[neighborIndex].row < 0) {
        drawConnector(context, blobs[index], blobs[neighborIndex]);
      }
    }
  }

  blobs.forEach((blob) => drawBlob(context, blob));
  touchingPairs.forEach(([left, right]) => drawBorderGlow(context, left, right));
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
      drawFrame(context, width, height, elapsed, palette, seeds, collage.width);
      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [collage.width, palette, seeds]);

  return (
    <div className="field-surface" ref={surfaceRef}>
      <canvas aria-hidden="true" className="field-canvas" ref={canvasRef} />
    </div>
  );
}

export function RothkoCollage({ collage }: RothkoCollageProps) {
  if (!collage || collage.totalSubmissions === 0) {
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
