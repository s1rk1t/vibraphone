import { useEffect, useRef, useState } from "react";

export interface SpectrumSelection {
  hexColor: string;
  x: number;
  y: number;
}

interface ColorSpectrumProps {
  value: SpectrumSelection;
  onChange: (selection: SpectrumSelection) => void;
}

function componentToHex(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function toHex(red: number, green: number, blue: number): string {
  return `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;
}

export function ColorSpectrum({ value, onChange }: ColorSpectrumProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState(320);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const element = wrapperRef.current;

    if (!element) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setSize(Math.max(240, Math.min(380, Math.round(entry.contentRect.width))));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;

    canvas.width = size * devicePixelRatio;
    canvas.height = size * devicePixelRatio;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(devicePixelRatio, devicePixelRatio);

    const hueGradient = context.createLinearGradient(0, 0, size, 0);
    hueGradient.addColorStop(0, "#ff4f6d");
    hueGradient.addColorStop(0.17, "#ff9d36");
    hueGradient.addColorStop(0.34, "#ffe66d");
    hueGradient.addColorStop(0.51, "#44d9b2");
    hueGradient.addColorStop(0.68, "#3887ff");
    hueGradient.addColorStop(0.85, "#985bff");
    hueGradient.addColorStop(1, "#ff4f6d");

    context.fillStyle = hueGradient;
    context.fillRect(0, 0, size, size);

    const lightGradient = context.createLinearGradient(0, 0, 0, size);
    lightGradient.addColorStop(0, "rgba(255,255,255,0.98)");
    lightGradient.addColorStop(0.46, "rgba(255,255,255,0)");
    lightGradient.addColorStop(1, "rgba(0,0,0,0.88)");

    context.fillStyle = lightGradient;
    context.fillRect(0, 0, size, size);
  }, [size]);

  function updateSelection(clientX: number, clientY: number) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width - 1, clientX - bounds.left));
    const y = Math.max(0, Math.min(bounds.height - 1, clientY - bounds.top));
    const pixel = context.getImageData(x * devicePixelRatio, y * devicePixelRatio, 1, 1).data;

    onChange({
      hexColor: toHex(pixel[0], pixel[1], pixel[2]),
      x: Number((x / bounds.width).toFixed(4)),
      y: Number((y / bounds.height).toFixed(4))
    });
  }

  return (
    <div className="spectrum-shell" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        className="spectrum-canvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          updateSelection(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (dragging) {
            updateSelection(event.clientX, event.clientY);
          }
        }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      />
      <div
        className="spectrum-marker"
        style={{
          left: `${value.x * 100}%`,
          top: `${value.y * 100}%`,
          backgroundColor: value.hexColor
        }}
      />
    </div>
  );
}
