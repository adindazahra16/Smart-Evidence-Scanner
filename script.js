const $ = id => document.getElementById(id);

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

function showMessage(id, message, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.style.color = error ? "#c62828" : "#16803c";
}

function previewImage(file, container, onRemove) {
  const wrapper = document.createElement("div");
  wrapper.className = "preview-item";

  const image = document.createElement("img");
  image.src = URL.createObjectURL(file);
  image.alt = "Foto bukti pengeluaran";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Hapus";
  remove.addEventListener("click", () => {
    URL.revokeObjectURL(image.src);
    wrapper.remove();
    onRemove();
  });

  wrapper.append(image, remove);
  container.appendChild(wrapper);
}

function setReceipt(file) {
  if (!file || !file.type.startsWith("image/")) return;

  receiptFile = file;
  $("receipt-preview").innerHTML = "";

  previewImage(file, $("receipt-preview"), () => {
    receiptFile = null;
  });

  showMessage("scan-message", "Foto nota berhasil dipilih.");
}

function addSupportingFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;

    supportingFiles.push(file);

    previewImage(file, $("supporting-preview"), () => {
      supportingFiles = supportingFiles.filter(item => item !== file);
    });
  }

  showMessage(
    "supporting-message",
    supportingFiles.length
      ? supportingFiles.length + " foto pendukung dipilih."
      : "Belum ada foto pendukung."
  );
}

receiptCamera.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) setReceipt(file);
  event.target.value = "";
});

receiptGallery.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) setReceipt(file);
  event.target.value = "";
});

supportingCamera.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) addSupportingFiles([file]);
  event.target.value = "";
});

supportingGallery.addEventListener("change", event => {
  if (event.target.files.length) {
    addSupportingFiles(Array.from(event.target.files));
  }
  event.target.value = "";
});

$("receipt-camera-button").addEventListener("click", () => {
  receiptCamera.click();
});

$("receipt-gallery-button").addEventListener("click", () => {
  receiptGallery.click();
});

$("supporting-camera-button").addEventListener("click", () => {
  supportingCamera.click();
});

$("supporting-gallery-button").addEventListener("click", () => {
  supportingGallery.click();
});

// Kamera langsung untuk laptop dan HP
async function openWebcam(target) {
  closeWebcam();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage(
      target === "receipt" ? "scan-message" : "supporting-message",
      "Kamera tidak didukung. Gunakan pilihan galeri atau kamera perangkat.",
      true
    );
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    activeCameraTarget = target;

    let container;
    let video;
    let captureButton;
    let closeButton;

    if (target === "receipt") {
      container = $("receipt-webcam");
      video = $("receipt-video");
      captureButton = $("receipt-take-photo");
      closeButton = $("receipt-close-camera");
    } else {
      container = $("supporting-webcam");

      if (!container) {
        container = document.createElement("div");
        container.id = "supporting-webcam";
        $("supporting-preview").before(container);

        video = document.createElement("video");
        video.id = "supporting-video";
        video.autoplay = true;
        video.playsInline = true;

        captureButton = document.createElement("button");
        captureButton.type = "button";
        captureButton.textContent = "Ambil Foto";

        closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.textContent = "Tutup Kamera";

        const controls = document.createElement("div");
        controls.className = "button-group";
        controls.append(captureButton, closeButton);
        container.append(video, controls);
      } else {
        video = $("supporting-video");
        captureButton = container.querySelector("button:first-of-type");
        closeButton = container.querySelector("button:last-of-type");
      }
    }

    video.srcObject = cameraStream;
    container.hidden = false;

    captureButton.onclick = () => capturePhoto(video, target);
    closeButton.onclick = closeWebcam;

    await video.play();

  } catch (error) {
    closeWebcam();

    showMessage(
      target === "receipt" ? "scan-message" : "supporting-message",
      "Kamera tidak dapat dibuka. Izinkan akses kamera pada browser.",
      true
    );
  }
}

function closeWebcam() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  $("receipt-webcam").hidden = true;

  const supportingWebcam = $("supporting-webcam");
  if (supportingWebcam) supportingWebcam.hidden = true;

  activeCameraTarget = null;
}

function capturePhoto(video, target) {
  if (!video.videoWidth || !video.videoHeight) {
    showMessage("scan-message", "Kamera belum siap. Coba lagi.", true);
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0);

  canvas.toBlob(blob => {
    if (!blob) return;

    const file = new File(
      [blob],
      "foto-" + Date.now() + ".jpg",
      { type: "image/jpeg" }
    );

    if (target === "receipt") {
      setReceipt(file);
    } else {
      addSupportingFiles([file]);
    }

    closeWebcam();
  }, "image/jpeg", 0.9);
}

