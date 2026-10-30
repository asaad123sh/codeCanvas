import type { DBColumn, DBTable, DatabaseSchema } from '../types';

/**
 * SQL dialects the builder can read and write.
 *
 * `Dialect` is kept in sqlGenerator for the export path; this module adds the
 * two extra dialects (SQL Server, SQLite) plus the reverse direction — parsing
 * DDL back into the visual schema, so a user can paste the SQL of an existing
 * site and keep designing from there.
 */

export type SqlDialect = 'mysql' | 'postgresql' | 'mssql' | 'sqlite' | 'mongodb';

export const SQL_DIALECTS: {
  id: SqlDialect;
  label: string;
  fileName: string;
  extension: string;
  comment: string;
}[] = [
  { id: 'mysql', label: 'MySQL / MariaDB', fileName: 'schema.sql', extension: 'sql', comment: '--' },
  { id: 'postgresql', label: 'PostgreSQL', fileName: 'schema.sql', extension: 'sql', comment: '--' },
  { id: 'mssql', label: 'SQL Server', fileName: 'schema.sql', extension: 'sql', comment: '--' },
  { id: 'sqlite', label: 'SQLite', fileName: 'schema.sql', extension: 'sql', comment: '--' },
  { id: 'mongodb', label: 'MongoDB (Mongoose)', fileName: 'models.js', extension: 'js', comment: '//' },
];

export const dialectLabel = (id: string): string =>
  SQL_DIALECTS.find((d) => d.id === id)?.label || id;

export const dialectFileName = (id: string): string =>
  SQL_DIALECTS.find((d) => d.id === id)?.fileName || 'schema.sql';

/* ------------------------------------------------------------------ *
 * DDL -> schema                                                     *
 * ------------------------------------------------------------------ */

const TYPE_ALIASES: Record<string, string> = {
  SERIAL: 'INT', BIGSERIAL: 'BIGINT', INT2: 'INT', INT4: 'INT', INT8: 'BIGINT',
  SMALLINT: 'INT', TINYINT: 'INT', MEDIUMINT: 'INT', BIGINT: 'BIGINT',
  CHARACTER: 'VARCHAR', NVARCHAR: 'VARCHAR', CHAR: 'VARCHAR', NCHAR: 'VARCHAR',
  TEXT: 'TEXT', LONGTEXT: 'LONGTEXT', MEDIUMTEXT: 'TEXT', TINYTEXT: 'TEXT',
  NTEXT: 'TEXT', STRING: 'VARCHAR', UUID: 'VARCHAR', CLOB: 'TEXT',
  REAL: 'FLOAT', FLOAT8: 'DOUBLE', DOUBLEPRECISION: 'DOUBLE', NUMERIC: 'DECIMAL',
  MONEY: 'DECIMAL', BOOL: 'BOOLEAN', BIT: 'BOOLEAN', DATETIME2: 'DATETIME',
  TIMESTAMPTZ: 'TIMESTAMP', TIMESTAMPWITHOUTTIMEZONE: 'TIMESTAMP',
  BLOB: 'BLOB', BYTEA: 'BLOB', VARBINARY: 'BLOB', BINARY: 'BLOB', IMAGE: 'BLOB',
  JSONB: 'JSON', LONGVARCHAR: 'TEXT', ENUM: 'ENUM',
};

