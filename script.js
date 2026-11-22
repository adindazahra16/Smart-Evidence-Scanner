
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

function checkServer() {
  fetch(GAS_WEB_APP_URL)
    .then((response) => {
      if (!response.ok) throw new Error("Server tidak aktif");
      return response.text();
    })
    .then(() => showMessage("server-status", "Server aktif", "#16803c"))
    .catch(() => showMessage("server-status", "Server tidak terhubung", "#c62828"));
}

// ===============================
// PILIH FOTO
// ===============================

$("receipt-camera-button")?.addEventListener("click", () => receiptCamera?.click());
$("receipt-gallery-button")?.addEventListener("click", () => receiptGallery?.click());

$("supporting-camera-button")?.addEventListener("click", () => supportingCamera?.click());
$("supporting-gallery-button")?.addEventListener("click", () => supportingGallery?.click());

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

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Hapus";

    remove.addEventListener("click", () => {
      if (type === "receipt") {
        receiptFile = null;
        if (receiptCamera) receiptCamera.value = "";
        if (receiptGallery) receiptGallery.value = "";
        renderPreview([], receiptPreview, "receipt");
        showMessage("scan-message", "Foto nota dihapus.");
      } else {
        supportingFiles.splice(index, 1);
        renderPreview(supportingFiles, supportingPreview, "supporting");
        showMessage("supporting-message", supportingFiles.length + " foto pendukung dipilih.");
      }
    });

    wrapper.append(image, name, remove);
    container.appendChild(wrapper);
  });
}

function acceptReceipt(file) {
  if (!file || !file.type.startsWith("image/")) {
    showMessage("scan-message", "Pilih foto nota yang valid.", "#c62828");
    return;
  }

  receiptFile = file;
  renderPreview([file], receiptPreview, "receipt");
  showMessage("scan-message", "Foto nota berhasil dipilih.", "#16803c");
}

function acceptSupporting(files) {
  const valid = Array.from(files).filter((file) => file.type.startsWith("image/"));

  supportingFiles.push(...valid);
  renderPreview(supportingFiles, supportingPreview, "supporting");

  showMessage(
    "supporting-message",
    supportingFiles.length + " foto pendukung dipilih.",
    "#16803c"
  );
}

receiptCamera?.addEventListener("change", (e) => acceptReceipt(e.target.files[0]));
receiptGallery?.addEventListener("change", (e) => acceptReceipt(e.target.files[0]));

supportingCamera?.addEventListener("change", (e) => acceptSupporting(e.target.files));
supportingGallery?.addEventListener("change", (e) => acceptSupporting(e.target.files));

// ===============================
// KAMERA LANGSUNG
// ===============================

function createWebcamControls() {
  ["receipt", "supporting"].forEach((target) => {
    const container = $(target + "-webcam");

    if (!container || $("#" + target + "-direct-camera-button")) return;

    const button = document.createElement("button");
    button.id = target + "-direct-camera-button";
    button.type = "button";
    button.textContent = "Kamera Langsung";

    button.addEventListener("click", () => openWebcam(target));

    container.parentNode.insertBefore(button, container);
  });
}

async function openWebcam(target) {
  closeWebcam();

  const container = $(target + "-webcam");
  const video = $(target + "-video");

  if (!container || !video) {
    alert("Area kamera tidak ditemukan.");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    alert("Browser tidak mendukung kamera langsung. Gunakan tombol Buka Kamera.");
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    activeCameraTarget = target;
    video.srcObject = cameraStream;
    container.style.display = "block";
    await video.play();
  } catch (error) {
    console.error(error);
    alert("Kamera tidak dapat dibuka. Periksa izin kamera browser.");
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

  if (!video?.videoWidth) {
    alert("Kamera belum siap.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.getContext("2d").drawImage(video, 0, 0);

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

    if (target === "receipt") acceptReceipt(file);
    else acceptSupporting([file]);

    closeWebcam();
  }, "image/jpeg", 0.9);
}

$("receipt-take-photo")?.addEventListener("click", capturePhoto);
$("supporting-take-photo")?.addEventListener("click", capturePhoto);
$("receipt-close-camera")?.addEventListener("click", closeWebcam);
$("supporting-close-camera")?.addEventListener("click", closeWebcam);

// ===============================
// SCAN AI
// ===============================

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
      reject(new Error("Waktu pemeriksaan habis. Silakan coba lagi."));
    }, 90000);

    function cleanup() {
      clearTimeout(timeout);
      window.removeEventListener("message", receiveMessage);
      form.remove();
      iframe.remove();
    }

    function receiveMessage(event) {
      if (event.source !== iframe.contentWindow) return;

      let result = event.data;

      if (!result) return;

      try {
        if (typeof result === "string") result = JSON.parse(result);
        cleanup();
        resolve(result);
      } catch {
        // Abaikan pesan yang bukan hasil scan.
      }
    }

    window.addEventListener("message", receiveMessage);
    form.submit();
  });
}

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

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) return `${match[3]}/${match[2]}/${match[1]}`;

  return text;
}

