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

const EMPTY_PLANNER = {
  updatedAt: Date.now(),
  planner: {
    moveDate: '',
    tasks: [],
    budget: {},
    notes: '',
    customTasks: [],
    theme: 'light',
    schedule: {
      selectedDate: '',
      calendarCollapsed: false,
      events: {}
    }
  }
};

function safeParseJson(value, fallback) {
  if (typeof value !== 'string') {
    return value == null ? fallback : value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseTaskState(value) {
  const parsed = safeParseJson(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function parseObject(value, fallback = {}) {
  const parsed = safeParseJson(value, fallback);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return fallback;
  }
  return parsed;
}

function normalizePlannerPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ...EMPTY_PLANNER.planner };
  }

  if (payload.planner && typeof payload.planner === 'object' && !Array.isArray(payload.planner)) {
    const planner = payload.planner;
    return {
      moveDate: String(planner.moveDate || ''),
      tasks: parseTaskState(planner.tasks),
      budget: parseObject(planner.budget, {}),
      notes: String(planner.notes || ''),
      customTasks: parseTaskState(planner.customTasks),
      theme: planner.theme === 'dark' ? 'dark' : 'light',
      schedule: {
        selectedDate: String(planner.schedule?.selectedDate || ''),
        calendarCollapsed: planner.schedule?.calendarCollapsed === true,
        events: parseObject(planner.schedule?.events, {})
      }
    };
  }

  const storage = safeParseJson(payload.storage, {});
  return {
    moveDate: String(storage.txMoveMoveDate || ''),
    tasks: parseTaskState(storage.txMoveTaskState),
    budget: parseObject(storage.txMoveBudget, {}),
    notes: String(storage.txMoveNotes || ''),
    customTasks: parseTaskState(storage.txMoveCustomTasks),
    theme: storage.txMoveTheme === 'dark' ? 'dark' : 'light',
    schedule: {
      selectedDate: String(storage.txMoveSelectedScheduleDate || ''),
      calendarCollapsed: storage.txMoveCalendarCollapsed === '1',
      events: parseObject(storage.txMoveScheduleEvents, {})
    }
  };
}

function isPlannerShape(data) {
  return !!(
    data &&
    typeof data === 'object' &&
    data.planner &&
    typeof data.planner === 'object' &&
    !Array.isArray(data.planner)
  );
}

function normalizeIncomingPayload(incoming) {
  const planner = normalizePlannerPayload(incoming);
  return {
    updatedAt: Date.now(),
    planner
  };
}

let loggedCanonicalPayloadOnce = false;

async function readData() {
  try {
    const raw = await fs.promises.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    const normalizedPlanner = normalizePlannerPayload(parsed);
    const shouldMigrate = !isPlannerShape(parsed) || !!parsed.storage;

    const payload = {
      updatedAt: Number(parsed.updatedAt || Date.now()),
      planner: normalizedPlanner
    };

    if (shouldMigrate) {
      await writeData(payload);
    }

    return payload;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...EMPTY_PLANNER, updatedAt: Date.now() };
    }
    throw error;
  }
}

async function writeData(nextData) {
  const payload = normalizeIncomingPayload(nextData);
  if (!loggedCanonicalPayloadOnce) {
    console.log('[Planner API] Saved /data payload:', JSON.stringify(payload, null, 2));
    loggedCanonicalPayloadOnce = true;
  }
  await fs.promises.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

async function forceMigrateDataFile() {
  const current = await readData();
  const normalized = {
    ...current,
    planner: normalizePlannerPayload(current)
  };
  await writeData(normalized);
  return normalized;
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
    const saved = await writeData(next);
    res.json(saved);
  } catch (error) {
    res.status(500).json({
      message: 'failed to write data',
      error: String(error)
    });
  }
});

app.post('/admin/migrate-data', async (_req, res) => {
  try {
    const migrated = await forceMigrateDataFile();
    res.json(migrated);
  } catch (error) {
    res.status(500).json({
      message: 'failed to migrate data',
      error: String(error)
    });
  }
});

app.listen(PORT, () => {
  console.log(`planner-api server running on http://localhost:${PORT}`);
});