$("receipt-camera-button").addEventListener("dblclick", () => {
  openWebcam("receipt");
});

// Gunakan kamera langsung melalui tombol khusus tambahan.
function addDirectCameraButtons() {
  const receiptButton = document.createElement("button");
  receiptButton.type = "button";
  receiptButton.textContent = "Kamera Langsung";
  receiptButton.addEventListener("click", () => openWebcam("receipt"));

  $("receipt-webcam").before(receiptButton);

  const supportingButton = document.createElement("button");
  supportingButton.type = "button";
  supportingButton.textContent = "Kamera Langsung";
  supportingButton.addEventListener("click", () => openWebcam("supporting"));

  $("supporting-preview").before(supportingButton);
}

addDirectCameraButtons();

// Kompres foto agar pengiriman ke AI lebih ringan.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectURL = URL.createObjectURL(file);

    image.onload = () => {
      const maxSize = 1800;
      const ratio = Math.min(
        1,
        maxSize / Math.max(image.width, image.height)
      );

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * ratio);
      canvas.height = Math.round(image.height * ratio);

      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        URL.revokeObjectURL(objectURL);

        if (!blob) {
          reject(new Error("Gagal memproses foto."));
          return;
        }

        const reader = new FileReader();

        reader.onload = () => {
          resolve({
            mimeType: "image/jpeg",
            base64: reader.result.split(",")[1]
          });
        };

        reader.onerror = () => reject(new Error("Gagal membaca foto."));
        reader.readAsDataURL(blob);
      }, "image/jpeg", 0.82);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error("Foto tidak dapat dibaca."));
    };

    image.src = objectURL;
  });
}

// Mengirim data ke Google Apps Script melalui iframe.
function callAppsScript(payload) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.name = "gas-response-" + Date.now();
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

    let finished = false;

    const cleanup = () => {
      window.removeEventListener("message", receiveMessage);
      form.remove();
      iframe.remove();
    };

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error("Waktu koneksi habis. Coba lagi."));
    }, 120000);

    function receiveMessage(event) {
      if (event.source !== iframe.contentWindow) return;

      const result = event.data;

      if (!result || typeof result.success !== "boolean") return;

      finished = true;
      clearTimeout(timer);
      cleanup();

      if (result.success) {
        resolve(result.data);
      } else {
        reject(new Error(result.error || "Gagal membaca nota."));
      }
    }

    window.addEventListener("message", receiveMessage);

    form.submit();
  });
}

function fillResult(data) {
  $("tanggal").value = data.tanggal || "";
  $("nominal").value = data.nominal || "";
  $("vendor").value = data.vendor || "";
  $("kategori").value = data.kategori || "";
  $("kegiatan").value = data.kegiatan || "";
  $("volume").value = data.volume || "";
  $("harga_satuan").value = data.harga_satuan || "";
  $("plat").value = data.plat || "";
  $("kilometer").value = data.kilometer || "";
  $("keterangan").value = data.keterangan || "";

  updateBBM();
}

function updateBBM() {
  const isBBM = $("kategori").value === "BBM";
  $("bbm-fields").hidden = !isBBM;

  if (isBBM) {
    $("bbm-message").textContent =
      "Pastikan nomor polisi dan kilometer sudah sesuai dengan nota.";
  }
}

$("kategori").addEventListener("change", updateBBM);

