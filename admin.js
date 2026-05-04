const quickForm = document.getElementById("quickForm");
const letterMessageInput = document.getElementById("letterMessageInput");
const dreamPhotoInput = document.getElementById("dreamPhotoInput");
const photoStatus = document.getElementById("photoStatus");
const musicInput = document.getElementById("musicInput");
const musicStatus = document.getElementById("musicStatus");
const finalMessageInput = document.getElementById("finalMessageInput");
const linkBox = document.getElementById("linkBox");
const generatedLink = document.getElementById("generatedLink");

let uploadedDreamPhoto = "";
let uploadedMusic = "";

function clean(value, fallback) {
  return String(value || "").trim() || fallback;
}

function buildRevealData() {
  return {
    letterMessage: clean(letterMessageInput.value, ""),
    dreamPhoto: uploadedDreamPhoto,
    music: uploadedMusic,
    finalMessage: clean(finalMessageInput.value, ""),
  };
}

async function createRevealLink() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch("/api/reveals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRevealData()),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The backend did not respond in time. Check Render logs and Supabase environment variables.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = [errorData.error, errorData.details].filter(Boolean).join(" - ");
    throw new Error(message || `Save failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  return new URL(data.url, window.location.origin).href;
}

function readUpload(input, status, emptyMessage, readyMessage, onReady) {
  const [file] = input.files;
  if (!file) {
    onReady("");
    status.textContent = emptyMessage;
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    onReady(String(reader.result));
    status.textContent = `${file.name} ${readyMessage}`;
  });
  reader.readAsDataURL(file);
}

dreamPhotoInput.addEventListener("change", () => {
  readUpload(
    dreamPhotoInput,
    photoStatus,
    "Default dream photo is selected.",
    "is ready for the scratch reveal.",
    (value) => {
      uploadedDreamPhoto = value;
    },
  );
});

musicInput.addEventListener("change", () => {
  readUpload(
    musicInput,
    musicStatus,
    "Default romantic music is selected.",
    "is ready for the reveal music.",
    (value) => {
      uploadedMusic = value;
    },
  );
});

quickForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  linkBox.hidden = false;
  generatedLink.removeAttribute("href");
  generatedLink.textContent = "Generating link...";

  try {
    const url = await createRevealLink();
    generatedLink.href = url;
    generatedLink.textContent = url;
  } catch (error) {
    console.error("[Generate link] Save failed:", error);
    generatedLink.textContent = `Could not save the reveal: ${error.message}`;
  }
});
