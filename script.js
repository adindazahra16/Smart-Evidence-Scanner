const $ = id => document.getElementById(id);

const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbwbr3V2prmOTXXqff-DxAqr4gbEurNBzkjNQQNjOqGZMM9i1xIUcZKqgj_UvPbPoWjA/exec";

let receiptFile = null;
let supportingFiles = [];
let cameraStream = null;
let activeCameraTarget = null;

const receiptInput = $("receipt-gallery");
const receiptCameraInput = $("receipt-camera");
const supportingInput = $("supporting-gallery");
const supportingCameraInput = $("supporting-camera");

// ===============================
// PESAN STATUS
// ===============================

function showMessage(id, message, color = "") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;

  if (color) {
    element.style.color = color;
    element.style.fontWeight = color === "red" ? "bold" : "normal";
  }
}

// ===============================
// VALIDASI NOTA BBM
// ===============================

function validateBBM() {
  const category = String($("kategori")?.value || "")
    .trim()
    .toUpperCase();

  if (category !== "BBM") return true;

  const plat = $("plat")?.value?.trim() || "";
  const kilometer = $("kilometer")?.value?.trim() || "";

  const missing = [];

  if (!plat) missing.push("Nomor plat wajib diisi.");
  if (!kilometer) missing.push("Kilometer wajib diisi.");

  if (missing.length) {
    const message =
      "DATA BBM BELUM LENGKAP! " + missing.join(" ");

    showMessage("pdf-message", message, "red");
    showMessage("telegram-message", message, "red");

    alert(message);

    if (!plat) {
      $("plat")?.focus();
    } else {
      $("kilometer")?.focus();
    }

    return false;
  }

  return true;
}

// ===============================
// MEMBACA FOTO
// ===============================

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gagal membaca foto."));

    reader.readAsDataURL(file);
  });
}

function loadBrowserImage(dataURL) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Foto tidak dapat dibuka."));

    image.src = dataURL;
  });
}

async function compressForAI(file) {
  const dataURL = await fileToDataURL(file);
  const image = await loadBrowserImage(dataURL);

  const maxWidth = 1200;
  const scale = Math.min(1, maxWidth / image.width);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Gagal memproses foto.");
  }

  context.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const compressed = canvas.toDataURL("image/jpeg", 0.72);

  return {
    imageBase64: compressed.split(",")[1],
    mimeType: "image/jpeg"
  };
}

async function loadImage(file) {
  const dataURL = await fileToDataURL(file);
  const image = await loadBrowserImage(dataURL);

  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / image.width);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Gagal memproses gambar PDF.");
  }

  context.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    dataURL: canvas.toDataURL("image/jpeg", 0.88),
    width: canvas.width,
    height: canvas.height
  };
}

// ===============================
// WATERMARK TANGGAL, JAM, LOKASI
// ===============================

function getCurrentLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve("Lokasi tidak tersedia");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const latitude = position.coords.latitude.toFixed(5);
        const longitude = position.coords.longitude.toFixed(5);

        resolve(
          "Lokasi GPS: " + latitude + ", " + longitude
        );
      },
      error => {
        console.warn("Lokasi GPS tidak tersedia:", error);
        resolve("Lokasi tidak tersedia");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
      }
    );
  });
}

function drawPhotoWatermark(canvas, capturedAt, locationText) {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Gagal membuat watermark.");
  }

  const width = canvas.width;
  const height = canvas.height;

  const dateText = capturedAt.toLocaleDateString("id-ID");
  const timeText = capturedAt.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const firstLine = "Tanggal: " + dateText + "  |  Jam: " + timeText;
  const secondLine = locationText;

  const fontSize = Math.max(15, Math.round(width * 0.019));
  const padding = Math.max(12, Math.round(width * 0.015));
  const lineHeight = fontSize * 1.5;

  context.save();

  context.font = "bold " + fontSize + "px Arial";

  const textWidth = Math.max(
    context.measureText(firstLine).width,
    context.measureText(secondLine).width
  );

  const boxWidth = Math.min(
    width - padding * 2,
    textWidth + padding * 2
  );

  const boxHeight = lineHeight * 2 + padding * 1.5;

  const x = padding;
  const y = height - boxHeight - padding;

  context.fillStyle = "rgba(0, 0, 0, 0.65)";
  context.fillRect(x, y, boxWidth, boxHeight);

  context.fillStyle = "#ffffff";
  context.textBaseline = "top";

  context.fillText(
    firstLine,
    x + padding,
    y + padding,
    boxWidth - padding * 2
  );

  context.fillText(
    secondLine,
    x + padding,
    y + padding + lineHeight,
    boxWidth - padding * 2
  );

  context.restore();
}

