const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

async function readData() {
  try {
    const raw = await fs.promises.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { updatedAt: Date.now(), storage: {} };
    }
    throw error;
  }
}

async function writeData(nextData) {
  const payload = {
    ...(nextData || {}),
    updatedAt: Date.now()
  };
  await fs.promises.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

app.get('/data', async (_req, res) => {
  try {
    const data = await readData();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: 'failed to read data',
      error: String(error)
    });
  }
});

app.post('/data', async (req, res) => {
  try {
    const next = req.body && typeof req.body === 'object' ? req.body : {};
    const saved = await writeData({
      ...next,
      updatedAt: Date.now()
    });
    res.json(saved);
  } catch (error) {
    res.status(500).json({
      message: 'failed to write data',
      error: String(error)
    });
  }
});

app.listen(PORT, () => {
  console.log(`planner-api server running on http://localhost:${PORT}`);
});
