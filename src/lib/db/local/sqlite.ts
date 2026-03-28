import Database from '@tauri-apps/plugin-sql';
import { runMigrations } from './migrations';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

export async function getLocalDb(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const instance = await Database.load('sqlite:sidquest.db');
    await instance.execute('PRAGMA journal_mode=WAL');
    await instance.execute('PRAGMA foreign_keys=ON');
    await runMigrations(instance);
    db = instance;
    return db;
  })();

  return initPromise;
}
