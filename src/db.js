import { openDB } from 'idb';

const DB_NAME = 'daily-tracker-db';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('tasks')) {
        db.createObjectStore('tasks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('completions')) {
        db.createObjectStore('completions', { keyPath: 'date' });
      }
    }
  });
};

export const getTasks = async () => {
  const db = await initDB();
  return db.getAll('tasks');
};

export const saveTask = async (task) => {
  const db = await initDB();
  return db.put('tasks', task);
};

export const deleteDBTask = async (taskId) => {
  const db = await initDB();
  return db.delete('tasks', taskId);
};

export const getCompletions = async () => {
  const db = await initDB();
  const all = await db.getAll('completions');
  const compMap = {};
  all.forEach(c => {
    compMap[c.date] = c.tasks;
  });
  return compMap;
};

export const saveCompletion = async (dateStr, tasksMap) => {
  const db = await initDB();
  return db.put('completions', { date: dateStr, tasks: tasksMap });
};