function canvasToPhotoFile(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("Gagal menyimpan foto."));
        return;
      }

      resolve(
        new File(
          [blob],
          filename,
          { type: "image/jpeg" }
        )
      );
    }, "image/jpeg", 0.92);
  });
}

async function watermarkCameraFile(file) {
  const capturedAt = new Date();

  try {
    const locationText = await getCurrentLocation();
    const dataURL = await fileToDataURL(file);
    const image = await loadBrowserImage(dataURL);

    const canvas = document.createElement("canvas");

    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    drawPhotoWatermark(
      canvas,
      capturedAt,
      locationText
    );

    return await canvasToPhotoFile(
      canvas,
      "foto-watermark-" + Date.now() + ".jpg"
    );

  } catch (error) {
    console.error("Watermark gagal:", error);
    return file;
  }
}

// ===============================
// PREVIEW FOTO NOTA
// ===============================

function renderReceiptPreview() {
  const container = $("receipt-preview");
  if (!container) return;

  container.innerHTML = "";

  if (!receiptFile) {
    container.textContent = "Belum ada foto nota.";
    return;
  }

  const image = document.createElement("img");

  image.src = URL.createObjectURL(receiptFile);
  image.alt = "Foto nota";
  image.style.maxWidth = "100%";
  image.style.maxHeight = "300px";
  image.style.objectFit = "contain";

  container.appendChild(image);
}

// ===============================
// PREVIEW FOTO KEGIATAN
// ===============================

function renderSupportingPreview() {
  const container = $("supporting-preview");
  if (!container) return;

  container.innerHTML = "";

  if (!supportingFiles.length) {
    container.textContent = "Belum ada foto dokumentasi.";
    showMessage("supporting-message", "");
    return;
  }

  supportingFiles.forEach((file, index) => {
    const wrapper = document.createElement("div");

    wrapper.style.display = "inline-flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.margin = "8px";
    wrapper.style.maxWidth = "130px";

    const image = document.createElement("img");

    image.src = URL.createObjectURL(file);
    image.alt = "Foto kegiatan " + (index + 1);
    image.style.width = "120px";
    image.style.height = "100px";
    image.style.objectFit = "cover";
    image.style.borderRadius = "8px";

    const remove = document.createElement("button");

    remove.type = "button";
    remove.textContent = "Hapus";
    remove.style.marginTop = "5px";

    remove.addEventListener("click", () => {
      supportingFiles.splice(index, 1);
      renderSupportingPreview();
    });

    wrapper.appendChild(image);
    wrapper.appendChild(remove);
    container.appendChild(wrapper);
  });

  showMessage(
    "supporting-message",
    supportingFiles.length + " foto dokumentasi dipilih."
  );
}

function addSupportingFiles(files) {
  const validFiles = Array.from(files).filter(file =>
    file.type.startsWith("image/")
  );

  supportingFiles.push(...validFiles);

  renderSupportingPreview();
}

// ===============================
// KAMERA
// ===============================

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  cameraStream = null;
  activeCameraTarget = null;

  ["receipt-webcam", "supporting-webcam"].forEach(id => {
    const container = $(id);

    if (container) {
      container.hidden = true;
    }
  });
}

