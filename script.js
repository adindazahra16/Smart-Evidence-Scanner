
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

// BAGIKAN KE TELEGRAM
telegramButton.addEventListener("click", async () => {
  if (!receiptFile) {
    alert("Foto nota belum tersedia.");
    return;
  }

  if ($("kategori").value === "BBM") {
    const plat = $("plat").value.trim();
    const kilometer = $("kilometer").value.trim();

    if (!plat || !kilometer) {
      $("bbm-message").textContent =
        "Lengkapi nomor plat dan kilometer kendaraan.";

      $("bbm-fields").hidden = false;
      alert("Data wajib BBM belum lengkap.");
      return;
    }
  }

  const caption = createCaption();
  $("telegram-caption").value = caption;

  const files = [receiptFile, ...supportingFiles];

  try {
    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files })
    ) {
      await navigator.share({
        title: "Bukti Transaksi Operasional",
        text: caption,
        files
      });

      return;
    }

    await navigator.clipboard.writeText(caption);

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
      "Caption disalin dan semua foto diunduh. " +
      "Lampirkan foto secara manual di Telegram."
    );

  } catch (error) {
    if (error.name !== "AbortError") {
      alert("Gagal menyiapkan Telegram: " + error.message);
    }
  }
});

// HENTIKAN KAMERA JIKA HALAMAN DITUTUP
window.addEventListener("beforeunload", stopCamera);

checkServer();
