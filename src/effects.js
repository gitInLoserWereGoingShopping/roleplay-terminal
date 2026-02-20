import { screen, crt, promptEl } from "./dom.js";
import { state } from "./state.js";

export function flickerScreen(duration = 900) {
  const bursts = [0, 140, 320];
  bursts.forEach((start, index) => {
    setTimeout(() => {
      screen.classList.add("flicker");
      setTimeout(
        () => screen.classList.remove("flicker"),
        duration - index * 120
      );
    }, start);
  });
}

export function pulseClass(target, className, duration = 700) {
  if (!target) return;
  target.classList.add(className);
  setTimeout(() => target.classList.remove(className), duration);
}

export function findLastLineByText(text) {
  const lines = Array.from(screen.querySelectorAll(".line"));
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].textContent.trim() === text) return lines[i];
  }
  return null;
}

export function animatePromptUnderline(lineEl) {
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
  ghost.style.top = `${y + 24}px`;
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

export function runEffect(effect, lineEl) {
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
    case "underline": {
      const target = lineEl || findLastLineByText("The terminal's cursor moves without your input.");
      if (target) {
        target.scrollIntoView({ block: "center" });
        animatePromptUnderline(target);
      }
      break;
    }
    default:
      break;
  }
}
