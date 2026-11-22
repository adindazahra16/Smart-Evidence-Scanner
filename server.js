
require("dotenv").config();

const express = require("express");
const multer = require("multer");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite"
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("File harus berupa gambar."));
    }
    cb(null, true);
  }
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    message: "AI Smart Expense Evidence aktif."
  });
});

async function callGemini(apiKey, image, mimeType) {
  let lastError;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`Memproses dengan ${model}, percobaan ${attempt}`);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            signal: AbortSignal.timeout(60000),
            body: JSON.stringify({
              contents: [{
                role: "user",
                parts: [
                  {
                    text: `
Kamu adalah AI pembaca bukti transaksi operasional Finance.

ATURAN UTAMA:
1. Baca hanya gambar nota yang sedang dikirim.
2. Jangan menggunakan data nota sebelumnya.
3. Jangan mengarang atau menebak informasi.
4. Jika informasi tidak terlihat atau tidak dapat dipastikan, isi null.
5. Periksa seluruh bagian gambar, termasuk tulisan tangan.
6. Bedakan nama barang, jumlah, harga satuan, dan total.

ATURAN KATEGORI:
Pilih satu kategori yang paling sesuai:

BBM:
Untuk pembelian bahan bakar seperti Pertalite, Pertamax, Solar, Dexlite.

MAKAN:
Untuk pembelian makanan atau minuman.

MATERIAL:
Untuk pembelian barang, bahan, alat, atau perlengkapan pekerjaan.

PENGINAPAN:
Untuk biaya hotel atau tempat menginap.

TRANSPORTASI:
Untuk biaya perjalanan orang atau kendaraan,
seperti tiket perjalanan, taksi, atau angkutan.

PENGIRIMAN:
Untuk biaya pengiriman paket, dokumen, atau barang
melalui jasa ekspedisi atau kurir.
Contoh: Pos Indonesia, PosAja, JNE, J&T,
SiCepat, AnterAja, Ninja Xpress, dan layanan kurir lainnya.
Nota ongkos kirim paket harus masuk PENGIRIMAN,
bukan TRANSPORTASI.

LAINNYA:
Untuk transaksi yang tidak cocok dengan kategori di atas.

TIDAK DIKETAHUI:
Jika bukti tidak cukup untuk menentukan kategori.

ATURAN KILOMETER:
- Cari angka kilometer kendaraan di seluruh bagian nota.
- Periksa tulisan tangan dan tulisan cetak.
- Perhatikan tulisan KM atau kilometer.
- Jangan mengambil angka harga, nominal, liter,
  nomor transaksi, atau nomor plat sebagai kilometer.
- Jika ada satu angka kilometer yang jelas, masukkan angka itu.
- Jangan membedakan KM sebelum dan sesudah.
- Jika tidak ditemukan, isi null.
- Contoh tulisan 45730 dikembalikan sebagai "45730".

ATURAN PLAT:
- Ambil nomor polisi hanya jika benar-benar terlihat.
- Jangan menganggap nomor transaksi sebagai plat.
- Jika tidak terlihat, isi null.

ATURAN NOMINAL:
- Ambil total pembayaran atau total transaksi.
- Jangan tertukar dengan harga satuan atau biaya lainnya.
- Untuk nota pengiriman, periksa bagian total atau netto
  dan jangan otomatis mengambil angka berat paket sebagai nominal.

ATURAN TANGGAL:
- Ambil tanggal transaksi yang terlihat.
- Jangan menggunakan tanggal dari nota sebelumnya.

Kembalikan JSON valid saja dengan struktur:

{
  "tanggal": null,
  "nominal": null,
  "toko": null,
  "plat": null,
  "kategori": "TIDAK DIKETAHUI",
  "kegiatan": null,
  "keterangan": null,
  "jumlah_volume": null,
  "harga_satuan": null,
  "kilometer": null,
  "catatan": null
}

Jangan menambahkan penjelasan di luar JSON.
`
                  },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: image
                    }
                  }
                ]
              }],
              generationConfig: {
                temperature: 0,
                responseMimeType: "application/json",
                maxOutputTokens: 2000
              }
            })
          }
        );

        const result = await response.json();

        if (!response.ok) {
          const error = new Error(
            result.error?.message || "AI gagal membaca nota."
          );

          error.status = response.status;
          lastError = error;

          if ([400, 401, 403].includes(response.status)) {
            throw error;
          }

          if ([429, 500, 502, 503, 504].includes(response.status)) {
            if (attempt < 2) {
              await sleep(1000);
              continue;
            }
          }

          break;
        }

        const text = result.candidates?.[0]?.content?.parts
          ?.filter(part => typeof part.text === "string")
          ?.map(part => part.text)
          .join("")
          .trim();

        if (!text) {
          console.log("RESPONS AI:", JSON.stringify(result, null, 2));
          throw new Error("AI tidak memberikan hasil pembacaan.");
        }

        console.log("HASIL TEKS AI:", text);

        return { text, model };

      } catch (error) {
        lastError = error;

        if (error.status && [400, 401, 403].includes(error.status)) {
          throw error;
        }

        console.error("Gangguan AI:", error.message);

        if (attempt < 2) {
          await sleep(1000);
        }
      }
    }
  }

  throw lastError || new Error("Semua model AI gagal.");
}

app.post("/api/scan", upload.single("receipt"), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "API Key Gemini belum tersedia."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Foto nota belum diunggah."
      });
    }

    const image = req.file.buffer.toString("base64");

    const result = await callGemini(
      apiKey,
      image,
      req.file.mimetype
    );

    const start = result.text.indexOf("{");
    const end = result.text.lastIndexOf("}");

    if (start < 0 || end < start) {
      throw new Error("AI tidak menghasilkan format JSON yang benar.");
    }

    const data = JSON.parse(
      result.text.substring(start, end + 1)
    );

    const allowed = [
      "tanggal",
      "nominal",
      "toko",
      "plat",
      "kategori",
      "kegiatan",
      "keterangan",
      "jumlah_volume",
      "harga_satuan",
      "kilometer",
      "catatan"
    ];

    const cleanData = {};

    for (const key of allowed) {
      cleanData[key] =
        data[key] === undefined ? null : data[key];
    }

    const categories = [
      "BBM",
      "MAKAN",
      "MATERIAL",
      "PENGINAPAN",
      "TRANSPORTASI",
      "PENGIRIMAN",
      "LAINNYA",
      "TIDAK DIKETAHUI"
    ];

    if (!categories.includes(cleanData.kategori)) {
      cleanData.kategori = "TIDAK DIKETAHUI";
    }

    console.log("Scan selesai:", result.model);
    console.log("Kategori:", cleanData.kategori);
    console.log("Kilometer:", cleanData.kilometer);

    res.json({
      success: true,
      model: result.model,
      data: cleanData
    });

  } catch (error) {
    console.error("SCAN ERROR:", error);

    res.status(error.status || 500).json({
      success: false,
      message: error.name === "TimeoutError"
        ? "Waktu pemrosesan AI habis. Coba lagi."
        : error.message || "Gagal memproses nota."
    });
  }
});

app.use((error, req, res, next) => {
  res.status(400).json({
    success: false,
    message: error.message || "Terjadi kesalahan."
  });
});

app.listen(PORT, () => {
  console.log("------------------------------------");
  console.log("AI SMART EXPENSE EVIDENCE AKTIF");
  console.log(`Buka: http://localhost:${PORT}`);
  console.log("------------------------------------");
});