async function openCamera(target) {
  try {
    stopCamera();

    const container = $(target + "-webcam");
    const video = $(target + "-video");

    if (!container || !video) {
      alert("Komponen kamera tidak ditemukan.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Browser tidak mendukung akses kamera.");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });

    activeCameraTarget = target;
    video.srcObject = cameraStream;
    container.hidden = false;

    await video.play();

  } catch (error) {
    console.error(error);

    alert(
      "Kamera tidak dapat dibuka. Periksa izin kamera dan koneksi HTTPS."
    );
  }
}

async function takePhoto(target) {
  if (!cameraStream || activeCameraTarget !== target) {
    alert("Kamera belum aktif.");
    return;
  }

  const video = $(target + "-video");

  if (!video.videoWidth || !video.videoHeight) {
    alert("Kamera belum siap. Coba lagi.");
    return;
  }

  const button = $(target + "-take-photo");
  const originalText = button?.textContent;

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "Memproses Foto...";
    }

    const capturedAt = new Date();

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Gagal mengambil foto.");
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    showMessage(
      "supporting-message",
      "Memproses tanggal, jam, dan lokasi foto..."
    );

    const locationText = await getCurrentLocation();

    drawPhotoWatermark(
      canvas,
      capturedAt,
      locationText
    );

    const file = await canvasToPhotoFile(
      canvas,
      "foto-" + Date.now() + ".jpg"
    );

    if (target === "receipt") {
      receiptFile = file;
      renderReceiptPreview();
    } else {
      supportingFiles.push(file);
      renderSupportingPreview();
    }

    stopCamera();

  } catch (error) {
    console.error(error);
    alert(error.message || "Gagal mengambil foto.");

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText || "Ambil Foto";
    }
  }
}

// ===============================
// HASIL SCAN AI
// ===============================

function updateBBMFields() {
  const category = $("kategori")?.value || "";
  const fields = $("bbm-fields");

  if (fields) {
    fields.hidden = category !== "BBM";
  }

  if (category !== "BBM") {
    showMessage("pdf-message", "");
    showMessage("telegram-message", "");
  }
}

function fillScanResult(data) {
  const fields = [
    "tanggal",
    "nominal",
    "vendor",
    "kategori",
    "kegiatan",
    "volume",
    "harga_satuan",
    "plat",
    "kilometer",
    "keterangan"
  ];

  fields.forEach(field => {
    const element = $(field);

    if (element && data[field] !== undefined) {
      element.value = data[field] ?? "";
    }
  });

  updateBBMFields();
  updateTelegramCaption();
}

function getScanData() {
  return {
    tanggal: $("tanggal")?.value || "",
    nominal: $("nominal")?.value || "",
    vendor: $("vendor")?.value || "",
    kategori: $("kategori")?.value || "",
    kegiatan: $("kegiatan")?.value || "",
    volume: $("volume")?.value || "",
    harga_satuan: $("harga_satuan")?.value || "",
    plat: $("plat")?.value || "",
    kilometer: $("kilometer")?.value || "",
    keterangan: $("keterangan")?.value || ""
  };
}

function updateTelegramCaption() {
  const data = getScanData();

  const lines = [
    "DOKUMENTASI BUKTI PENGELUARAN",
    "",
    "Tanggal: " + data.tanggal,
    "Nominal: " + data.nominal,
    "Vendor: " + data.vendor,
    "Kategori: " + data.kategori,
    "Kegiatan: " + data.kegiatan
  ];

  if (data.kategori === "BBM") {
    lines.push("Kendaraan: " + data.plat);
    lines.push("Kilometer: " + data.kilometer);
  }

  if (data.keterangan) {
    lines.push("Keterangan: " + data.keterangan);
  }

  const caption = $("telegram-caption");

  if (caption) {
    caption.value = lines.join("\n");
  }
}

// ===============================
// KIRIM FOTO KE APPS SCRIPT
// ===============================