// Proses scan nota.
$("scan-button").addEventListener("click", async () => {
  if (!receiptFile) {
    showMessage("scan-message", "Pilih atau foto nota terlebih dahulu.", true);
    return;
  }

  const button = $("scan-button");
  button.disabled = true;
  button.textContent = "AI sedang membaca nota...";

  showMessage("scan-message", "Sedang memproses foto nota...");

  try {
    const image = await compressImage(receiptFile);

    const result = await callAppsScript({
      image: image.base64,
      mimeType: image.mimeType
    });

    fillResult(result);

    showMessage(
      "scan-message",
      "Nota berhasil dibaca. Periksa kembali hasilnya sebelum diteruskan."
    );

  } catch (error) {
    showMessage("scan-message", error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Periksa Nota dengan AI";
  }
});

// Membuat caption dari hasil pembacaan nota.
function makeCaption() {
  return [
    "BUKTI PENGELUARAN - TELKOM AKSES",
    "",
    "Tanggal: " + $("tanggal").value,
    "Nominal: " + $("nominal").value,
    "Vendor: " + $("vendor").value,
    "Kategori: " + $("kategori").value,
    "Kegiatan: " + $("kegiatan").value,
    "Volume: " + $("volume").value,
    "Harga Satuan: " + $("harga_satuan").value,
    "Nomor Polisi: " + $("plat").value,
    "Kilometer: " + $("kilometer").value,
    "Keterangan: " + $("keterangan").value
  ].join("\n");
}

// Teruskan foto dan data ke Telegram melalui menu berbagi perangkat.
$("telegram-button").addEventListener("click", async () => {
  if (!receiptFile) {
    showMessage("supporting-message", "Foto nota belum dipilih.", true);
    return;
  }

  const button = $("telegram-button");
  button.disabled = true;
  button.textContent = "Menyiapkan foto...";

  const files = [receiptFile, ...supportingFiles];
  const caption =
    $("telegram-caption").value.trim() || makeCaption();

  try {
    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files })
    ) {
      await navigator.share({
        title: "Bukti Pengeluaran Telkom Akses",
        text: caption,
        files
      });

      showMessage(
        "supporting-message",
        "Menu berbagi berhasil dibuka. Pilih Telegram jika tersedia."
      );
    } else {
      for (let i = 0; i < files.length; i++) {
        const link = document.createElement("a");
        const url = URL.createObjectURL(files[i]);

        link.href = url;
        link.download = files[i].name || "bukti-pengeluaran.jpg";
        link.click();

        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }

      try {
        await navigator.clipboard.writeText(caption);
      } catch (error) {
        $("telegram-caption").value = caption;
      }

      window.open("https://web.telegram.org/", "_blank");

      showMessage(
        "supporting-message",
        "Foto diunduh dan caption disalin jika izin clipboard tersedia. Lampirkan foto di Telegram."
      );
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      showMessage("supporting-message", error.message, true);
    }
  } finally {
    button.disabled = false;
    button.textContent = "Teruskan Foto dan Data";
  }
});

function checkServer() {
  $("server-status").textContent =
    "Backend Google Apps Script: " + GAS_WEB_APP_URL;
}

checkServer();
updateBBM();
const $ = id => document.getElementById(id);

let receiptFile = null;
let supportingFiles = [];
let cameraStream = null;
let activeCameraTarget = null;

const cameraInput = $("receipt-camera");
const galleryInput = $("receipt-gallery");
const supportingCamera = $("supporting-camera");
const supportingGallery = $("supporting-gallery");

const scanButton = $("scan-button");
const telegramButton = $("telegram-button");

// MEMBUAT TAMPILAN WEBCAM FOTO PENDUKUNG
function createSupportingWebcam() {
  if ($("supporting-webcam")) return;

  const container = document.createElement("div");
  container.id = "supporting-webcam";
  container.style.display = "none";
  container.style.marginTop = "15px";

  container.innerHTML = `
    <video id="supporting-video" autoplay playsinline
      style="width:100%;max-width:400px;border-radius:10px;">
    </video>
    <br>
    <button type="button" id="supporting-take-photo">
      Jepret Foto
    </button>
    <button type="button" id="supporting-close-camera">
      Tutup Kamera
    </button>
  `;

  $("supporting-preview").after(container);

  $("supporting-take-photo").addEventListener("click", capturePhoto);
  $("supporting-close-camera").addEventListener("click", stopCamera);
}

createSupportingWebcam();

// MENGHENTIKAN KAMERA
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if ($("receipt-video")) {
    $("receipt-video").srcObject = null;
  }

  if ($("supporting-video")) {
    $("supporting-video").srcObject = null;
  }

  $("receipt-webcam").style.display = "none";
  $("supporting-webcam").style.display = "none";

  activeCameraTarget = null;
}

// MEMBUKA WEBCAM
async function startCamera(target) {
  try {
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        "Browser tidak mendukung kamera. Buka aplikasi melalui http://localhost:3000."
      );
    }

    const webcamContainer = target === "receipt"
      ? $("receipt-webcam")
      : $("supporting-webcam");

    const video = target === "receipt"
      ? $("receipt-video")
      : $("supporting-video");

    webcamContainer.style.display = "block";
    activeCameraTarget = target;

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = cameraStream;
    await video.play();

  } catch (error) {
    stopCamera();

    alert(
      "Kamera tidak bisa dibuka: " +
      error.message +
      "\n\nPastikan izin kamera di Chrome sudah diizinkan."
    );
  }
}

