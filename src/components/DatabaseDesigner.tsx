import React, { useState } from 'react';
import { useBuilderStore, generateId } from '../store/builderStore';
import { Database, Plus, Trash2, Table, Key, Type, Hash, Calendar, ToggleLeft, FileText, List, Save, X, GripVertical, Code, Download, Wand2, Users } from 'lucide-react';
import type { DBTable, DBColumn } from '../types';
import { generateSchemaFile } from '../export/sqlGenerator';
import { SQL_DIALECTS, parseDdl, usersTable, type SqlDialect } from '../export/sqlDialect';

const COLUMN_TYPES = [
  { value: 'VARCHAR', label: 'VARCHAR (String)', icon: <Type size={12} /> },
  { value: 'TEXT', label: 'TEXT (Long Text)', icon: <FileText size={12} /> },
  { value: 'INT', label: 'INT (Integer)', icon: <Hash size={12} /> },
  { value: 'FLOAT', label: 'FLOAT (Decimal)', icon: <Hash size={12} /> },
  { value: 'BOOLEAN', label: 'BOOLEAN (True/False)', icon: <ToggleLeft size={12} /> },
  { value: 'DATE', label: 'DATE', icon: <Calendar size={12} /> },
  { value: 'DATETIME', label: 'DATETIME', icon: <Calendar size={12} /> },
  { value: 'TIMESTAMP', label: 'TIMESTAMP', icon: <Calendar size={12} /> },
  { value: 'JSON', label: 'JSON', icon: <FileText size={12} /> },
  { value: 'ENUM', label: 'ENUM', icon: <List size={12} /> },
];

