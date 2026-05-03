const screens = {
  loader: document.querySelector('[data-screen="loader"]'),
  error: document.querySelector('[data-screen="error"]'),
  letter: document.querySelector('[data-screen="letter"]'),
  countdown: document.querySelector('[data-screen="countdown"]'),
  scratch: document.querySelector('[data-screen="scratch"]'),
  final: document.querySelector('[data-screen="final"]'),
};

const defaultReveal = {
  letterMessage: `My Love,

I always knew this dream was waiting for you.
Every late night, every small effort, and every silent prayer has brought you here.
This result is proof that your heart never gave up.
Today your dream begins to glow, and I am so proud of you.

Tumhari ❤️`,
  dreamPhoto: "",
  music: "",
  finalMessage: `I knew you would make it.
This is only the beginning.
I’m so proud of you.
I’ll always be with you ❤️`,
};

const finalMessage = document.querySelector(".final-message");
const letterName = document.getElementById("letterName");
const letterMessage = document.getElementById("letterMessage");
const startButton = document.getElementById("startButton");
const countdownNumber = document.getElementById("countdownNumber");
const music = document.getElementById("bgMusic");
const card = document.getElementById("scratchCard");
const dreamImage = document.getElementById("dreamImage");
const canvas = document.getElementById("scratchCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const errorTitle = document.getElementById("errorTitle");
const errorMessage = document.getElementById("errorMessage");

let revealData = defaultReveal;
let isScratching = false;
let revealDone = false;
let finalTyped = false;
let lastPoint = null;

function clean(value, fallback) {
  return String(value || "").trim() || fallback;
}

function showScreen(name) {
  Object.entries(screens).forEach(([screenName, element]) => {
    const active = screenName === name;
    element.classList.toggle("is-active", active);
    element.setAttribute("aria-hidden", String(!active));
  });

  if (name === "final") {
    typeFinalMessage();
  }
}

function showError(title, message) {
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  showScreen("error");
}

function buildLetter(message) {
  const rawMessage = clean(message, defaultReveal.letterMessage);
  const lines = rawMessage
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [heading = "My Love,", ...messageLines] = lines;

  letterName.textContent = heading.replace(/,$/, "");
  letterMessage.innerHTML = "";
  messageLines.forEach((line, index) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    if (index === messageLines.length - 1) {
      paragraph.classList.add("letter-sign");
    }
    letterMessage.appendChild(paragraph);
  });
}

function applyDreamPhoto(photoUrl) {
  const photo = photoUrl || "/assets/future-dream.jpg";
  dreamImage.src = photo;
  screens.final.style.backgroundImage = `linear-gradient(rgba(39, 15, 24, 0.4), rgba(39, 15, 24, 0.66)), url("${photo}")`;
}

function applyMusic(musicUrl) {
  music.src = musicUrl || "/assets/bg-music.mp3";
}

function buildFinalMessage(message) {
  const lines = clean(message, defaultReveal.finalMessage)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  finalMessage.innerHTML = "";
  lines.forEach((text) => {
    const line = document.createElement("p");
    line.className = "typed-line";
    line.dataset.text = text;
    finalMessage.appendChild(line);
  });
  finalTyped = false;
}

function applyRevealData(data) {
  revealData = {
    ...defaultReveal,
    ...data,
  };
  buildLetter(revealData.letterMessage);
  buildFinalMessage(revealData.finalMessage);
  applyDreamPhoto(revealData.dreamPhoto || revealData.futureImageUrl);
  applyMusic(revealData.music || revealData.backgroundMusicUrl);
}

async function loadRevealBySlug(slug) {
  const response = await fetch(`/api/reveals/${slug}`);
  if (response.status === 404) {
    throw new Error("Reveal not found");
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Could not load this reveal.");
  }

  return response.json();
}

async function initRevealPage() {
  showScreen("loader");

  const match = window.location.pathname.match(/^\/reveal\/([^/]+)$/);
  if (!match) {
    applyRevealData(defaultReveal);
    showScreen("letter");
    return;
  }

  try {
    const data = await loadRevealBySlug(match[1]);
    applyRevealData(data);
    showScreen("letter");
  } catch (error) {
    showError("Reveal not found", error.message || "This surprise link is unavailable.");
  }
}