// MENGAMBIL FOTO DARI WEBCAM
async function capturePhoto() {
  const target = activeCameraTarget;

  if (!target || !cameraStream) {
    alert("Kamera belum aktif.");
    return;
  }

  const video = target === "receipt"
    ? $("receipt-video")
    : $("supporting-video");

  if (!video.videoWidth || !video.videoHeight) {
    alert("Kamera sedang disiapkan. Coba lagi sebentar.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    if (!blob) {
      alert("Gagal mengambil foto.");
      return;
    }

    const photo = new File(
      [blob],
      "Foto-Kamera-" + Date.now() + ".jpg",
      { type: "image/jpeg" }
    );

    if (target === "receipt") {
      setReceipt(photo);
      $("scan-message").textContent =
        "Foto nota berhasil diambil dari kamera.";
    } else {
      addSupportingPhotos([photo]);
    }

    stopCamera();
  }, "image/jpeg", 0.92);
}

// TOMBOL KAMERA DAN GALERI NOTA
$("receipt-camera-button").addEventListener("click", () => {
  startCamera("receipt");
});

$("receipt-gallery-button").addEventListener("click", () => {
  galleryInput.click();
});

// TOMBOL KAMERA DAN GALERI FOTO PENDUKUNG
$("supporting-camera-button").addEventListener("click", () => {
  startCamera("supporting");
});

$("supporting-gallery-button").addEventListener("click", () => {
  supportingGallery.click();
});

// TOMBOL WEBCAM NOTA
$("receipt-take-photo").addEventListener("click", capturePhoto);
$("receipt-close-camera").addEventListener("click", stopCamera);

// DAFTAR DATA FORMULIR
const fields = [
  "tanggal",
  "nominal",
  "toko",
  "plat",
  "kategori",
  "jumlah_volume",
  "harga_satuan",
  "kegiatan",
  "keterangan",
  "catatan",
  "kilometer"
];

// MEMBERSIHKAN HASIL LAMA
function clearResults() {
  fields.forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });

  $("telegram-caption").value = "";
  $("bbm-message").textContent = "";
  $("bbm-fields").hidden = true;
}

// MENAMPILKAN FOTO NOTA
function setReceipt(file) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    $("scan-message").textContent = "File harus berupa gambar.";
    return;
  }

  receiptFile = file;
  clearResults();

  $("receipt-preview").innerHTML = "";

  const image = document.createElement("img");
  image.src = URL.createObjectURL(file);
  image.alt = "Pratinjau nota";
  image.style.maxWidth = "100%";

  $("receipt-preview").appendChild(image);

  $("scan-message").textContent = "Foto nota siap diproses.";
}

// GALERI NOTA
galleryInput.addEventListener("change", () => {
  setReceipt(galleryInput.files[0]);
  galleryInput.value = "";
});

// MENAMPILKAN FOTO PENDUKUNG
function renderSupportingPhotos() {
  const preview = $("supporting-preview");
  preview.innerHTML = "";

  supportingFiles.forEach((file, index) => {
    const wrapper = document.createElement("div");
    wrapper.style.display = "inline-block";
    wrapper.style.margin = "6px";
    wrapper.style.verticalAlign = "top";

    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = "Foto pendukung";
    image.style.width = "110px";
    image.style.height = "110px";
    image.style.objectFit = "cover";
    image.style.display = "block";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Hapus foto";
    removeButton.style.marginTop = "5px";

    removeButton.addEventListener("click", () => {
      supportingFiles.splice(index, 1);
      renderSupportingPhotos();
    });

    wrapper.appendChild(image);
    wrapper.appendChild(removeButton);
    preview.appendChild(wrapper);
  });

  $("supporting-message").textContent =
    supportingFiles.length + " foto pendukung ditambahkan.";
}

// MENAMBAHKAN FOTO PENDUKUNG
function addSupportingPhotos(files) {
  const newFiles = Array.from(files || [])
    .filter(file => file.type.startsWith("image/"));

  supportingFiles.push(...newFiles);
  renderSupportingPhotos();
}

// GALERI FOTO PENDUKUNG
supportingGallery.addEventListener("change", () => {
  addSupportingPhotos(supportingGallery.files);
  supportingGallery.value = "";
});

// STATUS SERVER
async function checkServer() {
  try {
    const response = await fetch("/api/status");
    const result = await response.json();

    $("server-status").textContent = result.success
      ? "Server terhubung"
      : "Server bermasalah";
  } catch {
    $("server-status").textContent = "Server tidak terhubung";
  }
}