function sendToBackend(payload) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    const form = document.createElement("form");
    const requestId = "scan-" + Date.now();

    iframe.name = requestId;
    iframe.style.display = "none";

    form.method = "POST";
    form.action = GAS_WEB_APP_URL;
    form.target = requestId;
    form.style.display = "none";

    const input = document.createElement("input");

    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);

    form.appendChild(input);

    let finished = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timeout);
      form.remove();
      iframe.remove();
    };

    const finish = (callback, result) => {
      if (finished) return;

      finished = true;
      cleanup();
      callback(result);
    };

    const onMessage = event => {
      let result = event.data;

      if (typeof result === "string") {
        try {
          result = JSON.parse(result);
        } catch {
          return;
        }
      }

      if (!result || typeof result.success !== "boolean") {
        return;
      }

      if (result.success) {
        finish(resolve, result.data);
      } else {
        finish(
          reject,
          new Error(result.error || "Gagal membaca nota.")
        );
      }
    };

    const timeout = setTimeout(() => {
      finish(
        reject,
        new Error(
          "Waktu pemeriksaan habis. Periksa status eksekusi Apps Script."
        )
      );
    }, 360000);

    window.addEventListener("message", onMessage);

    document.body.appendChild(iframe);
    document.body.appendChild(form);

    form.submit();
  });
}

// ===============================
// SCAN NOTA
// ===============================

async function scanReceipt() {
  if (!receiptFile) {
    alert("Silakan pilih atau ambil foto nota terlebih dahulu.");
    return;
  }

  const button = $("scan-button");

  if (!button) {
    alert("Tombol scan tidak ditemukan.");
    return;
  }

  try {
    button.disabled = true;
    button.textContent = "AI Sedang Memeriksa...";

    showMessage(
      "scan-message",
      "AI sedang membaca foto nota. Mohon tunggu..."
    );

    const compressed = await compressForAI(receiptFile);

    const result = await sendToBackend({
      image: compressed.imageBase64,
      mimeType: compressed.mimeType
    });

    fillScanResult(result);

    showMessage(
      "scan-message",
      "Nota berhasil diperiksa. Silakan periksa kembali hasilnya.",
      "green"
    );

  } catch (error) {
    console.error(error);

    showMessage(
      "scan-message",
      error.message || "Terjadi kesalahan saat membaca nota.",
      "red"
    );

  } finally {
    button.disabled = false;
    button.textContent = "Periksa Nota dengan AI";
  }
}

// ===============================
// MEMUAT LIBRARY PDF
// ===============================

async function loadPDFLibrary() {
  if (window.jspdf?.jsPDF) {
    return window.jspdf.jsPDF;
  }

  const sources = [
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
    "https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js"
  ];

  for (const source of sources) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");

        const timeout = setTimeout(
          () => reject(new Error("Waktu pemuatan PDF habis.")),
          12000
        );

        script.src = source;
        script.async = true;

        script.onload = () => {
          clearTimeout(timeout);
          resolve();
        };

        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Library PDF gagal dimuat."));
        };

        document.head.appendChild(script);
      });

      if (window.jspdf?.jsPDF) {
        return window.jspdf.jsPDF;
      }

    } catch (error) {
      console.warn("Mencoba sumber PDF berikutnya:", source);
    }
  }

  throw new Error(
    "Library PDF gagal dimuat dari semua sumber. Periksa koneksi internet."
  );
}

// ===============================
// MENEMPATKAN FOTO TANPA MEMOTONG
// POSISI RATA KIRI
// ===============================

function fitImage(doc, image, x, y, maxWidth, maxHeight) {
  const ratio = Math.min(
    maxWidth / image.width,
    maxHeight / image.height
  );

  const width = image.width * ratio;
  const height = image.height * ratio;

  // Foto dimulai dari sisi kiri area, tidak dipusatkan.
  doc.addImage(
    image.dataURL,
    "JPEG",
    x,
    y,
    width,
    height
  );

  return { width, height };
}

// ===============================
// SUSUNAN FOTO PENDUKUNG
// UKURAN MAKSIMAL 75 MM DAN DUA KOLOM
// ===============================

function drawPortraitLayout(doc, images, margin, y, contentWidth, contentHeight) {
  drawSupportingGrid(doc, images, margin, y, contentWidth, contentHeight);
}

function drawLandscapeLayout(doc, images, margin, y, contentWidth, contentHeight) {
  drawSupportingGrid(doc, images, margin, y, contentWidth, contentHeight);
}

