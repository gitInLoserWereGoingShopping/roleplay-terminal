export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalize(input) {
  return input.trim().toLowerCase();
}

export function formatClock() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