// MEMASUKKAN HASIL AI KE FORMULIR
function fillForm(data) {
  fields.forEach(id => {
    const el = $(id);
    if (!el) return;

    const value = data[id];

    el.value =
      value === null || value === undefined
        ? ""
        : String(value);
  });

  updateBBM();
}

// BAGIAN BBM
function updateBBM() {
  const isBBM = $("kategori").value === "BBM";

  $("bbm-fields").hidden = !isBBM;

  if (!isBBM) {
    $("kilometer").value = "";
    $("bbm-message").textContent = "";
  }
}

$("kategori").addEventListener("change", updateBBM);

// SCAN NOTA
scanButton.addEventListener("click", async () => {
  if (!receiptFile) {
    $("scan-message").textContent =
      "Ambil foto atau pilih nota terlebih dahulu.";
    return;
  }

  clearResults();

  const formData = new FormData();
  formData.append("receipt", receiptFile);

  scanButton.disabled = true;
  scanButton.textContent = "AI sedang membaca nota...";
  $("scan-message").textContent = "AI sedang memeriksa foto nota.";

  try {
    const response = await fetch("/api/scan", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Gagal membaca nota.");
    }

    fillForm(result.data);

    $("scan-message").textContent =
      "Pembacaan selesai. Periksa kembali hasil AI.";

  } catch (error) {
    $("scan-message").textContent =
      "Gagal membaca nota: " + error.message;

  } finally {
    scanButton.disabled = false;
    scanButton.textContent = "Scan Nota dengan AI";
  }
});

// MEMBUAT CAPTION
function createCaption() {
  const value = id =>
    $(id).value.trim() || "Belum diisi";

  const isBBM = $("kategori").value === "BBM";

  let catatan = $("catatan").value.trim();

  if (isBBM) {
    const kilometer = $("kilometer").value.trim();

    const catatanKM =
      "Kilometer Kendaraan: " +
      (kilometer || "Belum diisi");

    catatan = catatan
      ? catatan + "\n" + catatanKM
      : catatanKM;
  }

  return `BUKTI TRANSAKSI OPERASIONAL

Tanggal: ${value("tanggal")}
Nominal: Rp ${value("nominal")}
Toko/Vendor: ${value("toko")}
Nomor Plat: ${value("plat")}

Kategori: ${value("kategori")}
Kegiatan: ${value("kegiatan")}

Jumlah/Volume: ${value("jumlah_volume")}
Harga Satuan: ${value("harga_satuan")}

Keterangan: ${value("keterangan")}
Catatan: ${catatan || "Belum diisi"}

AI Smart Expense Evidence`;
}


// BAGIKAN FOTO DAN CAPTION
telegramButton.addEventListener("click", async () => {
  if (!receiptFile) {
    alert("Foto nota belum tersedia.");
    return;
  }

  if ($("kategori").value === "BBM") {
    if (!$("plat").value.trim() || !$("kilometer").value.trim()) {
      $("bbm-fields").hidden = false;
      $("bbm-message").textContent =
        "Lengkapi nomor plat dan kilometer kendaraan.";
      alert("Data wajib BBM belum lengkap.");
      return;
    }
  }

  const caption = createCaption();
  $("telegram-caption").value = caption;

  const files = [receiptFile, ...supportingFiles];

  if (
    navigator.share &&
    navigator.canShare &&
    navigator.canShare({ files })
  ) {
    try {
      await navigator.share({
        title: "Bukti Transaksi Operasional",
        text: caption,
        files: files
      });

      return;
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Share gagal:", error);
    }
  }

  // CADANGAN JIKA FITUR BERBAGI FILE TIDAK DIDUKUNG
  try {
    await navigator.clipboard.writeText(caption);
  } catch (error) {
    $("telegram-caption").focus();
    $("telegram-caption").select();
  }

  files.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      (index === 0 ? "Nota-Utama-" : "Foto-Pendukung-") +
      file.name;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 30000);
  });

  window.open(
    "https://t.me/share/url?url=&text=" +
    encodeURIComponent(caption),
    "_blank"
  );

  alert(
    "Foto sudah diunduh dan caption disiapkan. " +
    "Lampirkan foto di Telegram jika menu berbagi file tidak tersedia."
  );
});

// HENTIKAN KAMERA JIKA HALAMAN DITUTUP
window.addEventListener("beforeunload", stopCamera);

checkServer();
