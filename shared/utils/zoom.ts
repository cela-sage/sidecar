const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

const step = (zoom: number, way: 1 | -1): number => {
  const next = way > 0 ? STEPS.find((one) => one > zoom + 0.001) : STEPS.findLast((one) => one < zoom - 0.001);
  return next ?? zoom;
};

const clamp = (zoom: number): number => Math.min(STEPS.at(-1) ?? zoom, Math.max(STEPS[0] ?? zoom, zoom));

// A mouse notch arrives as a hundred pixels and a pinch as a few, so one notch is capped near a quarter.
const pinch = (zoom: number, deltaY: number): number => clamp(zoom * Math.exp(-Math.max(-30, Math.min(30, deltaY)) / 100));

export const Zoom = { pinch, step };