const cleanIdent = (raw: string): string =>
  raw
    .replace(/[`"[\]]/g, '')
    .trim()
    .replace(/^(dbo|public)\./i, '');

function splitTopLevel(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  let quote: string | null = null;
  for (const char of body) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      out.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) out.push(current);
  return out.map((part) => part.trim()).filter(Boolean);
}

function normalizeType(raw: string): { type: string; length?: number; enumValues?: string[] } {
  const text = raw.trim();
  const enumMatch = text.match(/^ENUM\s*\(([\s\S]*)\)$/i);
  if (enumMatch) {
    return {
      type: 'ENUM',
      enumValues: enumMatch[1]
        .split(',')
        .map((v) => v.trim().replace(/^'|'$/g, ''))
        .filter(Boolean),
    };
  }
  const match = text.match(/^([A-Za-z_][A-Za-z0-9_ ]*?)\s*(\(\s*(\d+)\s*(?:,\s*(\d+))?\s*\))?/);
  if (!match) return { type: text.toUpperCase() || 'TEXT' };
  let type = match[1].trim().toUpperCase().replace(/\s+/g, ' ');
  const length = match[3] ? Number(match[3]) : undefined;
  if (type === 'DOUBLE PRECISION') type = 'DOUBLE';
  type = TYPE_ALIASES[type] || type;
  if (!['VARCHAR', 'CHAR', 'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'INT', 'BIGINT', 'TEXT', 'ENUM'].includes(type)) {
    return { type };
  }
  return { type, length };
}

function parseColumn(definition: string, tableName: string, known: Set<string>): DBColumn | null {
  const text = definition.trim();
  if (!text) return null;

  const constraint = /^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE\b|CONSTRAINT\b|CHECK\b|KEY\b|INDEX\b|EXCLUDE\b)/i;
  if (constraint.test(text)) return null;

  const nameMatch = text.match(/^([`"[\]\w.]+)\s+/);
  if (!nameMatch) return null;
  const name = cleanIdent(nameMatch[1]);
  if (!name) return null;

  const rest = text.slice(nameMatch[0].length);
  const typeMatch = rest.match(/^([A-Za-z_][A-Za-z0-9_ ]*?)\s*(\([\s\S]*?\))?(?=\s|$)/);
  if (!typeMatch) return null;

  const { type, length, enumValues } = normalizeType(typeMatch[0]);
  const tail = rest.slice(typeMatch[0].length);
  const upper = tail.toUpperCase();

  const references = tail.match(/REFERENCES\s+([`"[\]\w.]+)\s*\(\s*([`"[\]\w]+)\s*\)/i);

  const column: DBColumn = {
    name,
    type: known.has(type) ? type : type,
    nullable: !/NOT\s+NULL/i.test(upper),
    primaryKey: /PRIMARY\s+KEY/i.test(upper),
    unique: /\bUNIQUE\b/i.test(upper),
    autoIncrement:
      /AUTO_INCREMENT|IDENTITY|GENERATED\s+(ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY|nextval\(/i.test(
        text
      ),
  };
  if (length) column.length = length;
  if (enumValues) column.enumValues = enumValues;
  if (references) {
    column.foreignKey = { table: cleanIdent(references[1]), column: cleanIdent(references[2]) };
  }
  const defaultMatch = tail.match(/DEFAULT\s+('(?:[^']|'')*'|[^\s,]+)/i);
  if (defaultMatch) {
    column.defaultValue = defaultMatch[1].replace(/^'|'$/g, '').replace(/''/g, "'");
  }
  void tableName;
  return column;
}

/**
 * Parse `CREATE TABLE` statements into the visual schema.
 *
 * Tolerant by design: unknown column types are kept verbatim so nothing is
 * silently dropped when you paste a script from a real database.
 */
export function parseDdl(sql: string, dbName = 'my_website_db'): DatabaseSchema {
  const source = String(sql || '').replace(/^\s*(?:\/\*[\s\S]*?\*\/|--[^\n]*|#[^\n]*)/gm, '');
  const known = new Set(Object.keys(TYPE_ALIASES));
  const tables: DBTable[] = [];
  const statement = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[\]\w.]+)\s*\(([\s\S]*?)\)\s*(?:ENGINE|DEFAULT|CHARSET|COLLATE|;|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = statement.exec(source)) !== null) {
    const name = cleanIdent(match[1]);
    const body = match[2];
    if (!name) continue;

    const columns: DBColumn[] = [];
    const tableLevelKeys: string[] = [];
    for (const part of splitTopLevel(body)) {
      const column = parseColumn(part, name, known);
      if (column) {
        // A table-level PRIMARY KEY (col) marks that column as the key.
        const inlineKey = part.match(/PRIMARY\s+KEY\s*\(\s*([`"[\]\w]+)\s*\)/i);
        if (inlineKey && !column.primaryKey) {
          const key = cleanIdent(inlineKey[1]);
          const target = columns.find((c) => c.name === key);
          if (target) target.primaryKey = true;
        }
        columns.push(column);
      } else {
        tableLevelKeys.push(part);
      }
    }

    // Table-level UNIQUE (a, b) -> mark both columns unique.
    for (const key of tableLevelKeys) {
      const unique = key.match(/UNIQUE\s*\(\s*([`"[\]\w,\s]+)\)/i);
      if (unique) {
        unique[1]
          .split(',')
          .map((v) => cleanIdent(v))
          .forEach((colName) => {
            const target = columns.find((c) => c.name === colName);
            if (target) target.unique = true;
          });
      }
    }

    tables.push({ id: `tbl_${tables.length + 1}`, name, columns });
  }

  return { dbName, tables };
}

/** The users table the shipped auth backend expects. */
export function usersTable(): DBTable {
  return {
    id: 'tbl_users',
    name: 'users',
    columns: [
      { id: 'c1', name: 'id', type: 'VARCHAR', length: 32, primaryKey: true, nullable: false },
      { id: 'c2', name: 'name', type: 'VARCHAR', length: 64, nullable: false },
      { id: 'c3', name: 'email', type: 'VARCHAR', length: 255, unique: true, nullable: false },
      { id: 'c4', name: 'username', type: 'VARCHAR', length: 64, nullable: true },
      { id: 'c5', name: 'password', type: 'VARCHAR', length: 255, nullable: false, defaultValue: 'hashed:scrypt' },
      { id: 'c6', name: 'role', type: 'VARCHAR', length: 32, nullable: false, defaultValue: 'user' },
      { id: 'c7', name: 'created_at', type: 'TIMESTAMP', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
    ],
  };
}

/**
 * Optional table for the Search Form widget.
 *
 * The bundled runtimes answer ?s= from a cached JSON index, so this table is
 * NOT required — it exists so a project that already has a database can persist
 * the same documents in SQL and query them with FULLTEXT instead.
 */
export function searchDocumentsTable(): DBTable {
  return {
    id: 'tbl_search_documents',
    name: 'search_documents',
    columns: [
      { id: 'c1', name: 'id', type: 'VARCHAR', length: 64, primaryKey: true, nullable: false },
      { id: 'c2', name: 'url', type: 'VARCHAR', length: 255, nullable: false },
      { id: 'c3', name: 'title', type: 'VARCHAR', length: 255, nullable: false },
      { id: 'c4', name: 'body', type: 'TEXT', nullable: true },
      { id: 'c5', name: 'tags', type: 'VARCHAR', length: 255, nullable: true },
      { id: 'c6', name: 'sort_order', type: 'INT', nullable: true, defaultValue: '0' },
      { id: 'c7', name: 'indexed_at', type: 'TIMESTAMP', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
    ],
  };
}
