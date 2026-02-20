const screen = document.getElementById("screen");
const crt = document.querySelector(".crt");
const commandInput = document.getElementById("command");
const clockEl = document.getElementById("clock");
const promptEl = document.getElementById("prompt");
const originWindow = document.getElementById("origin-window");
const originTitle = document.getElementById("origin-title");
const originBody = document.getElementById("origin-body");
const originStatus = document.getElementById("origin-status");
const originNext = document.getElementById("origin-next");
const originClose = document.getElementById("origin-close");

const state = {
  story: null,
  nodeId: null,
  inventory: new Set(),
  flags: new Set(),
  log: [],
  mode: "boot",
  typing: false,
  effectsEnabled: true,
  ghostRunning: false,
  ghostEl: null,
  originTimer: null,
  originPages: null,
  originPageIndex: 0,
};

function formatClock() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function tickClock() {
  clockEl.textContent = formatClock();
}

setInterval(tickClock, 1000);

function addLine(text, cls = "", opts = {}) {
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

function addSpacer() {
  addLine(" ");
}

function applyNodeEffects(node) {
  if (node.flags) {
    node.flags.forEach((flag) => state.flags.add(flag));
  }
  if (node.items) {
    node.items.forEach((item) => state.inventory.add(item));
  }
}

function listChoices(node) {
  if (!node.choices || node.choices.length === 0) {
    if (node.inputPrompt) {
      addLine(node.inputPrompt, "dim");
      return;
    }
    addLine("No available actions.", "dim");
    return;
  }
  node.choices.forEach((choice, index) => {
    const line = addLine(`${index + 1}. ${choice.label}`, "dim choice");
    line.style.animationDelay = `${120 + index * 120}ms`;
  });
}

function resolveLineEntry(entry) {
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
    effectDelay: entry.effectDelay || 0,
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flickerScreen(duration = 900) {
  const bursts = [0, 140, 320];
  bursts.forEach((start, index) => {
    setTimeout(() => {
      screen.classList.add("flicker");
      setTimeout(
        () => screen.classList.remove("flicker"),
        duration - index * 120,
      );
    }, start);
  });
}

function pulseClass(target, className, duration = 700) {
  if (!target) return;
  target.classList.add(className);
  setTimeout(() => target.classList.remove(className), duration);
}

function runEffect(effect, lineEl) {
  if (!state.effectsEnabled) return;
  switch (effect) {
    case "flicker":
      flickerScreen();
      break;
    case "dim":
      pulseClass(screen, "effect-dim", 900);
      break;
    case "surge":
      pulseClass(crt, "effect-surge", 900);
      break;
    case "shake":
      pulseClass(screen, "effect-shake", 700);
      break;
    case "scanline":
      pulseClass(crt, "effect-scanline", 900);
      break;
    case "underline":
      if (!lineEl) {
        const fallback = findLastLineByText(
          "The terminal's cursor moves without your input.",
        );
        if (fallback) {
          fallback.scrollIntoView({ block: "center" });
          animatePromptUnderline(fallback);
        }
      } else {
        lineEl.scrollIntoView({ block: "center" });
        animatePromptUnderline(lineEl);
      }
      break;
    default:
      break;
  }
}

function clearOriginWindow() {
  if (state.originTimer) {
    clearInterval(state.originTimer);
    state.originTimer = null;
  }
  if (originBody) originBody.innerHTML = "";
}

function renderOriginPage(page) {
  if (!originBody) return;
  originBody.innerHTML = "";
  const lines = page.lines || [];
  lines.forEach((entry) => {
    const div = document.createElement("div");
    div.className = `origin-line ${entry.kind || ""}`.trim();
    div.textContent = entry.text;
    originBody.appendChild(div);
  });
  originBody.scrollTop = 0;
  if (originStatus) {
    originStatus.textContent = page.status || "Origin stream";
  }
}

function showOriginWindow(data) {
  if (!originWindow || !originBody) return;
  clearOriginWindow();
  if (originTitle) originTitle.textContent = data.title || "ORIGIN LOG";
  state.originPages = data.pages || [{ lines: data.lines || [] }];
  state.originPageIndex = 0;
  renderOriginPage(state.originPages[state.originPageIndex]);
  originWindow.classList.add("active");
  originWindow.setAttribute("aria-hidden", "false");
  if (data.autoScroll) {
    state.originTimer = setInterval(() => {
      originBody.scrollTop += data.scrollStep || 6;
      if (originBody.scrollTop + originBody.clientHeight >= originBody.scrollHeight) {
        clearInterval(state.originTimer);
        state.originTimer = null;
      }
    }, data.scrollInterval || 220);
  }
}

if (originClose) {
  originClose.addEventListener("click", () => {
    if (originWindow) {
      originWindow.classList.remove("active");
      originWindow.setAttribute("aria-hidden", "true");
    }
    clearOriginWindow();
  });
}

if (originNext) {
  originNext.addEventListener("click", () => {
    if (!state.originPages) return;
    const nextIndex = state.originPageIndex + 1;
    if (nextIndex >= state.originPages.length) {
      originNext.disabled = true;
      return;
    }
    state.originPageIndex = nextIndex;
    renderOriginPage(state.originPages[state.originPageIndex]);
  });
}

function animatePromptUnderline(lineEl) {
  if (!promptEl || !lineEl) return;
  if (state.ghostRunning && state.ghostEl) {
    state.ghostEl.remove();
    state.ghostEl = null;
    state.ghostRunning = false;
  }
  const startX = lineEl.offsetLeft + 8;
  const endX = lineEl.offsetLeft + lineEl.offsetWidth * 0.5;
  const y = lineEl.offsetTop + lineEl.offsetHeight + 8;
  const duration = 3000;
  const liftAmount = 142;
  const settleAmount = 10;
  const rotateTarget = -90;
  const wobbleAmount = 3;
  const startDelay = 0;
  const startTime = performance.now();

  const ghost = promptEl.cloneNode(true);
  ghost.classList.add("prompt-float");
  ghost.style.position = "absolute";
  ghost.style.left = `${startX}px`;
  ghost.style.top = `${y - 44}px`;
  ghost.style.transform = "rotate(0deg) scale(1)";
  screen.appendChild(ghost);
  state.ghostEl = ghost;
  state.ghostRunning = true;
  promptEl.style.opacity = "0.35";

  const animate = (now) => {
    if (now - startTime < startDelay) {
      requestAnimationFrame(animate);
      return;
    }
    const t = Math.min(1, (now - startTime) / duration);
    const eased = t * t * (3 - 2 * t);
    const baseX = startX + (endX - startX) * eased;
    const wobble =
      Math.sin(now / 140) * wobbleAmount +
      Math.sin(now / 310) * (wobbleAmount / 2);
    const jitter = (Math.random() - 0.5) * 0.8;
    const lift = t < 0.18 ? (1 - t / 0.18) * liftAmount : 0;
    const settle = t < 0.35 ? (1 - t / 0.35) * settleAmount : 0;
    const tilt = t < 0.18 ? -20 * (t / 0.18) : rotateTarget;
    const scale = t < 0.22 ? 1 + 0.08 * (t / 0.22) : 1;
    ghost.style.left = `${baseX + wobble + jitter}px`;
    ghost.style.top = `${y + lift + settle}px`;
    ghost.style.transform = `rotate(${tilt}deg) scale(${scale})`;
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      ghost.remove();
      state.ghostEl = null;
      state.ghostRunning = false;
      promptEl.style.opacity = "";
    }
  };
  requestAnimationFrame(animate);
}

function findLastLineByText(text) {
  const lines = Array.from(screen.querySelectorAll(".line"));
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].textContent.trim() === text) return lines[i];
  }
  return null;
}

