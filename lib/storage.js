const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

let inMemoryData = null;

async function readData() {
  if (process.env.VERCEL) {
    if (inMemoryData) return inMemoryData;
    return { payments: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return { payments: [] };
  }
}

async function writeData(data) {
  if (process.env.VERCEL) {
    inMemoryData = data;
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = { readData, writeData };
