import { commandInput, clockEl } from "./dom.js";
import { state } from "./state.js";
import { formatClock } from "./utils.js";
import { handleCommand } from "./commands.js";
import { enterNode } from "./render.js";
import { bindOriginWindow, bindGlitchOverlay } from "./components/index.js";

function tickClock() {
  clockEl.textContent = formatClock();
}

async function loadStory() {
  const res = await fetch("data/story.json");
  state.story = await res.json();
  await enterNode(state.story.startNode, { silent: true });
  await enterNode(state.story.startNode);
}

commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const value = commandInput.value;
    commandInput.value = "";
    handleCommand(value);
  }
});

window.addEventListener("click", () => commandInput.focus());

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "f") {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
  if (event.key === "Escape" && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  if (event.key === "F1") {
    event.preventDefault();
    handleCommand("help");
  }
});

window.render_game_to_text = function renderGameToText() {
  const node = state.story ? state.story.nodes[state.nodeId] : null;
  const payload = {
    mode: state.mode,
    nodeId: state.nodeId,
    nodeTitle: node ? node.title : null,
    choices: node && node.choices ? node.choices.map((c, i) => `${i + 1}. ${c.label}`) : [],
    inventory: Array.from(state.inventory),
    flags: Array.from(state.flags),
    logTail: state.log.slice(-6).map((line) => line.text),
    coordinate_system: "Text UI: line 1 at top of screen, columns increase left to right"
  };
  return JSON.stringify(payload);
};

window.advanceTime = function advanceTime(ms) {
  if (!state.story) return;
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    document.getElementById("screen").scrollTop = document.getElementById("screen").scrollHeight;
  }
};

bindOriginWindow();
bindGlitchOverlay();
setInterval(tickClock, 1000);
loadStory();
commandInput.focus();
tickClock();