export const DatabaseDesigner: React.FC = () => {
  const { databaseSchema, setDatabaseSchema } = useBuilderStore();
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [showAddTable, setShowAddTable] = useState(false);
  const [dialect, setDialect] = useState<SqlDialect>('mysql');
  const [showSql, setShowSql] = useState(false);
  const [sqlCode, setSqlCode] = useState('');
  const [sqlNotice, setSqlNotice] = useState<string | null>(null);

  const tables = databaseSchema.tables || [];

  const generated = generateSchemaFile(databaseSchema, dialect);

  const downloadSql = () => {
    const dialectMeta = SQL_DIALECTS.find((d) => d.id === dialect)!;
    const blob = new Blob([sqlCode || generated], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = dialectMeta.fileName;
    link.click();
    URL.revokeObjectURL(url);
    setSqlNotice(`${dialectMeta.fileName} downloaded`);
    window.setTimeout(() => setSqlNotice(null), 2500);
  };

  const applySql = () => {
    const parsed = parseDdl(sqlCode, databaseSchema.dbName);
    if (parsed.tables.length === 0) {
      setSqlNotice('No CREATE TABLE statements found in that SQL');
      window.setTimeout(() => setSqlNotice(null), 3000);
      return;
    }
    setDatabaseSchema({ ...databaseSchema, tables: parsed.tables });
    setSqlNotice(`Parsed ${parsed.tables.length} table${parsed.tables.length === 1 ? '' : 's'} into the designer`);
    window.setTimeout(() => setSqlNotice(null), 3000);
  };

  const addUsersTable = () => {
    if (tables.some((t) => t.name.toLowerCase() === 'users')) {
      setSqlNotice('A users table is already in your schema');
      window.setTimeout(() => setSqlNotice(null), 2500);
      return;
    }
    setDatabaseSchema({ ...databaseSchema, tables: [...tables, usersTable()] });
  };

  const addTable = () => {
    if (!newTableName.trim()) return;
    const table: DBTable = {
      id: generateId(),
      name: newTableName.trim().toLowerCase().replace(/\s+/g, '_'),
      columns: [
        { id: generateId(), name: 'id', type: 'INT', primaryKey: true, autoIncrement: true, nullable: false },
        { id: generateId(), name: 'created_at', type: 'TIMESTAMP', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
        { id: generateId(), name: 'updated_at', type: 'TIMESTAMP', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
      ],
    };
    setDatabaseSchema({ ...databaseSchema, tables: [...tables, table] });
    setNewTableName('');
    setShowAddTable(false);
    setEditingTable(table.id!);
  };

  const removeTable = (tableId: string) => {
    setDatabaseSchema({
      ...databaseSchema,
      tables: tables.filter(t => t.id !== tableId),
    });
    if (editingTable === tableId) setEditingTable(null);
  };

  const updateTable = (tableId: string, updates: Partial<DBTable>) => {
    setDatabaseSchema({
      ...databaseSchema,
      tables: tables.map(t => t.id === tableId ? { ...t, ...updates } : t),
    });
  };

  const addColumn = (tableId: string) => {
    const col: DBColumn = {
      id: generateId(),
      name: 'new_column',
      type: 'VARCHAR',
      nullable: true,
    };
    const table = tables.find(t => t.id === tableId);
    if (table) {
      updateTable(tableId, { columns: [...table.columns, col] });
    }
  };

  const updateColumn = (tableId: string, colId: string, updates: Partial<DBColumn>) => {
    const table = tables.find(t => t.id === tableId);
    if (table) {
      updateTable(tableId, {
        columns: table.columns.map(c => c.id === colId ? { ...c, ...updates } : c),
      });
    }
  };

  const removeColumn = (tableId: string, colId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (table) {
      updateTable(tableId, {
        columns: table.columns.filter(c => c.id !== colId),
      });
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-surface-950">
      {/* Tables List */}
      <div className="w-64 border-r border-surface-700/50 flex flex-col bg-surface-900 shrink-0">
        <div className="panel-header">
          <span className="panel-title flex items-center gap-2">
            <Database size={14} className="text-primary-400" />
            Tables
          </span>
          <button
            onClick={() => setShowAddTable(true)}
            className="p-1.5 rounded-md bg-primary-600 hover:bg-primary-500 text-white transition-colors"
            title="Add Table"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* SQL: generate any dialect, or paste your own code back into the design */}
        <div className="px-3 py-2 border-b border-surface-700/50 space-y-2">
          <div className="flex items-center gap-2">
            <Code size={13} className="text-surface-500" />
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value as SqlDialect)}
              className="flex-1 px-2 py-1 bg-surface-800 border border-surface-700 rounded text-xs text-surface-200 focus:border-primary-500 outline-none"
            >
              {SQL_DIALECTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowSql((v) => !v)}
              className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                showSql
                  ? 'bg-primary-600 text-white border-primary-500'
                  : 'bg-surface-800 text-surface-300 border-surface-700 hover:bg-surface-700'
              }`}
            >
              SQL
            </button>
          </div>

          {showSql ? (
            <div className="space-y-2">
              <textarea
                value={sqlCode}
                onChange={(e) => setSqlCode(e.target.value)}
                spellCheck={false}
                rows={14}
                placeholder={generated}
                className="w-full px-2 py-1.5 bg-surface-950 border border-surface-700 rounded text-[11px] font-mono text-emerald-300/90 focus:border-primary-500 outline-none resize-y"
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSqlCode(generated)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700"
                >
                  <Wand2 size={11} /> Generate
                </button>
                <button
                  onClick={applySql}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700"
                  title="Read CREATE TABLE statements and rebuild the visual design from them"
                >
                  <Code size={11} /> Parse into design
                </button>
                <button
                  onClick={addUsersTable}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700"
                >
                  <Users size={11} /> Users table
                </button>
                <button
                  onClick={downloadSql}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-primary-600 text-white hover:bg-primary-500"
                >
                  <Download size={11} /> Export
                </button>
              </div>
              {sqlNotice ? <p className="text-[10px] text-green-400">{sqlNotice}</p> : null}
            </div>
          ) : (
            <p className="text-[10px] text-surface-600">
              Generate or paste SQL for any database, then export it with your site.
            </p>
          )}
        </div>

        {showAddTable && (
          <div className="px-3 py-2 border-b border-surface-700/50 flex gap-2">
            <input
              type="text"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTable()}
              placeholder="table_name"
              className="flex-1 px-2 py-1 bg-surface-800 border border-surface-700 rounded text-xs text-surface-200 focus:border-primary-500 outline-none"
              autoFocus
            />
            <button onClick={addTable} className="p-1 text-green-400 hover:text-green-300"><Save size={14} /></button>
            <button onClick={() => setShowAddTable(false)} className="p-1 text-surface-500 hover:text-surface-300"><X size={14} /></button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
          {tables.length === 0 ? (
            <div className="p-6 text-center">
              <Table size={32} className="mx-auto text-surface-700 mb-3" />
              <p className="text-xs text-surface-500">No tables yet</p>
              <p className="text-[10px] text-surface-600 mt-1">Click + to create a table</p>
            </div>
          ) : (
            tables.map(table => (
              <button
                key={table.id}
                onClick={() => setEditingTable(table.id!)}
                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-all ${
                  editingTable === table.id
                    ? 'bg-primary-600/10 text-primary-400 border-l-2 border-primary-500'
                    : 'text-surface-300 hover:bg-surface-800/50 border-l-2 border-transparent'
                }`}
              >
                <Table size={14} className="shrink-0" />
                <span className="truncate font-mono text-xs">{table.name}</span>
                <span className="ml-auto text-[10px] text-surface-600">{table.columns.length} cols</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Column Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {editingTable ? (
          (() => {
            const table = tables.find(t => t.id === editingTable);
            if (!table) return null;
            return (
              <>
                <div className="panel-header bg-surface-900">
                  <div className="flex items-center gap-3">
                    <Table size={16} className="text-primary-400" />
                    <input
                      value={table.name}
                      onChange={(e) => updateTable(table.id!, { name: e.target.value })}
                      className="bg-transparent text-sm font-semibold text-surface-200 border-none outline-none focus:ring-0 font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => addColumn(table.id!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-md text-xs font-medium transition-colors"
                    >
                      <Plus size={12} />
                      Add Column
                    </button>
                    <button
                      onClick={() => removeTable(table.id!)}
                      className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete table"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-700/50 text-left">
                        <th className="pb-3 px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider w-8"></th>
                        <th className="pb-3 px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Column Name</th>
                        <th className="pb-3 px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Type</th>
                        <th className="pb-3 px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Length</th>
                        <th className="pb-3 px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider text-center">PK</th>
                        <th className="pb-3 px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider text-center">AI</th>
                        <th className="pb-3 px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider text-center">Nullable</th>
                        <th className="pb-3 px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Default</th>
                        <th className="pb-3 px-3 text-xs font-semibold text-surface-400 uppercase tracking-wider w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.columns.map((col) => (
                        <tr key={col.id} className="border-b border-surface-800/50 hover:bg-surface-800/30 group transition-colors">
                          <td className="py-2 px-3 text-surface-600 cursor-grab">
                            <GripVertical size={12} />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              value={col.name}
                              onChange={(e) => updateColumn(table.id!, col.id!, { name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                              className="w-full px-2 py-1 bg-surface-800/50 border border-transparent hover:border-surface-700 focus:border-primary-500 rounded text-xs text-surface-200 font-mono outline-none transition-colors"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={col.type}
                              onChange={(e) => updateColumn(table.id!, col.id!, { type: e.target.value })}
                              className="w-full px-2 py-1 bg-surface-800/50 border border-transparent hover:border-surface-700 focus:border-primary-500 rounded text-xs text-surface-200 outline-none appearance-none cursor-pointer transition-colors"
                            >
                              {COLUMN_TYPES.map(ct => (
                                <option key={ct.value} value={ct.value}>{ct.value}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              value={col.length || ''}
                              onChange={(e) => updateColumn(table.id!, col.id!, { length: e.target.value ? parseInt(e.target.value) : undefined })}
                              placeholder="255"
                              type="number"
                              className="w-20 px-2 py-1 bg-surface-800/50 border border-transparent hover:border-surface-700 focus:border-primary-500 rounded text-xs text-surface-200 font-mono outline-none transition-colors"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={col.primaryKey || false}
                              onChange={(e) => updateColumn(table.id!, col.id!, { primaryKey: e.target.checked })}
                              className="accent-primary-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={col.autoIncrement || false}
                              onChange={(e) => updateColumn(table.id!, col.id!, { autoIncrement: e.target.checked })}
                              className="accent-primary-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={col.nullable !== false}
                              onChange={(e) => updateColumn(table.id!, col.id!, { nullable: e.target.checked })}
                              className="accent-primary-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              value={col.defaultValue || ''}
                              onChange={(e) => updateColumn(table.id!, col.id!, { defaultValue: e.target.value || undefined })}
                              placeholder="NULL"
                              className="w-full px-2 py-1 bg-surface-800/50 border border-transparent hover:border-surface-700 focus:border-primary-500 rounded text-xs text-surface-200 font-mono outline-none transition-colors"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => removeColumn(table.id!, col.id!)}
                              className="p-1 rounded text-surface-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Database size={48} className="mx-auto text-surface-700 mb-4" />
              <h3 className="text-sm font-semibold text-surface-400 mb-1">Database Schema Designer</h3>
              <p className="text-xs text-surface-500 max-w-xs mx-auto">
                Select a table from the left panel or create a new one to design your database schema. 
                The schema will be exported with your project.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};