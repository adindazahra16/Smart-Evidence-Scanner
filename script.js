
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
  }
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
    image.onerror = () => reject(
      new Error("Foto tidak dapat dibuka.")
    );

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

  const maxWidth = 1400;
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
    dataURL: canvas.toDataURL("image/jpeg", 0.82),
    width: canvas.width,
    height: canvas.height
  };
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

function takePhoto(target) {
  if (!cameraStream || activeCameraTarget !== target) {
    alert("Kamera belum aktif.");
    return;
  }

  const video = $(target + "-video");

  if (!video.videoWidth || !video.videoHeight) {
    alert("Kamera belum siap. Coba lagi.");
    return;
  }

  const canvas = document.createElement("canvas");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext("2d").drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  canvas.toBlob(blob => {
    if (!blob) {
      alert("Gagal mengambil foto.");
      return;
    }

    const file = new File(
      [blob],
      "foto-" + Date.now() + ".jpg",
      { type: "image/jpeg" }
    );

    if (target === "receipt") {
      receiptFile = file;
      renderReceiptPreview();
    } else {
      supportingFiles.push(file);
      renderSupportingPreview();
    }

    stopCamera();

  }, "image/jpeg", 0.9);
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
// MENYESUAIKAN FOTO DALAM PDF
// ===============================

function fitImage(doc, image, x, y, maxWidth, maxHeight) {
  const ratio = Math.min(
    maxWidth / image.width,
    maxHeight / image.height
  );

  const width = image.width * ratio;
  const height = image.height * ratio;

  doc.addImage(
    image.dataURL,
    "JPEG",
    x + (maxWidth - width) / 2,
    y + (maxHeight - height) / 2,
    width,
    height
  );
}

// ===============================
// MEMBUAT PDF A4 SATU HALAMAN
// ===============================

async function createPDF() {
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
      "Menyiapkan PDF, mohon tunggu..."
    );

    const jsPDF = await loadPDFLibrary();

    const doc = new jsPDF("p", "mm", "a4");

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    let y = 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(
      "DOKUMENTASI BUKTI PENGELUARAN",
      margin,
      y
    );

    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Foto Nota", margin, y);

    y += 3;

    const receiptImage = await loadImage(receiptFile);

    fitImage(
      doc,
      receiptImage,
      margin,
      y,
      contentWidth,
      78
    );

    y += 82;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Dokumentasi Kegiatan", margin, y);

    y += 4;

    const photos = supportingFiles.slice(0, 4);
    const gap = 4;
    const cellWidth = (contentWidth - gap) / 2;
    const cellHeight = 30;

    for (let i = 0; i < photos.length; i++) {
      const image = await loadImage(photos[i]);

      const column = i % 2;
      const row = Math.floor(i / 2);

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
    }

    if (photos.length) {
      y += 2 * (cellHeight + gap);
    }

    y += 3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Uraian Kegiatan", margin, y);

    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const activity =
      $("kegiatan")?.value?.trim() ||
      "Uraian kegiatan belum diisi.";

    const lines = doc.splitTextToSize(
      activity,
      contentWidth
    );

    const availableHeight = pageHeight - margin - y;
    const maxLines = Math.max(
      1,
      Math.floor(availableHeight / 4.5)
    );

    doc.text(lines.slice(0, maxLines), margin, y);

    doc.save("Dokumentasi-Bukti-Pengeluaran.pdf");

    showMessage(
      "pdf-message",
      "PDF berhasil dibuat.",
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
// TERUSKAN KE TELEGRAM DESKTOP
// ===============================

async function sendToTelegram() {
  if (!receiptFile) {
    alert("Foto nota belum dipilih.");
    return;
  }

  const button = $("telegram-button");
  const caption = $("telegram-caption")?.value || "";

  const files = [
    receiptFile,
    ...supportingFiles
  ];

  if (!button) {
    alert("Tombol Telegram tidak ditemukan.");
    return;
  }

  button.disabled = true;
  button.textContent = "Menyiapkan dokumentasi...";

  // Mencoba membuka aplikasi Telegram.
  // Browser atau Windows mungkin meminta izin.
  const telegramAppURL =
    "tg://msg?text=" + encodeURIComponent(caption);

  let telegramWindow = null;

  try {
    telegramWindow = window.open(
      telegramAppURL,
      "_blank"
    );
  } catch (error) {
    console.warn("Telegram Desktop tidak dapat dibuka:", error);
  }

  try {
    // Unduh semua foto.
    files.forEach((file, index) => {
      downloadFile(file, index);
    });

    // Salin keterangan.
    let copied = false;

    try {
      await navigator.clipboard.writeText(caption);
      copied = true;
    } catch (error) {
      console.warn("Gagal menyalin keterangan:", error);
    }

    if (telegramWindow) {
      showMessage(
        "telegram-message",
        copied
          ? "Foto diunduh dan keterangan disalin. Jika Telegram terbuka, lampirkan foto dan tempel keterangan."
          : "Foto diunduh. Salin keterangan dari kolom pesan."
      );
    } else {
      showMessage(
        "telegram-message",
        "Foto diunduh. Browser tidak membuka aplikasi Telegram otomatis."
      );

      const message = $("telegram-message");

      if (message) {
        const link = document.createElement("a");

        link.href =
          "https://t.me/share/url?url=&text=" +
          encodeURIComponent(caption);

        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = " Buka Telegram Web";

        message.appendChild(link);
      }
    }

  } catch (error) {
    console.error("TELEGRAM ERROR:", error);

    showMessage(
      "telegram-message",
      "Gagal menyiapkan dokumentasi: " + error.message,
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

  receiptCameraInput?.addEventListener("change", event => {
    const file = event.target.files?.[0];

    if (file) {
      receiptFile = file;
      renderReceiptPreview();
    }

    event.target.value = "";
  });

  supportingInput?.addEventListener("change", event => {
    addSupportingFiles(event.target.files || []);
    event.target.value = "";
  });

  supportingCameraInput?.addEventListener("change", event => {
    addSupportingFiles(event.target.files || []);
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
