import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'timesheet.db');
let db: any = null;

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(path.dirname(require.resolve('sql.js')), file),
  });

  try {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } catch {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
}

function saveDatabase(): void {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Convert PostgreSQL $1,$2 placeholders to SQLite ?
function convertParams(sql: string): string {
  return sql.replace(/\$\d+/g, '?');
}

function execSelect(sql: string, params: any[]): { rows: any[] } {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return { rows };
}

function execWrite(sql: string, params: any[]): { rows: any[] } {
  const returningIdx = sql.search(/\s+RETURNING\s+/i);
  const hasReturning = returningIdx !== -1;
  const sqlWithoutReturning = hasReturning ? sql.slice(0, returningIdx).trim() : sql;

  const isInsert = /^\s*INSERT/i.test(sql);
  const isUpdate = /^\s*UPDATE/i.test(sql);
  const isDelete = /^\s*DELETE/i.test(sql);

  db.run(sqlWithoutReturning, params);

  // Capture last insert rowid BEFORE saveDatabase() — db.export() resets it in sql.js
  let insertedId: number | null = null;
  if (hasReturning && isInsert) {
    const lastIdRows = execSelect('SELECT last_insert_rowid() as id', []);
    if (lastIdRows.rows.length && lastIdRows.rows[0].id) {
      insertedId = lastIdRows.rows[0].id as number;
    }
  }

  saveDatabase();

  if (!hasReturning) return { rows: [] };

  if (isInsert) {
    const tableMatch = sqlWithoutReturning.match(/INSERT\s+INTO\s+(\w+)/i);
    if (!tableMatch || !insertedId) return { rows: [] };
    const tableName = tableMatch[1];
    return execSelect(`SELECT * FROM ${tableName} WHERE id = ?`, [insertedId]);
  }

  if (isUpdate) {
    const tableMatch = sqlWithoutReturning.match(/UPDATE\s+(\w+)/i);
    const whereIdIdx = sqlWithoutReturning.search(/WHERE\s+id\s*=\s*\?/i);
    if (!tableMatch || whereIdIdx === -1) return { rows: [] };
    const tableName = tableMatch[1];
    const beforeWhere = sqlWithoutReturning.slice(0, whereIdIdx);
    const paramsBefore = (beforeWhere.match(/\?/g) || []).length;
    const idValue = params[paramsBefore];
    return execSelect(`SELECT * FROM ${tableName} WHERE id = ?`, [idValue]);
  }

  if (isDelete) {
    const modified = db.getRowsModified();
    return modified > 0 ? { rows: [{ id: params[params.length - 1] }] } : { rows: [] };
  }

  return { rows: [] };
}

function querySync(sql: string, params: any[] = []): { rows: any[] } {
  const sqliteSql = convertParams(sql);
  const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sqliteSql.trim());

  try {
    return isWrite ? execWrite(sqliteSql, params) : execSelect(sqliteSql, params);
  } catch (err) {
    console.error('DB query error:', err);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw err;
  }
}

// Run a single raw SQL statement directly (bypasses pg-compat layer)
export function runRaw(sql: string): void {
  db.run(sql);
  saveDatabase();
}

// Run raw SQL directly (used for schema init — no param conversion, no save after each)
export function runSchema(sql: string): void {
  const statements = sql.split(';').filter((s) => s.trim());
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (trimmed) {
      try {
        db.run(trimmed);
      } catch (err: any) {
        // Ignore "already exists" errors on indexes/tables
        if (!err.message?.includes('already exists')) {
          console.error('Schema error:', err.message, '| SQL:', trimmed.substring(0, 80));
        }
      }
    }
  }
  saveDatabase();
}

const pool = {
  query: (sql: string, params: any[] = []): Promise<{ rows: any[] }> =>
    Promise.resolve(querySync(sql, params)),
};

export default pool;
