const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

async function readData() {
  if (process.env.VERCEL) {
    const { list, get } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: 'data.json' });
    if (blobs.length === 0) return { payments: [] };
    const blob = await get(blobs[0].url);
    return JSON.parse(await blob.text());
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return { payments: [] };
  }
}

async function writeData(data) {
  if (process.env.VERCEL) {
    const { put } = await import('@vercel/blob');
    await put('data.json', JSON.stringify(data, null, 2), {
      contentType: 'application/json',
      access: 'public'
    });
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = { readData, writeData };
