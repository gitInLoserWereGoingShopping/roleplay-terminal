import { screen } from "./dom.js";
import { state } from "./state.js";
import { addLine, addSpacer } from "./ui.js";
import { wait } from "./utils.js";
import { runEffect } from "./effects.js";
import { runFeature } from "./features/registry.js";

export function applyNodeEffects(node) {
  if (node.flags) {
    node.flags.forEach((flag) => state.flags.add(flag));
  }
  if (node.items) {
    node.items.forEach((item) => state.inventory.add(item));
  }
}

export function listChoices(node) {
  if (!node.choices || node.choices.length === 0) {
    if (node.inputPrompt) {
      addLine(node.inputPrompt, "dim");
      return;
    }
    addLine("No available actions.", "dim");
    return;
  }
  const filtered = node.choices.filter((choice) => {
    if (!choice.requiresFlag) return true;
    return state.flags.has(choice.requiresFlag);
  });
  filtered.forEach((choice, index) => {
    const line = addLine(`${index + 1}. ${choice.label}`, "dim choice");
    line.style.animationDelay = `${120 + index * 120}ms`;
  });
}

export function resolveLineEntry(entry) {
  if (typeof entry === "string") {
    return { text: entry, typing: false, style: "" };
  }
  return {
    text: entry.text || "",
    cls: entry.style || "",
    typing: Boolean(entry.typing),
    speed: entry.speed || null,
    typo: Boolean(entry.typo),
    pauseAfter: entry.pauseAfter || 0,
    flicker: Boolean(entry.flicker),
    stream: entry.stream || null,
    effect: entry.effect || null,
    effectDelay: entry.effectDelay || 0
  };
}

export function createStreamFrame(message, width, height, alphabet) {
  const grid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => alphabet[Math.floor(Math.random() * alphabet.length)])
  );
  const words = message.split(" ");
  const lines = [];
  let current = "";
  words.forEach((word) => {
    if ((current + " " + word).trim().length > width - 4) {
      lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });
  if (current) lines.push(current.trim());
  const startRow = Math.max(0, Math.floor((height - lines.length) / 2));
  lines.forEach((line, i) => {
    const row = startRow + i;
    const startCol = Math.max(0, Math.floor((width - line.length) / 2));
    for (let c = 0; c < line.length; c += 1) {
      grid[row][startCol + c] = " ";
    }
  });
  return grid.map((row) => row.join("")).join("\n");
}

export async function renderStream(message, opts = {}) {
  const width = opts.width || 46;
  const height = opts.height || 7;
  const duration = opts.duration || 1600;
  const interval = opts.interval || 80;
  const alphabet = opts.alphabet || "01/\\|:;*+=-";
  const line = addLine("", "ascii stream", { log: false });
  const frames = Math.max(1, Math.floor(duration / interval));
  for (let i = 0; i < frames; i += 1) {
    line.textContent = createStreamFrame(message, width, height, alphabet);
    await wait(interval);
  }
  state.log.push({ text: message, cls: "stream", ts: Date.now() });
}

export function typeText(text, cls = "", speed = 260, typo = false) {
  return new Promise((resolve) => {
    const line = addLine("", cls, { log: false });
    let index = 0;
    let typoInjected = false;
    const tick = () => {
      if (index >= text.length) {
        line.textContent = text;
        state.log.push({ text, cls, ts: Date.now() });
        screen.scrollTop = screen.scrollHeight;
        resolve(line);
        return;
      }
      if (typo && !typoInjected && index > 6 && Math.random() < 0.12) {
        typoInjected = true;
        const typoChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
        line.textContent += typoChar;
        setTimeout(() => {
          line.textContent = line.textContent.slice(0, -1);
          setTimeout(tick, speed * 0.9);
        }, speed * 1.4);
        return;
      }

      line.textContent += text[index];
      index += 1;
      const char = text[index - 1];
      let delay = char === " " ? Math.max(80, speed - 80) : speed;
      if (/[.,!?]/.test(char)) {
        delay += 180;
      }
      setTimeout(tick, delay);
    };
    tick();
  });
}

export async function renderLines(node, deferredEffects) {
  for (const entry of node.lines) {
    const { text, cls, typing, speed, typo, pauseAfter, flicker, stream, effect, effectDelay } =
      resolveLineEntry(entry);
    if (stream && stream.text) {
      await renderStream(stream.text, stream);
      if (pauseAfter) await wait(pauseAfter);
      continue;
    }
    let lineEl = null;
    if (typing) {
      state.typing = true;
      const baseSpeed = speed || (cls === "ascii" ? 140 : 280);
      lineEl = await typeText(text, cls || "entity", baseSpeed, typo);
      state.typing = false;
    } else {
      lineEl = addLine(text, cls);
    }
    if ((flicker || effect) && deferredEffects) {
      const fx = flicker ? "flicker" : effect;
      deferredEffects.push({ fx, delay: effectDelay || 0, lineEl });
    }
    if (pauseAfter) {
      await wait(pauseAfter);
    } else if (!typing) {
      await wait(state.timing.linePauseDefault);
    } else {
      await wait(state.timing.typingPauseDefault);
    }
  }
}

export async function enterNode(nodeId, opts = {}) {
  const node = state.story.nodes[nodeId];
  if (!node) {
    addLine("ERROR: Node not found.", "warn");
    return;
  }
  if (opts.preDelay) {
    await wait(opts.preDelay);
  }
  state.nodeId = nodeId;
  state.mode = node.ending ? "ending" : "playing";
  applyNodeEffects(node);

  if (!opts.silent) {
    const deferredEffects = [];
    addSpacer();
    addLine(`[${node.title}]`, "dim");
    await wait(state.timing.nodeStartDelay);
    await renderLines(node, deferredEffects);
    if (!node.ending) {
      addSpacer();
      listChoices(node);
    } else {
      addSpacer();
      addLine("Type " + '"restart"' + " to begin again.", "dim");
    }
    if (deferredEffects.length) {
      await wait(280);
      for (const entry of deferredEffects) {
        if (entry.delay) await wait(entry.delay);
        runEffect(entry.fx, entry.lineEl);
        await wait(120);
      }
    }
    if (node.originWindow) {
      await wait(node.originWindow.delay || 300);
      runFeature("originWindow", node.originWindow);
    }
  }
}
