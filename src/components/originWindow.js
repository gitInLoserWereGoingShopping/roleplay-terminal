import {
  originWindow,
  originTitle,
  originBody,
  originStatus,
  originNext,
  originClose
} from "../dom.js";
import { state } from "../state.js";

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

export function showOriginWindow(data) {
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

export function bindOriginWindow() {
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
}
