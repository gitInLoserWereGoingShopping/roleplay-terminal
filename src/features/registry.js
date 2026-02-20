import { showOriginWindow, showGlitchOverlay } from "../components/index.js";

const registry = {
  originWindow: (payload) => showOriginWindow(payload),
  glitchOverlay: (payload) => showGlitchOverlay(payload)
};

export function runFeature(name, payload) {
  const handler = registry[name];
  if (!handler) return false;
  handler(payload);
  return true;
}
