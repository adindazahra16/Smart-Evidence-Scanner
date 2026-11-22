
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

function showMessage(id, message, color = "") {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = color;
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gagal membaca foto."));

    reader.readAsDataURL(file);
  });
}

function dataURLToFile(dataURL, filename) {
  const parts = dataURL.split(",");
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }

  return new File([array], filename, { type: mime });
}

async function compressForAI(file) {
  const dataURL = await fileToDataURL(file);
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("Foto tidak dapat dibuka."));
    image.src = dataURL;
  });

  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / image.width);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const compressed = canvas.toDataURL("image/jpeg", 0.78);

  return {
    imageBase64: compressed.split(",")[1],
    mimeType: "image/jpeg"
  };
}

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

function renderSupportingPreview() {
  const container = $("supporting-preview");
  if (!container) return;

  container.innerHTML = "";

  if (!supportingFiles.length) {
    container.textContent = "Belum ada foto dokumentasi.";
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

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  cameraStream = null;
  activeCameraTarget = null;

  ["receipt-webcam", "supporting-webcam"].forEach(id => {
    const container = $(id);
    if (container) container.hidden = true;
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
    alert(
      "Kamera tidak dapat dibuka. Pastikan izin kamera diberikan dan gunakan HTTPS."
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
  }, "image/jpeg", 0.92);
}

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
  if (caption) caption.value = lines.join("\n");
}

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

      if (
        !result ||
        typeof result.success !== "boolean"
      ) {
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
          "Waktu pemeriksaan habis. Silakan coba lagi."
        )
      );
    }, 150000);

    window.addEventListener("message", onMessage);

    document.body.appendChild(iframe);
    document.body.appendChild(form);

    form.submit();
  });
}

async function scanReceipt() {
  if (!receiptFile) {
    alert("Silakan pilih atau ambil foto nota terlebih dahulu.");
    return;
  }

  const button = $("scan-button");

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

async function loadImage(file) {
  const dataURL = await fileToDataURL(file);
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = dataURL;
  });

  return {
    dataURL,
    width: image.width,
    height: image.height
  };
}

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

async function createPDF() {
  if (!receiptFile) {
    alert("Foto nota harus tersedia untuk membuat PDF.");
    return;
  }

  if (!window.jspdf?.jsPDF) {
    alert("Fitur PDF belum tersedia. Periksa koneksi internet.");
    return;
  }

  const button = $("pdf-button");

  try {
    button.disabled = true;
    button.textContent = "Membuat PDF...";

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    const pageWidth = 210;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    let y = 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("DOKUMENTASI BUKTI PENGELUARAN", margin, y);

    y += 9;

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
      83
    );

    y += 88;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Dokumentasi Kegiatan", margin, y);

    y += 4;

    const photos = supportingFiles.slice(0, 4);
    const gap = 4;
    const cellWidth = (contentWidth - gap) / 2;
    const cellHeight = 34;

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

    y += photos.length ? 2 * (cellHeight + gap) : 0;
    y += 3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Uraian Kegiatan", margin, y);

    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const activity = $("kegiatan")?.value?.trim()
      || "Uraian kegiatan belum diisi.";

    const lines = doc.splitTextToSize(
      activity,
      contentWidth
    );

    const availableHeight = 297 - y - 12;
    const maxLines = Math.max(
      1,
      Math.floor(availableHeight / 4.5)
    );

    doc.text(lines.slice(0, maxLines), margin, y);

    doc.save("Dokumentasi-Bukti-Pengeluaran.pdf");

    showMessage(
      "supporting-message",
      "PDF berhasil dibuat."
    );

  } catch (error) {
    console.error(error);
    alert("Gagal membuat PDF: " + error.message);

  } finally {
    button.disabled = false;
    button.textContent = "Buat PDF A4";
  }
}

async function sendToTelegram() {
  if (!receiptFile) {
    alert("Foto nota belum dipilih.");
    return;
  }

  const caption = $("telegram-caption")?.value || "";
  const files = [receiptFile, ...supportingFiles];

  try {
    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files })
    ) {
      await navigator.share({
        title: "Dokumentasi Bukti Pengeluaran",
        text: caption,
        files
      });

      return;
    }

    for (let i = 0; i < files.length; i++) {
      const url = URL.createObjectURL(files[i]);
      const link = document.createElement("a");

      link.href = url;
      link.download = files[i].name || `dokumentasi-${i + 1}.jpg`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(caption);
    }

    const telegramURL =
      "https://t.me/share/url?url=&text=" +
      encodeURIComponent(caption);

    window.open(telegramURL, "_blank");

    alert(
      "Foto sudah diunduh dan keterangan disalin jika izin clipboard tersedia. Lampirkan foto di Telegram."
    );

  } catch (error) {
    if (error.name !== "AbortError") {
      alert("Tidak dapat membuka fitur berbagi: " + error.message);
    }
  }
}

function createPDFButton() {
  if ($("pdf-button")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "pdf-button";
  button.textContent = "Buat PDF A4";

  button.addEventListener("click", createPDF);

  const section = $("supporting-message")?.closest(".card")
    || $("telegram-button")?.closest(".card");

  if (section) {
    section.appendChild(button);
  }
}

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

  $("scan-button")?.addEventListener("click", scanReceipt);

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

  $("telegram-button")?.addEventListener(
    "click",
    sendToTelegram
  );

  createPDFButton();
  updateBBMFields();
  renderReceiptPreview();
  renderSupportingPreview();

  showMessage(
    "server-status",
    "Aplikasi siap digunakan."
  );
}

document.addEventListener("DOMContentLoaded", initializeApp);
