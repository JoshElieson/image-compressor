const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/svg+xml",
  "image/tiff",
  "image/heic",
  "image/heif",
]);

const EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".avif",
  ".svg",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
];

const PRESETS = {
  high: { quality: 0.88, maxDimension: 4096 },
  medium: { quality: 0.72, maxDimension: 2560 },
  low: { quality: 0.52, maxDimension: 1600 },
};

const LEVELS = ["high", "medium", "low"];

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const options = document.getElementById("options");
const compressBtn = document.getElementById("compressBtn");
const resetBtn = document.getElementById("resetBtn");
const formatSelect = document.getElementById("formatSelect");
const resultsPanel = document.getElementById("resultsPanel");
const originalPreview = document.getElementById("originalPreview");
const compressedPreview = document.getElementById("compressedPreview");
const originalSizeEl = document.getElementById("originalSize");
const compressedSizeEl = document.getElementById("compressedSize");
const savingsPercentEl = document.getElementById("savingsPercent");
const metaLine = document.getElementById("metaLine");
const downloadBtn = document.getElementById("downloadBtn");
const toast = document.getElementById("toast");

let currentFile = null;
let originalObjectUrl = null;
let compressedObjectUrl = null;
let cachedImage = null;
let estimateGeneration = 0;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => {
      toast.hidden = true;
    }, 300);
  }, 4000);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isAcceptedFile(file) {
  if (ACCEPTED_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return EXTENSIONS.some((ext) => name.endsWith(ext));
}

function getLevel() {
  const checked = document.querySelector('input[name="level"]:checked');
  return checked ? checked.value : "medium";
}

function getEstimateEl(level) {
  return document.querySelector(`.level-estimate[data-level="${level}"]`);
}

function setEstimateLoading() {
  LEVELS.forEach((level) => {
    const el = getEstimateEl(level);
    if (!el) return;
    el.textContent = "Estimating…";
    el.className = "level-estimate loading";
  });
}

function setEstimate(level, bytes, originalBytes) {
  const el = getEstimateEl(level);
  if (!el) return;

  let text = `~${formatBytes(bytes)}`;
  if (originalBytes > 0 && bytes < originalBytes) {
    const pct = ((originalBytes - bytes) / originalBytes) * 100;
    text += ` (−${pct.toFixed(0)}%)`;
  }

  el.textContent = text;
  el.className = "level-estimate" + (bytes >= originalBytes ? " larger" : "");
}

function clearEstimates() {
  LEVELS.forEach((level) => {
    const el = getEstimateEl(level);
    if (!el) return;
    el.textContent = "—";
    el.className = "level-estimate";
  });
}

async function ensureImageLoaded(file) {
  if (cachedImage?.file === file) return cachedImage.img;
  const img = await loadImageFromFile(file);
  cachedImage = { file, img };
  return img;
}

async function updateEstimates() {
  if (!currentFile) return;

  const gen = ++estimateGeneration;
  setEstimateLoading();

  try {
    const img = await ensureImageLoaded(currentFile);
    if (gen !== estimateGeneration) return;

    const formatChoice = formatSelect.value;
    const results = await Promise.all(
      LEVELS.map((level) => compressImage(img, currentFile, level, formatChoice))
    );

    if (gen !== estimateGeneration) return;

    results.forEach(({ blob }, i) => {
      setEstimate(LEVELS[i], blob.size, currentFile.size);
    });
  } catch {
    if (gen !== estimateGeneration) return;
    LEVELS.forEach((level) => {
      const el = getEstimateEl(level);
      if (!el) return;
      el.textContent = "Unavailable";
      el.className = "level-estimate larger";
    });
  }
}

function revokeUrls() {
  if (originalObjectUrl) URL.revokeObjectURL(originalObjectUrl);
  if (compressedObjectUrl) URL.revokeObjectURL(compressedObjectUrl);
  originalObjectUrl = null;
  compressedObjectUrl = null;
}

function setLoading(loading) {
  compressBtn.disabled = loading;
  compressBtn.classList.toggle("loading", loading);
  compressBtn.querySelector(".btn-spinner").hidden = !loading;
}

function updateDropzoneWithFile(file) {
  dropzone.classList.add("has-file");
  dropzone.innerHTML = "";
  const chip = document.createElement("div");
  chip.className = "file-chip";
  chip.textContent = `${file.name} (${formatBytes(file.size)})`;
  dropzone.appendChild(chip);
  const hint = document.createElement("p");
  hint.className = "dropzone-hint";
  hint.style.marginTop = "0.75rem";
  hint.textContent = "Click or drop to replace";
  dropzone.appendChild(hint);
  fileInput.hidden = false;
  dropzone.appendChild(fileInput);
}

function restoreDropzone() {
  dropzone.classList.remove("has-file");
  dropzone.innerHTML = `
    <input
      type="file"
      id="fileInput"
      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp,image/avif,image/svg+xml,image/tiff,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,.svg,.tif,.tiff,.heic,.heif"
      hidden
    />
    <div class="dropzone-inner">
      <div class="dropzone-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M24 32V16m0 0l-6 6m6-6l6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 32v4a4 4 0 004 4h24a4 4 0 004-4v-4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="dropzone-title">Drop an image here</p>
      <p class="dropzone-hint">or click to browse</p>
      <p class="dropzone-formats">JPEG · PNG · WebP · GIF · BMP · AVIF · SVG · TIFF · HEIC</p>
    </div>
  `;
  bindFileInput(document.getElementById("fileInput"));
}

function bindFileInput(input) {
  input.addEventListener("change", () => {
    if (input.files?.[0]) handleFile(input.files[0]);
  });
}

function handleFile(file) {
  if (!isAcceptedFile(file)) {
    showToast("Unsupported file type. Please use a common image format.", true);
    return;
  }
  currentFile = file;
  revokeUrls();
  resultsPanel.hidden = true;

  originalObjectUrl = URL.createObjectURL(file);
  originalPreview.src = originalObjectUrl;

  updateDropzoneWithFile(file);
  options.hidden = false;
  bindFileInput(document.getElementById("fileInput"));

  if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) {
    showToast("Animated GIFs are compressed as a single frame.");
  }

  cachedImage = null;
  updateEstimates();
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode image. Your browser may not support this format."));
    };
    img.src = url;
  });
}

