// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// 1. Inisialisasi Supabase (Ganti URL & KEY dengan punya Anda)
const SUPABASE_URL = 'https://qbtfegmcfkfilgpbydze.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cw6oYOH3pEBgS_4gdeQE8Q_C6bnox0F';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Setup Kamera Scan Barcode
let currentBarcode = '';

function onScanSuccess(decodedText) {
  currentBarcode = decodedText;
  document.getElementById('barcode-result').value = decodedText;
  document.getElementById('opname-barcode').value = decodedText;
}

let html5QrcodeScanner = new Html5QrcodeScanner(
  "reader", { fps: 10, qrbox: { width: 250, height: 150 } }
);
html5QrcodeScanner.render(onScanSuccess);

// 3. Logika Barang Masuk / Keluar
async function prosesStok(tipe) {
  const qty = parseInt(document.getElementById('qty-input').value);
  if (!currentBarcode) return alert("Scan barcode barang terlebih dahulu!");

  // Cari barang di database
  let { data: barang } = await db.from('barang').select('*').eq('kode_barcode', currentBarcode).single();

  if (!barang) {
    alert("Barang belum terdaftar di database!");
    return;
  }

  // Hitung stok baru
  let stokBaru = tipe === 'masuk' ? barang.stok_sistem + qty : barang.stok_sistem - qty;

  // Update stok di database
  await db.from('barang').update({ stok_sistem: stokBaru }).eq('id', barang.id);
  // Catat riwayat transaksi
  await db.from('transaksi').insert([{ barang_id: barang.id, tipe: tipe, jumlah: qty }]);

  alert(`Berhasil! Stok ${barang.nama_barang} saat ini: ${stokBaru}`);
}

// 4. Logika Stock Opname
async function simpanOpname() {
  const stokFisik = parseInt(document.getElementById('opname-fisik').value);
  if (!currentBarcode || isNaN(stokFisik)) return alert("Lengkapi scan barcode & angka fisik!");

  let { data: barang } = await db.from('barang').select('*').eq('kode_barcode', currentBarcode).single();

  if (barang) {
    let selisih = stokFisik - barang.stok_sistem;
    await db.from('stock_opname').insert([{
      barang_id: barang.id,
      stok_sistem: barang.stok_sistem,
      stok_fisik: stokFisik,
      selisih: selisih
    }]);
    alert(`Opname Tersimpan! Selisih stok: ${selisih}`);
  }
}

// 5. Logika Jadwal Barang Datang
async function tambahJadwal() {
  const tgl = document.getElementById('jadwal-tanggal').value;
  const supplier = document.getElementById('jadwal-supplier').value;
  const nmBarang = document.getElementById('jadwal-barang').value;
  const qty = parseInt(document.getElementById('jadwal-qty').value);

  await db.from('jadwal_inbound').insert([{
    tanggal_rencana: tgl,
    supplier: supplier,
    nama_barang: nmBarang,
    jumlah_rencana: qty,
    status: 'Pending'
  }]);

  alert("Jadwal kedatangan berhasil disimpan!");
  muatJadwal();
}

async function muatJadwal() {
  let { data: jadwal } = await db.from('jadwal_inbound').select('*').order('tanggal_rencana', { ascending: true });
  let html = '';
  jadwal.forEach(j => {
    html += `<div class="p-2 border rounded bg-gray-50">
      <b>${j.tanggal_rencana}</b> - ${j.supplier}<br>
      ${j.nama_barang} (${j.jumlah_rencana} pcs) - <span class="text-blue-600">${j.status}</span>
    </div>`;
  });
  document.getElementById('list-jadwal').innerHTML = html;
}

// Fitur Perpindahan Tab Tampilan
function switchTab(tab) {
  document.getElementById('tab-scan').classList.add('hidden');
  document.getElementById('tab-opname').classList.add('hidden');
  document.getElementById('tab-jadwal').classList.add('hidden');
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  if(tab === 'jadwal') muatJadwal();
}