function drawSupportingGrid(doc, images, margin, y, contentWidth, contentHeight) {
  const gap = 4;
  const columns = 2;
  const cellWidth = (contentWidth - gap) / columns;
  const cellHeight = 75;
  const maxRows = Math.floor((contentHeight + gap) / (cellHeight + gap));
  const maxPhotos = Math.min(images.length, maxRows * columns, 4);

  images.slice(0, maxPhotos).forEach((image, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = margin + column * (cellWidth + gap);
    const photoY = y + row * (cellHeight + gap);

    fitImage(
      doc,
      image,
      x,
      photoY,
      cellWidth,
      cellHeight
    );
  });
}

// ===============================
// MEMBUAT PDF FOTO SAJA
// TANPA JUDUL, LABEL, ATAU TULISAN
// ===============================

async function createPDF() {
  if (!validateBBM()) return;

  if (!receiptFile) {
    alert("Foto nota harus tersedia untuk membuat PDF.");
    return;
  }

  const button = $("pdf-button");

  if (!button) {
    alert("Tombol PDF tidak ditemukan. Periksa index.html.");
    return;
  }

  try {
    button.disabled = true;
    button.textContent = "Membuat PDF...";

    showMessage(
      "pdf-message",
      "Menyiapkan PDF foto, mohon tunggu..."
    );

    const jsPDF = await loadPDFLibrary();
    const doc = new jsPDF("p", "mm", "a4");

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const gap = 5;
    const contentWidth = pageWidth - margin * 2;
    const bottomLimit = pageHeight - margin;

    // Foto nota di bagian atas, maksimal setinggi 75 mm.
    const receiptImage = await loadImage(receiptFile);
    const receiptPlacement = fitImage(
      doc,
      receiptImage,
      margin,
      margin,
      contentWidth,
      75
    );

    // Foto pendukung disusun dua kolom.
    const photos = supportingFiles.slice(0, 4);
    const loadedImages = [];

    for (const file of photos) {
      loadedImages.push(await loadImage(file));
    }

    if (loadedImages.length) {
      const supportingY = margin + receiptPlacement.height + gap;
      const availableHeight = bottomLimit - supportingY;

      if (availableHeight <= 0) {
        throw new Error("Ruang untuk foto dokumentasi tidak mencukupi.");
      }

      const isPortrait =
        loadedImages[0].height > loadedImages[0].width;

      if (isPortrait) {
        drawPortraitLayout(
          doc,
          loadedImages,
          margin,
          supportingY,
          contentWidth,
          availableHeight
        );
      } else {
        drawLandscapeLayout(
          doc,
          loadedImages,
          margin,
          supportingY,
          contentWidth,
          availableHeight
        );
      }
    }

    doc.save("evidance.pdf");

    showMessage(
      "pdf-message",
      "PDF evidance.pdf berhasil dibuat.",
      "green"
    );

  } catch (error) {
    console.error("PDF ERROR:", error);

    showMessage(
      "pdf-message",
      error.message || "Gagal membuat PDF.",
      "red"
    );

  } finally {
    button.disabled = false;
    button.textContent = "Buat PDF A4";
  }
}

// ===============================
// UNDUH FOTO
// ===============================

function downloadFile(file, index) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    file.name || "dokumentasi-" + (index + 1) + ".jpg";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 15000);
}

// ===============================
// SALIN KETERANGAN UNTUK TELEGRAM
// ===============================

