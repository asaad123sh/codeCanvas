import type { ElementType, DBColumn, DBTable, ElementNode } from '../types';
import { generateId } from '../store/builderStore';

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function timestampsColumns(): DBColumn[] {
  return [
    { id: generateId(), name: 'created_at', type: 'TIMESTAMP', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
    { id: generateId(), name: 'updated_at', type: 'TIMESTAMP', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
  ];
}

function idColumn(id: string): DBColumn {
  return { id, name: 'id', type: 'INT', primaryKey: true, autoIncrement: true, nullable: false };
}

/** Slugify a human-readable label into a safe SQL identifier fragment. */
function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'field';
}

/** Pick the best name for a field's DB column from its attributes, label, fallback. */
export function fieldColumnName(
  element: ElementNode,
): string {
  // 1) explicit HTML name attribute (most semantic for a form field)
  const nameAttr = element.attributes?.name;
  if (typeof nameAttr === 'string' && nameAttr.trim()) return slugify(nameAttr);

  // 2) placeholder text — usually describes what goes in the field
  const placeholder = element.attributes?.placeholder;
  if (typeof placeholder === 'string' && placeholder.trim()) return slugify(placeholder);

  // 3) element label (user may have renamed it in the properties panel)
  if (typeof element.label === 'string' && element.label.trim()) return slugify(element.label);

  // 4) type-based fallback
  return slugify(element.type);
}

/** Pick the best table name for a form container from its attributes, label, parent context. */
export function formTableName(
  formElement: ElementNode,
  parentElement: ElementNode | null,
  existingTables: ReadonlyArray<{ name: string }>,
): string {
  // 1) explicit tableName attribute set by the user in the properties panel
  const custom = formElement.attributes?.tableName;
  if (typeof custom === 'string' && custom.trim()) {
    const name = slugify(custom) || 'form_submissions';
    return name; // reuse if exists, otherwise this is the new name
  }

  // 2) the form's own label (user can rename it in the properties panel)
  if (typeof formElement.label === 'string' && formElement.label.trim()) {
    return 'form_' + slugify(formElement.label);
  }

  // 3) parent context: if the form sits inside a section/container with a
  //    meaningful name, derive the form table name from that.
  if (parentElement && typeof parentElement.label === 'string' && parentElement.label.trim()) {
    const name = 'form_' + slugify(parentElement.label);
    return name;
  }

  // 4) fallback — keep it unique
  const base = 'form_submissions';
  if (!existingTables.some((t) => t.name === base)) return base;
  let candidate = base;
  let n = 2;
  while (existingTables.some((t) => t.name === candidate)) {
    candidate = `form_submissions_${n++}`;
  }
  return candidate;
}

/* ------------------------------------------------------------------ *
 * Column factories per element type
 * ------------------------------------------------------------------ */

/** Columns a standalone field creates when dropped outside any form. */
function standaloneFieldColumns(element: ElementNode): DBColumn[] {
  const colName = fieldColumnName(element);
  switch (element.type) {
    case 'textarea':
      return [
        idColumn(generateId()),
        { id: generateId(), name: colName, type: 'TEXT', nullable: true },
        ...timestampsColumns(),
      ];
    case 'checkbox':
      return [
        idColumn(generateId()),
        { id: generateId(), name: colName, type: 'BOOLEAN', nullable: true, defaultValue: '0' },
        ...timestampsColumns(),
      ];
    default:
      return [
        idColumn(generateId()),
        { id: generateId(), name: colName, type: 'VARCHAR', length: 255, nullable: true },
        ...timestampsColumns(),
      ];
  }
}

/** Columns a form container creates for itself (submission meta, no field columns yet). */
function formContainerColumns(): DBColumn[] {
  return [
    idColumn(generateId()),
    { id: generateId(), name: 'submitted_at', type: 'TIMESTAMP', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
    { id: generateId(), name: 'ip_address', type: 'VARCHAR', length: 45, nullable: true },
    ...timestampsColumns(),
  ];
}

/** Canonical (well-known) element types that reuse a shared table. */
const CANONICAL_TABLE: Partial<Record<ElementType, string>> = {
  'login-form': 'users',
  'paypal-button': 'orders',
  'stripe-button': 'orders',
  'search-form': 'search_documents',
};

/** Columns for the canonical tables (login-form, paypal, stripe, search). */
function canonicalColumns(type: ElementType): DBColumn[] {
  switch (type) {
    case 'login-form':
      return [
        { id: generateId(), name: 'id', type: 'VARCHAR', length: 32, primaryKey: true, nullable: false },
        { id: generateId(), name: 'name', type: 'VARCHAR', length: 64, nullable: false },
        { id: generateId(), name: 'email', type: 'VARCHAR', length: 255, unique: true, nullable: false },
        { id: generateId(), name: 'username', type: 'VARCHAR', length: 64, nullable: true },
        { id: generateId(), name: 'password', type: 'VARCHAR', length: 255, nullable: false, defaultValue: 'hashed:scrypt' },
        { id: generateId(), name: 'role', type: 'VARCHAR', length: 32, nullable: false, defaultValue: 'user' },
        { id: generateId(), name: 'created_at', type: 'TIMESTAMP', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
      ];
    case 'paypal-button':
      return [
        idColumn(generateId()),
        { id: generateId(), name: 'transaction_id', type: 'VARCHAR', length: 128, unique: true, nullable: false },
        { id: generateId(), name: 'payer_email', type: 'VARCHAR', length: 255, nullable: false },
        { id: generateId(), name: 'amount', type: 'DECIMAL', length: 10 },
        { id: generateId(), name: 'currency', type: 'VARCHAR', length: 3, nullable: false, defaultValue: 'USD' },
        { id: generateId(), name: 'status', type: 'VARCHAR', length: 32, nullable: false, defaultValue: 'pending' },
        { id: generateId(), name: 'product_name', type: 'VARCHAR', length: 255, nullable: true },
        ...timestampsColumns(),
      ];
    case 'stripe-button':
      return [
        idColumn(generateId()),
        { id: generateId(), name: 'stripe_payment_intent', type: 'VARCHAR', length: 128, unique: true, nullable: false },
        { id: generateId(), name: 'customer_email', type: 'VARCHAR', length: 255, nullable: false },
        { id: generateId(), name: 'amount_cents', type: 'BIGINT', nullable: false },
        { id: generateId(), name: 'currency', type: 'VARCHAR', length: 3, nullable: false, defaultValue: 'usd' },
        { id: generateId(), name: 'status', type: 'VARCHAR', length: 32, nullable: false, defaultValue: 'requires_payment' },
        { id: generateId(), name: 'product_name', type: 'VARCHAR', length: 255, nullable: true },
        ...timestampsColumns(),
      ];
    case 'search-form':
      return [
        idColumn(generateId()),
        { id: generateId(), name: 'query', type: 'VARCHAR', length: 255, nullable: false },
        { id: generateId(), name: 'searched_at', type: 'TIMESTAMP', nullable: true, defaultValue: 'CURRENT_TIMESTAMP' },
      ];
    default:
      return formContainerColumns();
  }
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** Element types whose drop should trigger database generation. */
export const DATA_FORM_ELEMENTS: ElementType[] = [
  'form',
  'input',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'login-form',
  'paypal-button',
  'stripe-button',
  'search-form',
];

/** Is `type` a form field that should live inside a `<form>` container? */
function isFormField(type: ElementType): boolean {
  return type === 'input' || type === 'textarea' || type === 'select' || type === 'checkbox' || type === 'radio';
}

/** Is `type` a form container that can own children? */
function isFormContainer(type: ElementType): boolean {
  return type === 'form';
}

/**
 * Ensure the database reflects the element that was just dropped.
 *
 * Behavior:
 *  - **login-form / paypal-button / stripe-button / search-form** — canonical
 *    tables (`users`, `orders`, `search_documents`), always reused.
 *  - **form container** — creates (or reuses) a `form_<label>` table. Fields
 *    added *inside* this form later will add columns to this same table.
 *  - **form field dropped OUTSIDE any form** — creates its own standalone table
 *    named from the field's `name` / `placeholder` / label.
 *  - **form field dropped INSIDE a form container** — adds a column to the
 *    parent form's table (named from the field's `name` / `placeholder` / label),
 *    so one form = one table with one column per field.
 *
 * Pass `parentElement` + `elements` when the dropped element sits inside a
 * form container so we can route its column to the parent's table.
 */
export function getFormTable(
  type: ElementType,
  element: ElementNode,
  schema: { tables: DBTable[] },
  parentElement: ElementNode | null,
): DBTable | null {
  // ---- canonical widgets (always shared) ----
  const canonicalName = CANONICAL_TABLE[type];
  if (canonicalName) {
    let table = schema.tables.find((t) => t.name === canonicalName);
    if (!table) {
      table = { id: generateId(), name: canonicalName, columns: canonicalColumns(type) };
      schema.tables = [...schema.tables, table];
    }
    return table;
  }

  // ---- form container: one table per form ----
  if (isFormContainer(type)) {
    const tableName = formTableName(element, parentElement, schema.tables);
    let table = schema.tables.find((t) => t.name === tableName);
    if (!table) {
      table = { id: generateId(), name: tableName, columns: formContainerColumns() };
      schema.tables = [...schema.tables, table];
    }
    // Ensure the container's own meta columns exist (idempotent re-drop)
    const want = new Set(formContainerColumns().map((c) => c.name));
    const have = new Set(table.columns.map((c) => c.name));
    for (const col of formContainerColumns()) {
      if (!have.has(col.name)) table.columns = [...table.columns, col];
    }
    return table;
  }

  // ---- form field ----
  if (!isFormField(type)) return null;

  // If this field was dropped inside a form container, add a column to the
  // parent form's table instead of creating a new standalone table.
  if (parentElement?.type === 'form') {
    // Derive the parent form's table name from the parent itself (its label,
    // attributes, etc.). The parent form element passed here is the actual
    // element from state.elements, so its label/attributes are current.
    const parentTableName = formTableName(parentElement, /*parentOfParent=*/ null, schema.tables);
    const parentTable = schema.tables.find((t) => t.name === parentTableName);
    if (parentTable) {
      const colName = fieldColumnName(element);
      const col: DBColumn = {
        id: generateId(),
        name: colName,
        type: element.type === 'textarea' ? 'TEXT' : element.type === 'checkbox' ? 'BOOLEAN' : 'VARCHAR',
        length: element.type === 'checkbox' ? undefined : 255,
        nullable: true,
        defaultValue: element.type === 'checkbox' ? '0' : undefined,
      };
      if (!parentTable.columns.some((c) => c.name === colName)) {
        parentTable.columns = [...parentTable.columns, col];
      }
      return parentTable;
    }
    // Parent form table not found (edge case: form exists in elements but
    // getFormTable wasn't called for it). Fall through to standalone.
  }

  // ---- standalone field (outside any form) ----
  const tableName = 'form_' + fieldColumnName(element);
  let table = schema.tables.find((t) => t.name === tableName);
  if (!table) {
    table = { id: generateId(), name: tableName, columns: standaloneFieldColumns(element) };
    schema.tables = [...schema.tables, table];
  }
  const want = new Set(standaloneFieldColumns(element).map((c) => c.name));
  const have = new Set(table.columns.map((c) => c.name));
  for (const col of standaloneFieldColumns(element)) {
    if (!have.has(col.name)) table.columns = [...table.columns, col];
  }
  return table;
}

/**
 * Lightweight helper: given a parent form element, return its table name
 * (useful for the properties panel's "table name" preview).
 */
export function deriveTableName(
  type: ElementType,
  label: string,
  attributes: Record<string, unknown>,
  existingTables: ReadonlyArray<{ name: string }>,
): string {
  const custom = attributes?.tableName;
  if (typeof custom === 'string' && custom.trim()) return slugify(custom) || 'form_submissions';

  if (isFormContainer(type)) {
    return formTableName({ type, label, attributes } as ElementNode, null, existingTables);
  }
  if (isFormField(type)) return 'form_' + fieldColumnName({ type, label, attributes } as ElementNode);
  if (canonicalName(type)) return CANONICAL_TABLE[type]!;

  return 'form_' + slugify(label || type);
}

function canonicalName(type: ElementType): string | undefined {
  return CANONICAL_TABLE[type];
}
