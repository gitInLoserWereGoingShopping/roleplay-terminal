import { screen } from "./dom.js";
import { state } from "./state.js";

export function addLine(text, cls = "", opts = {}) {
  const { log = true } = opts;
  const line = document.createElement("div");
  line.className = `line ${cls}`.trim();
  line.textContent = text;
  screen.appendChild(line);
  if (log) {
    state.log.push({ text, cls, ts: Date.now() });
  }
  screen.scrollTop = screen.scrollHeight;
  return line;
}

export function addSpacer() {
  addLine(" ");
}
