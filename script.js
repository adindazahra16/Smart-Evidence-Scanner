
const $ = (id) => document.getElementById(id);

const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwbr3V2prmOTXXqff-DxAqr4gbEurNBzkjNQQNjOqGZMM9i1xIUcZKqgj_UvPbPoWjA/exec";

let receiptFile = null;
let supportingFiles = [];
let cameraStream = null;
let activeCameraTarget = null;

const receiptCamera = $("receipt-camera");
const receiptGallery = $("receipt-gallery");
const supportingCamera = $("supporting-camera");
const supportingGallery = $("supporting-gallery");

const receiptPreview = $("receipt-preview");
const supportingPreview = $("supporting-preview");

function showMessage(id, message, color = "#555") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = color;
}

function setServerStatus(message, color = "#555") {
  showMessage("server-status", message, color);
}

function checkServer() {
  setServerStatus("Memeriksa koneksi server...");

  fetch(GAS_WEB_APP_URL)
    .then((response) => {
      if (!response.ok) throw new Error("Server tidak merespons");
      return response.text();
    })
    .then(() => {
      setServerStatus("Server aktif dan siap digunakan", "#16803c");
    })
    .catch(() => {
      setServerStatus("Server belum dapat dihubungi", "#c62828");
    });
}

// PILIH FOTO NOTA
if ($("receipt-camera-button")) {
  $("receipt-camera-button").addEventListener("click", () => {
    receiptCamera?.click();
  });
}

if ($("receipt-gallery-button")) {
  $("receipt-gallery-button").addEventListener("click", () => {
    receiptGallery?.click();
  });
}

// PILIH FOTO PENDUKUNG
if ($("supporting-camera-button")) {
  $("supporting-camera-button").addEventListener("click", () => {
    supportingCamera?.click();
  });
}

if ($("supporting-gallery-button")) {
  $("supporting-gallery-button").addEventListener("click", () => {
    supportingGallery?.click();
  });
}

// TAMPILKAN PREVIEW FOTO
function renderPreview(files, container, type) {
  if (!container) return;

  container.innerHTML = "";

  files.forEach((file, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-item";

    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = "Foto " + (index + 1);

    const name = document.createElement("p");
    name.textContent = file.name;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Hapus";
    removeButton.className = "remove-photo-button";

    removeButton.addEventListener("click", () => {
      if (type === "receipt") {
        receiptFile = null;
        if (receiptCamera) receiptCamera.value = "";
        if (receiptGallery) receiptGallery.value = "";
        renderPreview([], receiptPreview, "receipt");
        showMessage("scan-message", "Foto nota dihapus.");
      } else {
        supportingFiles.splice(index, 1);
        renderPreview(
          supportingFiles,
          supportingPreview,
          "supporting"
        );
      }
    });

    wrapper.append(image, name, removeButton);
    container.appendChild(wrapper);
  });
}

function acceptReceipt(file) {
  if (!file || !file.type.startsWith("image/")) {
    showMessage("scan-message", "Pilih file gambar yang valid.", "#c62828");
    return;
  }

  receiptFile = file;
  renderPreview([file], receiptPreview, "receipt");
  showMessage("scan-message", "Foto nota berhasil dipilih.", "#16803c");
}

function acceptSupporting(files) {
  const validFiles = Array.from(files).filter((file) =>
    file.type.startsWith("image/")
  );

  supportingFiles.push(...validFiles);

  renderPreview(
    supportingFiles,
    supportingPreview,
    "supporting"
  );

  showMessage(
    "supporting-message",
    supportingFiles.length + " foto pendukung dipilih.",
    "#16803c"
  );
}

receiptCamera?.addEventListener("change", (event) => {
  acceptReceipt(event.target.files[0]);
});

receiptGallery?.addEventListener("change", (event) => {
  acceptReceipt(event.target.files[0]);
});

supportingCamera?.addEventListener("change", (event) => {
  acceptSupporting(event.target.files);
});

supportingGallery?.addEventListener("change", (event) => {
  acceptSupporting(event.target.files);
});