async function sendToTelegram() {
  if (!validateBBM()) return;

  const button = $("telegram-button");

  if (!button) {
    alert("Tombol Telegram tidak ditemukan.");
    return;
  }

  updateTelegramCaption();

  const captionElement = $("telegram-caption");
  const caption = captionElement?.value?.trim() || "";

  if (!caption) {
    showMessage(
      "telegram-message",
      "Keterangan masih kosong.",
      "red"
    );
    return;
  }

  button.disabled = true;
  button.textContent = "Menyalin Keterangan...";

  try {
    let copied = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(caption);
        copied = true;
      } catch (error) {
        console.warn("Clipboard API gagal:", error);
      }
    }

    if (!copied) {
      const temporaryInput =
        document.createElement("textarea");

      temporaryInput.value = caption;
      temporaryInput.style.position = "fixed";
      temporaryInput.style.left = "-9999px";
      temporaryInput.style.top = "0";

      document.body.appendChild(temporaryInput);
      temporaryInput.focus();
      temporaryInput.select();
      temporaryInput.setSelectionRange(
        0,
        temporaryInput.value.length
      );

      copied = document.execCommand("copy");

      temporaryInput.remove();
    }

    if (copied) {
      showMessage(
        "telegram-message",
        "Keterangan berhasil disalin! Buka Telegram Desktop, pilih penerima, lalu tekan Ctrl + V.",
        "green"
      );
    } else {
      showMessage(
        "telegram-message",
        "Gagal menyalin otomatis. Silakan salin keterangan dari kolom pesan.",
        "red"
      );
    }

  } catch (error) {
    console.error("COPY ERROR:", error);

    showMessage(
      "telegram-message",
      "Gagal menyalin keterangan. Silakan coba lagi.",
      "red"
    );

  } finally {
    button.disabled = false;
    button.textContent = "Teruskan ke Telegram";
  }
}

// ===============================
// INISIALISASI APLIKASI
// ===============================

function initializeApp() {
  $("receipt-camera-button")?.addEventListener(
    "click",
    () => openCamera("receipt")
  );

  $("supporting-camera-button")?.addEventListener(
    "click",
    () => openCamera("supporting")
  );

  $("receipt-gallery-button")?.addEventListener(
    "click",
    () => receiptInput?.click()
  );

  $("supporting-gallery-button")?.addEventListener(
    "click",
    () => supportingInput?.click()
  );

  $("receipt-take-photo")?.addEventListener(
    "click",
    () => takePhoto("receipt")
  );

  $("supporting-take-photo")?.addEventListener(
    "click",
    () => takePhoto("supporting")
  );

  $("receipt-close-camera")?.addEventListener(
    "click",
    stopCamera
  );

  $("supporting-close-camera")?.addEventListener(
    "click",
    stopCamera
  );

  receiptInput?.addEventListener("change", event => {
    const file = event.target.files?.[0];

    if (file) {
      receiptFile = file;
      renderReceiptPreview();
    }

    event.target.value = "";
  });

  receiptCameraInput?.addEventListener("change", async event => {
    const file = event.target.files?.[0];

    if (file) {
      showMessage("scan-message", "Memproses watermark foto nota...");

      receiptFile = await watermarkCameraFile(file);
      renderReceiptPreview();

      showMessage("scan-message", "Foto nota siap digunakan.", "green");
    }

    event.target.value = "";
  });

  supportingInput?.addEventListener("change", event => {
    addSupportingFiles(event.target.files || []);
    event.target.value = "";
  });

  supportingCameraInput?.addEventListener("change", async event => {
    const files = Array.from(event.target.files || []);

    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;

      showMessage(
        "supporting-message",
        "Memproses watermark foto dokumentasi..."
      );

      const watermarkedFile = await watermarkCameraFile(file);
      supportingFiles.push(watermarkedFile);
    }

    renderSupportingPreview();
    event.target.value = "";
  });

  $("scan-button")?.addEventListener(
    "click",
    scanReceipt
  );

  $("kategori")?.addEventListener(
    "change",
    updateBBMFields
  );

  [
    "tanggal",
    "nominal",
    "vendor",
    "kategori",
    "kegiatan",
    "plat",
    "kilometer",
    "keterangan"
  ].forEach(id => {
    $(id)?.addEventListener(
      "input",
      updateTelegramCaption
    );
  });

  $("pdf-button")?.addEventListener(
    "click",
    createPDF
  );

  $("telegram-button")?.addEventListener(
    "click",
    sendToTelegram
  );

  updateBBMFields();
  renderReceiptPreview();
  renderSupportingPreview();

  showMessage(
    "server-status",
    "Aplikasi siap digunakan.",
    "green"
  );
}

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);