function hasTransparency(ctx, width, height) {
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 100));
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 250) return true;
    }
  }
  return false;
}

function scaleDimensions(width, height, maxDimension) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function pickOutputMime(sourceType, hasAlpha, formatChoice) {
  if (formatChoice !== "auto") return formatChoice;
  if (hasAlpha) return "image/webp";
  if (sourceType === "image/png" && hasAlpha) return "image/png";
  if (sourceType === "image/webp") return "image/webp";
  return "image/jpeg";
}

function extensionForMime(mime) {
  const map = {
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/png": "png",
  };
  return map[mime] || "jpg";
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Compression failed. Try a different output format."));
      },
      mime,
      mime === "image/png" ? undefined : quality
    );
  });
}

async function compressImage(img, file, level, formatChoice) {
  const preset = PRESETS[level] || PRESETS.medium;

  const { width, height } = scaleDimensions(
    img.naturalWidth,
    img.naturalHeight,
    preset.maxDimension
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.drawImage(img, 0, 0, width, height);

  const transparent = hasTransparency(ctx, width, height);
  let mime = pickOutputMime(file.type, transparent, formatChoice);

  if (mime === "image/jpeg" && transparent) {
    ctx.fillStyle = "#ffffff";
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
  }

  let blob = await canvasToBlob(canvas, mime, preset.quality);

  if (formatChoice === "auto" && blob.size >= file.size * 0.98) {
    const fallback =
      mime === "image/jpeg"
        ? "image/webp"
        : mime === "image/webp"
          ? "image/jpeg"
          : "image/webp";
    if (fallback !== mime) {
      const retry = await canvasToBlob(canvas, fallback, preset.quality);
      if (retry.size < blob.size) {
        blob = retry;
        mime = fallback;
      }
    }
  }

  return { blob, mime, width, height };
}

async function runCompress() {
  if (!currentFile) return;

  setLoading(true);
  try {
    const level = getLevel();
    const formatChoice = formatSelect.value;
    const img = await ensureImageLoaded(currentFile);
    const { blob, mime, width, height } = await compressImage(
      img,
      currentFile,
      level,
      formatChoice
    );

    if (compressedObjectUrl) URL.revokeObjectURL(compressedObjectUrl);
    compressedObjectUrl = URL.createObjectURL(blob);
    compressedPreview.src = compressedObjectUrl;

    const savings =
      currentFile.size > 0
        ? Math.max(0, ((currentFile.size - blob.size) / currentFile.size) * 100)
        : 0;

    originalSizeEl.textContent = formatBytes(currentFile.size);
    compressedSizeEl.textContent = formatBytes(blob.size);
    savingsPercentEl.textContent =
      blob.size < currentFile.size
        ? `${savings.toFixed(1)}%`
        : blob.size === currentFile.size
          ? "0%"
          : "Larger";

    if (blob.size >= currentFile.size) {
      savingsPercentEl.style.color = "var(--text-muted)";
    } else {
      savingsPercentEl.style.color = "";
    }

    const baseName = currentFile.name.replace(/\.[^.]+$/, "");
    const ext = extensionForMime(mime);
    const outName = `${baseName}-compressed.${ext}`;

    downloadBtn.href = compressedObjectUrl;
    downloadBtn.download = outName;

    metaLine.textContent = `${width} × ${height} · ${mime.replace("image/", "").toUpperCase()} · ${level} compression`;

    resultsPanel.hidden = false;
    resultsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

    if (blob.size < currentFile.size) {
      showToast(`Saved ${formatBytes(currentFile.size - blob.size)}`);
    } else {
      showToast("This image is already well optimized — try a lower quality level.");
    }
  } catch (err) {
    showToast(err.message || "Something went wrong.", true);
  } finally {
    setLoading(false);
  }
}

function resetAll() {
  currentFile = null;
  cachedImage = null;
  estimateGeneration++;
  revokeUrls();
  resultsPanel.hidden = true;
  options.hidden = true;
  clearEstimates();
  restoreDropzone();
  const input = document.getElementById("fileInput");
  if (input) input.value = "";
}

dropzone.addEventListener("click", (e) => {
  if (e.target.closest("#fileInput")) return;
  document.getElementById("fileInput")?.click();
});

dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    document.getElementById("fileInput")?.click();
  }
});

["dragenter", "dragover"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
  });
});

dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

bindFileInput(fileInput);
compressBtn.addEventListener("click", runCompress);
resetBtn.addEventListener("click", resetAll);

document.querySelectorAll('input[name="level"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!resultsPanel.hidden && currentFile) runCompress();
  });
});

formatSelect.addEventListener("change", () => {
  if (!currentFile) return;
  updateEstimates();
  if (!resultsPanel.hidden) runCompress();
});
