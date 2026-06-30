const fs = require('fs');
const path = require('path');

const TEMPLATE_DATA_FILE = path.join(__dirname, '..', 'data.json');

function getDataPaths() {
  const dataDir = process.env.PERSISTENT_DATA_DIR || path.join(__dirname, '..');
  const dataFile = path.join(dataDir, 'data.json');
  return { dataDir, dataFile };
}

async function readData() {
  const { dataDir, dataFile } = getDataPaths();

  // Ensure directory exists if custom path is used
  if (process.env.PERSISTENT_DATA_DIR && !fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
      console.error("Failed to create PERSISTENT_DATA_DIR:", e);
    }
  }

  // Copy template data.json to dataFile if it doesn't exist yet
  if (!fs.existsSync(dataFile)) {
    try {
      if (fs.existsSync(TEMPLATE_DATA_FILE)) {
        fs.copyFileSync(TEMPLATE_DATA_FILE, dataFile);
      }
    } catch (e) {
      console.error("Failed to copy template data.json to destination:", e);
    }
  }

  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  } catch {
    try {
      return JSON.parse(fs.readFileSync(TEMPLATE_DATA_FILE, 'utf-8'));
    } catch {
      return { payments: [] };
    }
  }
}

async function writeData(data) {
  const { dataDir, dataFile } = getDataPaths();

  // Ensure directory exists if custom path is used
  if (process.env.PERSISTENT_DATA_DIR && !fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
      console.error("Failed to create PERSISTENT_DATA_DIR:", e);
    }
  }
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

module.exports = { readData, writeData };
