const screens = {
  setup: document.querySelector('[data-screen="setup"]'),
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

const quickForm = document.getElementById("quickForm");
const letterMessageInput = document.getElementById("letterMessageInput");
const dreamPhotoInput = document.getElementById("dreamPhotoInput");
const photoStatus = document.getElementById("photoStatus");
const musicInput = document.getElementById("musicInput");
const musicStatus = document.getElementById("musicStatus");
const finalMessageInput = document.getElementById("finalMessageInput");
const previewButton = document.getElementById("previewButton");
const linkBox = document.getElementById("linkBox");
const generatedLink = document.getElementById("generatedLink");
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

let uploadedDreamPhoto = "";
let uploadedMusic = "";
let isScratching = false;
let revealDone = false;
let finalTyped = false;
let lastPoint = null;

function clean(value, fallback) {
  return value.trim() || fallback;
}

function buildLetter() {
  const fallback = `My Love,

I always knew this dream was waiting for you.
Every late night, every small effort, and every silent prayer has brought you here.
This result is proof that your heart never gave up.
Today your dream begins to glow, and I am so proud of you.

Tumhari ❤️`;
  const rawMessage = clean(letterMessageInput.value, fallback);
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

function applyDreamPhoto() {
  const photo = uploadedDreamPhoto || "/assets/future-dream.jpg";
  dreamImage.src = photo;
  screens.final.style.backgroundImage = `linear-gradient(rgba(39, 15, 24, 0.4), rgba(39, 15, 24, 0.66)), url("${photo}")`;
}

function applyMusic() {
  music.src = uploadedMusic || "/assets/bg-music.mp3";
}

function buildFinalMessage() {
  const fallback = `I knew you would make it.
This is only the beginning.
I’m so proud of you.
I’ll always be with you ❤️`;
  const lines = clean(finalMessageInput.value, fallback)
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

function buildRevealData() {
  return {
    letterMessage: clean(letterMessageInput.value, ""),
    dreamPhoto: uploadedDreamPhoto,
    music: uploadedMusic,
    finalMessage: clean(finalMessageInput.value, ""),
  };
}

function applyRevealData(data) {
  letterMessageInput.value = data.letterMessage || letterMessageInput.value;
  finalMessageInput.value = data.finalMessage || finalMessageInput.value;
  uploadedDreamPhoto = data.dreamPhoto || "";
  uploadedMusic = data.music || "";
  photoStatus.textContent = uploadedDreamPhoto ? "Saved dream photo is loaded." : "Default dream photo is selected.";
  musicStatus.textContent = uploadedMusic ? "Saved music is loaded." : "Default romantic music is selected.";
  buildLetter();
  buildFinalMessage();
  applyDreamPhoto();
  applyMusic();
}

function applyCurrentAdminData() {
  buildLetter();
  buildFinalMessage();
  applyDreamPhoto();
  applyMusic();
}

async function createRevealLink() {
  const response = await fetch("/api/reveals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRevealData()),
  });

  if (!response.ok) {
    throw new Error("The local backend is not running.");
  }

  const data = await response.json();
  return new URL(data.url, window.location.origin).href;
}

async function loadSharedReveal() {
  const match = window.location.pathname.match(/^\/reveal\/([a-zA-Z0-9_-]+)$/);
  if (!match) return false;

  const response = await fetch(`/api/reveals/${match[1]}`);
  if (!response.ok) return false;

  const data = await response.json();
  applyRevealData(data);
  return true;
}

function removeAdminPanel() {
  screens.setup?.remove();
  delete screens.setup;
}

function startPublicReveal() {
  removeAdminPanel();
  showScreen("letter");
}

async function bootApp() {
  if (window.location.pathname === "/admin") {
    showScreen("setup");
    return;
  }

  if (window.location.pathname === "/") {
    applyRevealData(defaultReveal);
    startPublicReveal();
    return;
  }

  const loaded = await loadSharedReveal();
  if (loaded) {
    startPublicReveal();
    return;
  }

  applyRevealData(defaultReveal);
  startPublicReveal();
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

quickForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  applyCurrentAdminData();
  linkBox.hidden = false;
  generatedLink.removeAttribute("href");
  generatedLink.textContent = "Generating link...";

  try {
    const url = await createRevealLink();
    generatedLink.href = url;
    generatedLink.textContent = url;
  } catch (error) {
    generatedLink.textContent = "Could not save the reveal. Check backend and Supabase environment variables.";
  }
});

previewButton.addEventListener("click", () => {
  applyCurrentAdminData();
  showScreen("letter");
});

dreamPhotoInput.addEventListener("change", () => {
  const [file] = dreamPhotoInput.files;
  if (!file) {
    uploadedDreamPhoto = "";
    photoStatus.textContent = "Default dream photo is selected.";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    uploadedDreamPhoto = String(reader.result);
    photoStatus.textContent = `${file.name} is ready for the scratch reveal.`;
  });
  reader.readAsDataURL(file);
});

musicInput.addEventListener("change", () => {
  const [file] = musicInput.files;
  if (!file) {
    uploadedMusic = "";
    musicStatus.textContent = "Default romantic music is selected.";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    uploadedMusic = String(reader.result);
    musicStatus.textContent = `${file.name} is ready for the reveal music.`;
  });
  reader.readAsDataURL(file);
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
