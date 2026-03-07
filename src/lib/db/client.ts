import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const DATABASE_URL = import.meta.env.VITE_DATABASE_URL || '';

const sql = neon(DATABASE_URL);
export const db = drizzle(sql, { schema });
