import { useState } from "react";

const STORAGE_KEY = "vibraphone-device-id";

function createDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `device-${Math.random().toString(16).slice(2, 10)}`;
}

export function useDeviceId(): string {
  const [deviceId] = useState(() => {
    const existing = window.localStorage.getItem(STORAGE_KEY);

    if (existing) {
      return existing;
    }

    const generated = createDeviceId();
    window.localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  });

  return deviceId;
}