function initHomePage() {
  applyRevealData(defaultReveal);
  showScreen("letter");
}

function bootApp() {
  const path = window.location.pathname;

  if (path.startsWith("/reveal/")) {
    initRevealPage();
    return;
  }

  initHomePage();
}

function playMusic() {
  music.volume = 0;
  const playPromise = music.play();

  if (playPromise) {
    playPromise.catch(() => {
      startButton.disabled = false;
    });
  }

  const fade = window.setInterval(() => {
    music.volume = Math.min(0.42, music.volume + 0.035);
    if (music.volume >= 0.42) {
      window.clearInterval(fade);
    }
  }, 120);
}

function runCountdown() {
  showScreen("countdown");
  let count = 5;
  countdownNumber.textContent = count;
  animateCount();

  const timer = window.setInterval(() => {
    count -= 1;

    if (count <= 0) {
      window.clearInterval(timer);
      showScreen("scratch");
      setupScratchCanvas();
      return;
    }

    countdownNumber.textContent = count;
    animateCount();
  }, 1000);
}

function animateCount() {
  countdownNumber.classList.remove("pop");
  void countdownNumber.offsetWidth;
  countdownNumber.classList.add("pop");
}

function setupScratchCanvas() {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = card.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  gradient.addColorStop(0, "#f7d2dc");
  gradient.addColorStop(0.5, "#fff0f0");
  gradient.addColorStop(1, "#f1a8b8");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.fillStyle = "rgba(93, 31, 48, 0.92)";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Dream", rect.width / 2, rect.height / 2 - 10);

  ctx.fillStyle = "rgba(93, 31, 48, 0.7)";
  ctx.font = "500 18px cursive";
  ctx.fillText("the future is waiting", rect.width / 2, rect.height / 2 + 24);
}

function getPoint(event) {
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  const source = touch || event;
  const rect = canvas.getBoundingClientRect();

  return {
    x: source.clientX - rect.left,
    y: source.clientY - rect.top,
  };
}

function scratch(point) {
  const radius = Math.max(24, canvas.clientWidth * 0.075);
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = radius * 2;

  if (lastPoint) {
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  lastPoint = point;
}

function checkRevealProgress() {
  if (revealDone) return;

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = 0;

  for (let i = 3; i < pixels.length; i += 16) {
    if (pixels[i] < 80) transparent += 1;
  }

  const sampledPixels = pixels.length / 16;
  if (transparent / sampledPixels > 0.46) {
    revealDone = true;
    canvas.style.transition = "opacity 850ms ease";
    canvas.style.opacity = "0";
    window.setTimeout(() => showScreen("final"), 1250);
  }
}

function startScratch(event) {
  if (revealDone) return;
  event.preventDefault();
  isScratching = true;
  lastPoint = null;
  scratch(getPoint(event));
}

function moveScratch(event) {
  if (!isScratching || revealDone) return;
  event.preventDefault();
  scratch(getPoint(event));
}

function endScratch() {
  if (!isScratching) return;
  isScratching = false;
  lastPoint = null;
  checkRevealProgress();
}

async function typeFinalMessage() {
  if (finalTyped) return;
  finalTyped = true;

  const lines = Array.from(document.querySelectorAll(".typed-line"));
  for (const line of lines) {
    const text = line.dataset.text || "";
    line.textContent = "";
    line.classList.add("is-typing");

    for (const character of Array.from(text)) {
      line.textContent += character;
      await new Promise((resolve) => window.setTimeout(resolve, 34));
    }

    line.classList.remove("is-typing");
    line.classList.add("is-done");
    await new Promise((resolve) => window.setTimeout(resolve, 220));
  }
}

startButton.addEventListener("click", () => {
  startButton.disabled = true;
  playMusic();
  runCountdown();
});

canvas.addEventListener("pointerdown", startScratch);
canvas.addEventListener("pointermove", moveScratch);
window.addEventListener("pointerup", endScratch);
canvas.addEventListener("touchstart", startScratch, { passive: false });
canvas.addEventListener("touchmove", moveScratch, { passive: false });
window.addEventListener("touchend", endScratch);

window.addEventListener("resize", () => {
  if (screens.scratch.classList.contains("is-active") && !revealDone) {
    setupScratchCanvas();
  }
});

bootApp();
