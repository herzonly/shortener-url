const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const requestIP = require('request-ip'); // Tambahkan package ini untuk mendapatkan IP

const app = express();
const port = 3000;
const baseUrl = 'shortmyurl.us.kg';

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(requestIP.mw()); // Middleware untuk mendapatkan IP

// Helper function untuk read database
async function readDatabase() {
  try {
    const data = await fs.readFile('database.json', 'utf8');
    return JSON.parse(data || '{}');
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile('database.json', '{}');
      return {};
    }
    throw error;
  }
}

// Helper function untuk write database
async function writeDatabase(data) {
  await fs.writeFile('database.json', JSON.stringify(data, null, 2));
}

// Helper untuk validasi URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Route untuk membuat URL pendek
app.post('/shorten', async (req, res) => {
  try {
    const { url, name } = req.body;
    const clientIP = req.clientIp;

    // Validasi input
    if (!url || !name) {
      return res.status(400).json({
        success: false,
        message: 'URL dan nama tidak boleh kosong!',
        alertType: 'danger'
      });
    }

    // Validasi format URL
    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        message: 'Format URL tidak valid!',
        alertType: 'danger'
      });
    }

    // Validasi format nama (hanya alfanumerik dan dash)
    if (!/^[a-zA-Z0-9-]+$/.test(name)) {
      return res.status(400).json({
        success: false,
        message: 'Nama URL hanya boleh mengandung huruf, angka, dan dash (-)!',
        alertType: 'danger'
      });
    }

    const db = await readDatabase();

    // Cek apakah nama sudah digunakan
    if (db[name]) {
      return res.status(400).json({
        success: false,
        message: 'Nama URL pendek sudah digunakan! Silakan pilih nama lain.',
        alertType: 'danger'
      });
    }

    // Simpan data dengan struktur baru
    const timestamp = new Date().toISOString();
    db[name] = {
      name: name,
      web_target: url,
      web_url: `${baseUrl}/${name}`,
      created_at: timestamp,
      created_by_ip: clientIP,
      visits: 0,
      visit_history: [] // Array untuk menyimpan history kunjungan
    };

    await writeDatabase(db);

    res.json({
      success: true,
      message: 'URL pendek berhasil dibuat!',
      alertType: 'success',
      data: db[name]
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      alertType: 'danger'
    });
  }
});

// Route untuk redirect URL pendek
app.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const clientIP = req.clientIp;
    const db = await readDatabase();
    const urlData = db[name];

    if (!urlData) {
      return res.status(404).json({
        success: false,
        message: 'URL tidak ditemukan',
        alertType: 'danger'
      });
    }

    // Update statistik kunjungan
    const visitTimestamp = new Date().toISOString();
    db[name].visits += 1;
    db[name].visit_history.push({
      ip: clientIP,
      timestamp: visitTimestamp
    });

    await writeDatabase(db);
    res.redirect(urlData.web_target);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      alertType: 'danger'
    });
  }
});

// Route untuk mendapatkan statistik URL
app.get('/api/stats/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const db = await readDatabase();
    const urlData = db[name];

    if (!urlData) {
      return res.status(404).json({
        success: false,
        message: 'URL tidak ditemukan',
        alertType: 'danger'
      });
    }

    res.json({
      success: true,
      data: urlData
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      alertType: 'danger'
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