// KAMERA LANGSUNG
function createWebcamControls() {
  const receiptContainer = $("receipt-webcam");
  const supportingContainer = $("supporting-webcam");

  if (receiptContainer && !$("receipt-direct-camera-button")) {
    const button = document.createElement("button");
    button.id = "receipt-direct-camera-button";
    button.type = "button";
    button.textContent = "Kamera Langsung";
    button.className = "camera-direct-button";

    button.addEventListener("click", () => {
      openWebcam("receipt");
    });

    receiptContainer.parentNode.insertBefore(button, receiptContainer);
  }

  if (supportingContainer && !$("supporting-direct-camera-button")) {
    const button = document.createElement("button");
    button.id = "supporting-direct-camera-button";
    button.type = "button";
    button.textContent = "Kamera Langsung";
    button.className = "camera-direct-button";

    button.addEventListener("click", () => {
      openWebcam("supporting");
    });

    supportingContainer.parentNode.insertBefore(button, supportingContainer);
  }
}

async function openWebcam(target) {
  closeWebcam();

  const container = $(target + "-webcam");
  const video = $(target + "-video");

  if (!container || !video) {
    alert("Area kamera tidak ditemukan.");
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Browser tidak mendukung kamera langsung. Gunakan pilihan Buka Kamera.");
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });

    activeCameraTarget = target;
    video.srcObject = cameraStream;
    container.style.display = "block";

    await video.play();
  } catch (error) {
    console.error("Kamera:", error);
    alert("Kamera tidak dapat dibuka. Periksa izin kamera pada browser.");
    closeWebcam();
  }
}

function closeWebcam() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  ["receipt", "supporting"].forEach((target) => {
    const container = $(target + "-webcam");
    const video = $(target + "-video");

    if (video) video.srcObject = null;
    if (container) container.style.display = "none";
  });

  activeCameraTarget = null;
}

function capturePhoto() {
  if (!cameraStream || !activeCameraTarget) return;

  const target = activeCameraTarget;
  const video = $(target + "-video");

  if (!video || !video.videoWidth) {
    alert("Kamera belum siap. Coba lagi.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (!blob) {
      alert("Gagal mengambil foto.");
      return;
    }

    const file = new File(
      [blob],
      target + "-" + Date.now() + ".jpg",
      { type: "image/jpeg" }
    );

    if (target === "receipt") {
      acceptReceipt(file);
    } else {
      acceptSupporting([file]);
    }

    closeWebcam();
  }, "image/jpeg", 0.9);
}

$("receipt-take-photo")?.addEventListener("click", capturePhoto);
$("supporting-take-photo")?.addEventListener("click", capturePhoto);
$("receipt-close-camera")?.addEventListener("click", closeWebcam);
$("supporting-close-camera")?.addEventListener("click", closeWebcam);

// KONVERSI FOTO KE BASE64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      resolve(String(result).split(",")[1]);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// KIRIM FOTO KE GOOGLE APPS SCRIPT
function sendToBackend(payload) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.name = "scan-frame-" + Date.now();
    iframe.style.display = "none";

    const form = document.createElement("form");
    form.method = "POST";
    form.action = GAS_WEB_APP_URL;
    form.target = iframe.name;
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);

    form.appendChild(input);
    document.body.append(iframe, form);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Waktu pemeriksaan habis. Coba lagi."));
    }, 90000);

    function cleanup() {
      clearTimeout(timeout);
      window.removeEventListener("message", receiveMessage);
      form.remove();
      iframe.remove();
    }

    function receiveMessage(event) {
      if (event.source !== iframe.contentWindow &&
          event.source !== window &&
          event.source !== window.top) {
        return;
      }

      const data = event.data;

      if (!data) return;

      try {
        const result =
          typeof data === "string" ? JSON.parse(data) : data;

        cleanup();
        resolve(result);
      } catch (error) {
        // Abaikan pesan yang bukan hasil pemeriksaan.
      }
    }

    window.addEventListener("message", receiveMessage);

    iframe.addEventListener("error", () => {
      cleanup();
      reject(new Error("Gagal menghubungi server."));
    });

    form.submit();
  });
}

// ISI HASIL PEMERIKSAAN KE FORM
function setField(id, value) {
  const element = $(id);
  if (!element || value === undefined || value === null) return;

  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function normalizeDate(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return text;
  }

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  return text;
}