function applyScanResult(response) {
  let data = response;

  if (data?.data) data = data.data;
  if (data?.result) data = data.result;

  if (typeof data === "string") {
    data = JSON.parse(data);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Hasil pemeriksaan kosong.");
  }

  setField("tanggal", normalizeDate(data.tanggal || data.date));
  setField("nominal", data.nominal || data.amount);
  setField("vendor", data.vendor || data.toko || data.merchant);
  setField("kategori", String(data.kategori || data.category || "TIDAK DIKETAHUI").toUpperCase());
  setField("kegiatan", data.kegiatan || data.activity);
  setField("volume", data.volume || data.jumlah_volume);
  setField("harga_satuan", data.harga_satuan || data.unit_price);
  setField("plat", data.plat || data.nomor_polisi || data.plate);
  setField("kilometer", data.kilometer || data.km);
  setField("keterangan", data.keterangan || data.catatan || data.notes);

  updateBBM();
}

$("scan-button")?.addEventListener("click", async () => {
  if (!receiptFile) {
    showMessage("scan-message", "Pilih foto nota terlebih dahulu.", "#c62828");
    return;
  }

  const button = $("scan-button");
  button.disabled = true;
  button.textContent = "AI sedang memeriksa nota...";

  showMessage("scan-message", "Sedang memproses foto nota...");

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
      "Pemeriksaan selesai. Periksa kembali hasilnya.",
      "#16803c"
    );
  } catch (error) {
    console.error(error);
    showMessage("scan-message", error.message || "Gagal memeriksa nota.", "#c62828");
  } finally {
    button.disabled = false;
    button.textContent = "Periksa Nota dengan AI";
  }
});

// ===============================
// KATEGORI BBM
// ===============================

function updateBBM() {
  const category = $("kategori");
  const fields = $("bbm-fields");

  if (!category || !fields) return;

  fields.style.display = category.value.toUpperCase() === "BBM" ? "block" : "none";
}

$("kategori")?.addEventListener("change", updateBBM);

// ===============================
// PEMBUATAN PDF SATU HALAMAN
// ===============================

function getActivity() {
  return $("kegiatan")?.value?.trim() ||
    $("keterangan")?.value?.trim() ||
    "Keterangan kegiatan belum diisi.";
}

function imageToJpeg(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxWidth = 1800;
        const scale = Math.min(1, maxWidth / image.width);

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        canvas.getContext("2d").drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );

        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      image.onerror = reject;
      image.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function addContainedImage(doc, data, x, y, boxWidth, boxHeight) {
  const properties = doc.getImageProperties(data);

  const ratio = Math.min(
    boxWidth / properties.width,
    boxHeight / properties.height
  );

  const width = properties.width * ratio;
  const height = properties.height * ratio;

  const imageX = x + (boxWidth - width) / 2;
  const imageY = y + (boxHeight - height) / 2;

  doc.addImage(data, "JPEG", imageX, imageY, width, height);
}

