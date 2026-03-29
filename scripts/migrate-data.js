const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

const EMPTY = {
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

function parseArray(value) {
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
  if (payload && payload.planner && typeof payload.planner === 'object' && !Array.isArray(payload.planner)) {
    const planner = payload.planner;
    return {
      moveDate: String(planner.moveDate || ''),
      tasks: parseArray(planner.tasks),
      budget: parseObject(planner.budget, {}),
      notes: String(planner.notes || ''),
      customTasks: parseArray(planner.customTasks),
      theme: planner.theme === 'dark' ? 'dark' : 'light',
      schedule: {
        selectedDate: String(planner.schedule?.selectedDate || ''),
        calendarCollapsed: planner.schedule?.calendarCollapsed === true,
        events: parseObject(planner.schedule?.events, {})
      }
    };
  }

  const storage = safeParseJson(payload?.storage, {});
  return {
    moveDate: String(storage?.txMoveMoveDate || ''),
    tasks: parseArray(storage?.txMoveTaskState),
    budget: parseObject(storage?.txMoveBudget, {}),
    notes: String(storage?.txMoveNotes || ''),
    customTasks: parseArray(storage?.txMoveCustomTasks),
    theme: storage?.txMoveTheme === 'dark' ? 'dark' : 'light',
    schedule: {
      selectedDate: String(storage?.txMoveSelectedScheduleDate || ''),
      calendarCollapsed: storage?.txMoveCalendarCollapsed === '1',
      events: parseObject(storage?.txMoveScheduleEvents, {})
    }
  };
}

const raw = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8') : '{}';
const current = safeParseJson(raw, {});
const migrated = {
  updatedAt: Date.now(),
  planner: normalizePlannerPayload(current)
};

fs.writeFileSync(DATA_FILE, JSON.stringify(migrated, null, 2), 'utf8');
console.log('data.json migrated to planner schema.');
console.log(JSON.stringify(migrated, null, 2));