function applyScanResult(response) {
  let data = response;

  if (data && data.data) data = data.data;
  if (data && data.result) data = data.result;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      throw new Error("Hasil AI tidak dapat dibaca.");
    }
  }

  if (!data || typeof data !== "object") {
    throw new Error("Hasil pemeriksaan kosong.");
  }

  setField("tanggal", normalizeDate(data.tanggal || data.date));
  setField("nominal", data.nominal || data.amount);
  setField("vendor", data.vendor || data.toko || data.merchant);

  setField("kategori", String(
    data.kategori || data.category || "TIDAK DIKETAHUI"
  ).toUpperCase());

  setField("kegiatan", data.kegiatan || data.activity);
  setField("volume", data.volume || data.jumlah_volume);
  setField("harga_satuan", data.harga_satuan || data.unit_price);
  setField("plat", data.plat || data.nomor_polisi || data.plate);
  setField("kilometer", data.kilometer || data.km);
  setField("keterangan", data.keterangan || data.catatan || data.notes);

  updateBBM();
}

// TOMBOL SCAN AI
$("scan-button")?.addEventListener("click", async () => {
  if (!receiptFile) {
    showMessage("scan-message", "Pilih atau foto nota terlebih dahulu.", "#c62828");
    return;
  }

  const button = $("scan-button");
  if (button) {
    button.disabled = true;
    button.textContent = "AI sedang memeriksa nota...";
  }

  showMessage("scan-message", "Foto sedang dikirim untuk diperiksa...");

  try {
    const image = await fileToBase64(receiptFile);

    const result = await sendToBackend({
      image,
      mimeType: receiptFile.type
    });

    if (result.success === false) {
      throw new Error(result.message || "Pemeriksaan gagal.");
    }

    applyScanResult(result);

    showMessage(
      "scan-message",
      "Pemeriksaan selesai. Silakan periksa kembali hasilnya.",
      "#16803c"
    );
  } catch (error) {
    console.error(error);
    showMessage(
      "scan-message",
      error.message || "Terjadi kesalahan saat memeriksa nota.",
      "#c62828"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Periksa Nota dengan AI";
    }
  }
});

// TAMPILKAN FIELD KHUSUS BBM
function updateBBM() {
  const category = $("kategori");
  const bbmFields = $("bbm-fields");

  if (!category || !bbmFields) return;

  const isBBM = category.value.toUpperCase() === "BBM";

  bbmFields.style.display = isBBM ? "block" : "none";

  if (!isBBM) {
    showMessage("bbm-message", "");
  }
}

$("kategori")?.addEventListener("change", updateBBM);

// BUAT CAPTION TELEGRAM
function createTelegramCaption() {
  const value = (id) => $(id)?.value?.trim() || "-";

  return [
    "AI SMART EXPENSE EVIDENCE",
    "",
    "Tanggal: " + value("tanggal"),
    "Nominal: " + value("nominal"),
    "Vendor: " + value("vendor"),
    "Kategori: " + value("kategori"),
    "Kegiatan: " + value("kegiatan"),
    "Volume: " + value("volume"),
    "Harga Satuan: " + value("harga_satuan"),
    "Plat Nomor: " + value("plat"),
    "Kilometer: " + value("kilometer"),
    "Keterangan: " + value("keterangan"),
    "",
    "Foto nota dan foto pendukung terlampir."
  ].join("\n");
}

// BAGIKAN KE TELEGRAM / APLIKASI LAIN
async function shareToTelegram() {
  if (!receiptFile) {
    alert("Foto nota belum dipilih.");
    return;
  }

  const files = [receiptFile, ...supportingFiles];
  const caption = createTelegramCaption();

  try {
    if (navigator.share && navigator.canShare) {
      const shareData = {
        title: "AI Smart Expense Evidence",
        text: caption,
        files
      };

      if (navigator.canShare({ files })) {
        await navigator.share(shareData);
        return;
      }
    }

    // Jika fitur berbagi file tidak didukung browser,
    // unduh foto dan salin caption.
    for (let i = 0; i < files.length; i++) {
      const url = URL.createObjectURL(files[i]);
      const link = document.createElement("a");

      link.href = url;
      link.download = files[i].name || `foto-${i + 1}.jpg`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    await navigator.clipboard.writeText(caption);

    window.open("https://web.telegram.org/", "_blank");

    alert(
      "Foto berhasil diunduh dan caption disalin. " +
      "Silakan lampirkan foto dan tempel caption di Telegram."
    );
  } catch (error) {
    if (error.name === "AbortError") return;

    console.error(error);
    alert("Berbagi gagal. Silakan coba kembali.");
  }
}

$("telegram-button")?.addEventListener("click", shareToTelegram);

// INISIALISASI
createWebcamControls();
checkServer();
updateBBM();