function typeText(text, cls = "", speed = 260, typo = false) {
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
        const typoChar = String.fromCharCode(
          97 + Math.floor(Math.random() * 26),
        );
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

function createStreamFrame(message, width, height, alphabet) {
  const grid = Array.from({ length: height }, () =>
    Array.from(
      { length: width },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ),
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

async function renderStream(message, opts = {}) {
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

async function renderLines(node, deferredEffects) {
  for (const entry of node.lines) {
    const {
      text,
      cls,
      typing,
      speed,
      typo,
      pauseAfter,
      flicker,
      stream,
      effect,
      effectDelay,
    } = resolveLineEntry(entry);
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
      await wait(120);
    } else {
      await wait(160);
    }
  }
}

async function enterNode(nodeId, opts = {}) {
  const node = state.story.nodes[nodeId];
  if (!node) {
    addLine("ERROR: Node not found.", "warn");
    return;
  }
  state.nodeId = nodeId;
  state.mode = node.ending ? "ending" : "playing";
  applyNodeEffects(node);

  if (!opts.silent) {
    const deferredEffects = [];
    addSpacer();
    addLine(`[${node.title}]`, "dim");
    await wait(240);
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
      showOriginWindow(node.originWindow);
    }
  }
}

function resetGame() {
  state.inventory.clear();
  state.flags.clear();
  state.log = [];
  screen.innerHTML = "";
  enterNode(state.story.startNode);
}

function normalize(input) {
  return input.trim().toLowerCase();
}

async function handleCommand(raw) {
  const input = normalize(raw);
  if (!state.story || !state.story.nodes) {
    addLine("System still booting. Try again in a moment.", "warn");
    return;
  }
  if (state.typing) {
    addLine("Signal processing in progress. Stand by.", "dim");
    return;
  }
  const node = state.story.nodes[state.nodeId];
  if (!input) return;

  addLine(`> ${raw}`, "dim");

  if (input === "help" || input === "?" || input === "f1") {
    addLine("Commands:");
    addLine("- help: Show this help", "dim");
    addLine("- look: Reprint current scene", "dim");
    addLine("- choices: List available actions", "dim");
    addLine("- inventory: List held items", "dim");
    addLine("- restart: Restart the story", "dim");
    addLine("- effects on/off: Toggle screen effects", "dim");
    addLine("- 1/2/3 or type a choice label", "dim");
    return;
  }

  if (input === "look") {
    addLine(`[${node.title}]`, "dim");
    node.lines.forEach((line) => addLine(line));
    return;
  }

  if (input === "choices") {
    listChoices(node);
    return;
  }

  if (input === "inventory") {
    if (state.inventory.size === 0) {
      addLine("Inventory empty.", "dim");
    } else {
      addLine("Inventory:");
      Array.from(state.inventory).forEach((item) =>
        addLine(`- ${item}`, "dim"),
      );
    }
    return;
  }

  if (input === "restart") {
    resetGame();
    return;
  }

  if (input === "effects off") {
    state.effectsEnabled = false;
    addLine("Effects disabled.", "dim");
    return;
  }

  if (input === "effects on") {
    state.effectsEnabled = true;
    addLine("Effects enabled.", "dim");
    return;
  }

  if (node.ending) {
    addLine("Story complete. Type " + '"restart"' + " to play again.", "dim");
    return;
  }

  if (node.inputMap) {
    const target = node.inputMap[input];
    if (!target) {
      addLine(node.inputError || "Unrecognized response.", "warn");
      return;
    }
    await enterNode(target);
    return;
  }

  const choiceIndex = parseInt(input, 10);
  let chosen = null;
  if (!Number.isNaN(choiceIndex)) {
    chosen = node.choices[choiceIndex - 1];
  } else {
    chosen = node.choices.find((choice) => normalize(choice.label) === input);
  }

  if (!chosen) {
    addLine("Unrecognized command. Type 'help' for options.", "warn");
    return;
  }

  await enterNode(chosen.target);
}

commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const value = commandInput.value;
    commandInput.value = "";
    handleCommand(value);
  }
});

window.addEventListener("click", () => commandInput.focus());

async function loadStory() {
  const res = await fetch("data/story.json");
  state.story = await res.json();
  addLine("Initializing relay...", "dim");
  await enterNode(state.story.startNode, { silent: true });
  await enterNode(state.story.startNode);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
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
    choices:
      node && node.choices
        ? node.choices.map((c, i) => `${i + 1}. ${c.label}`)
        : [],
    inventory: Array.from(state.inventory),
    flags: Array.from(state.flags),
    logTail: state.log.slice(-6).map((line) => line.text),
    coordinate_system:
      "Text UI: line 1 at top of screen, columns increase left to right",
  };
  return JSON.stringify(payload);
};

window.advanceTime = function advanceTime(ms) {
  if (!state.story) return;
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    screen.scrollTop = screen.scrollHeight;
  }
};

loadStory();
commandInput.focus();
tickClock();