async function createPDF() {
  if (!receiptFile) {
    alert("Foto nota wajib dipilih terlebih dahulu.");
    return;
  }

  if (!window.jspdf?.jsPDF) {
    alert("Fitur PDF belum siap. Periksa pustaka PDF pada index.html.");
    return;
  }

  const button = $("pdf-button");
  button.disabled = true;
  button.textContent = "Membuat PDF...";

  try {
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true
    });

    const pageWidth = 210;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    // HEADER
    doc.setFillColor(190, 0, 0);
    doc.rect(0, 0, pageWidth, 27, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("TELKOM AKSES", pageWidth / 2, 12, { align: "center" });

    doc.setFontSize(10);
    doc.text("BUKTI PENGELUARAN", pageWidth / 2, 20, { align: "center" });

    // FOTO NOTA
    doc.setTextColor(35, 35, 35);
    doc.setFontSize(11);
    doc.text("FOTO NOTA", margin, 35);

    const receiptImage = await imageToJpeg(receiptFile);

    doc.setDrawColor(190, 0, 0);
    doc.roundedRect(margin, 39, contentWidth, 105, 2, 2);

    addContainedImage(
      doc,
      receiptImage,
      margin + 3,
      42,
      contentWidth - 6,
      99
    );

    // FOTO KEGIATAN
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("FOTO KEGIATAN", margin, 153);

    // Maksimal 4 foto pendukung agar satu halaman.
    const selectedPhotos = supportingFiles.slice(0, 4);
    const photoData = await Promise.all(
      selectedPhotos.map((file) => imageToJpeg(file))
    );

    if (photoData.length === 1) {
      doc.setDrawColor(190, 0, 0);
      doc.roundedRect(margin, 157, contentWidth, 57, 2, 2);

      addContainedImage(
        doc,
        photoData[0],
        margin + 3,
        160,
        contentWidth - 6,
        51
      );
    } else if (photoData.length > 1) {
      const gap = 5;
      const boxWidth = (contentWidth - gap) / 2;
      const boxHeight = 43;

      photoData.forEach((data, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);

        const x = margin + column * (boxWidth + gap);
        const y = 157 + row * (boxHeight + gap);

        doc.setDrawColor(190, 0, 0);
        doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2);

        addContainedImage(
          doc,
          data,
          x + 2,
          y + 2,
          boxWidth - 4,
          boxHeight - 4
        );
      });
    } else {
      doc.setDrawColor(190, 0, 0);
      doc.roundedRect(margin, 157, contentWidth, 45, 2, 2);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(
        "Tidak ada foto kegiatan yang dilampirkan.",
        pageWidth / 2,
        181,
        { align: "center" }
      );
    }

    // KETERANGAN KEGIATAN
    const activityY = photoData.length > 2 ? 263 :
      photoData.length === 2 ? 212 :
      photoData.length === 1 ? 222 : 211;

    doc.setTextColor(35, 35, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("KETERANGAN KEGIATAN", margin, activityY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const lines = doc.splitTextToSize(getActivity(), contentWidth);
    doc.text(lines.slice(0, 3), margin, activityY + 7);

    // FOOTER
    doc.setDrawColor(190, 0, 0);
    doc.line(margin, 282, pageWidth - margin, 282);

    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(
      "AI SMART EXPENSE EVIDENCE - TELKOM AKSES",
      pageWidth / 2,
      288,
      { align: "center" }
    );

    const date = new Date().toISOString().slice(0, 10);
    doc.save("Bukti-Pengeluaran-" + date + ".pdf");

    showMessage("scan-message", "PDF berhasil dibuat dan diunduh.", "#16803c");

    if (supportingFiles.length > 4) {
      alert("PDF tetap satu halaman. " + (supportingFiles.length - 4) +
        " foto pendukung tidak dimasukkan karena batas ruang.");
    }
  } catch (error) {
    console.error(error);
    alert("Gagal membuat PDF: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Buat PDF";
  }
}

// BUAT TOMBOL PDF OTOMATIS
function createPDFButton() {
  if ($("pdf-button")) return;

  const button = document.createElement("button");
  button.id = "pdf-button";
  button.type = "button";
  button.textContent = "Buat PDF";
  button.style.background = "#C00000";
  button.style.color = "#ffffff";
  button.style.border = "none";
  button.style.padding = "12px 20px";
  button.style.borderRadius = "8px";
  button.style.fontWeight = "bold";
  button.style.cursor = "pointer";
  button.style.margin = "10px 5px";

  button.addEventListener("click", createPDF);

  const telegramButton = $("telegram-button");

  if (telegramButton?.parentNode) {
    telegramButton.parentNode.insertBefore(button, telegramButton);
  } else {
    document.body.appendChild(button);
  }
}

// ===============================
// TELEGRAM
// ===============================

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
    "Keterangan: " + value("keterangan")
  ].join("\n");
}

async function shareToTelegram() {
  if (!receiptFile) {
    alert("Foto nota belum dipilih.");
    return;
  }

  const files = [receiptFile, ...supportingFiles];
  const caption = createTelegramCaption();

  try {
    if (navigator.share && navigator.canShare &&
        navigator.canShare({ files })) {
      await navigator.share({
        title: "AI Smart Expense Evidence",
        text: caption,
        files
      });
      return;
    }

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

    alert("Foto diunduh dan caption disalin. Silakan lampirkan foto di Telegram.");
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error(error);
    alert("Gagal membagikan file.");
  }
}

$("telegram-button")?.addEventListener("click", shareToTelegram);

// ===============================
// MULAI APLIKASI
// ===============================

createWebcamControls();
createPDFButton();
checkServer();
updateBBM();
