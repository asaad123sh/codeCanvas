import type { ClassIdMode, DatabaseSchema, ExportRuntime, PageConfig } from '../types';
import { renderDocument, generateCSS, escapeHTML, setClassIdMode } from './renderer';
import { WIDGET_RUNTIME } from './runtimeJS';
import { AUTH_BACKEND, HTTP_HANDLER } from './authRuntime';
import { SEARCH_BACKEND } from './searchRuntime';
import { generateSchemaFile } from './sqlGenerator';
import type { SqlDialect } from './sqlDialect';

/**
 * Payload for the local "Test Live Website" server.
 *
 * It is deliberately built from the same primitives as every export, so what
 * runs on localhost is the page the user is about to download — including the
 * auth backend, which is sent as source and loaded by the preview server.
 */
export interface LivePayload {
  title: string;
  html: string;
  css: string;
  js: string;
  sql: string;
  authBackend: string;
  httpHandler: string;
  searchBackend: string;
  publishedAt: string;
}

interface Snapshot {
  elements: Record<string, any>;
  rootIds: string[];
  pageConfig: PageConfig;
  customHTML: string;
  customCSS: string;
  customJS: string;
}

export function exportHTML(
  state: Snapshot,
  schema: DatabaseSchema,
  dialect: ExportRuntime | SqlDialect = 'mysql',
  classIdMode?: ClassIdMode
): LivePayload {
  const title = state.pageConfig.title || 'WebCraft Pro site';
  const description = state.pageConfig.metaTags?.description || '';

  // The live preview must match the upcoming export exactly.
  setClassIdMode(classIdMode);

  const document = renderDocument(
    state.elements,
    state.rootIds,
    state.pageConfig.globalJS ? '' : state.customHTML
  );
  const css =
    generateCSS(state.elements, state.rootIds, state.pageConfig) +
    (state.customCSS ? `\n/* Custom CSS */\n${state.customCSS}\n` : '');
  const js = `${WIDGET_RUNTIME}\n${state.pageConfig.globalJS || ''}\n${state.customJS || ''}\n`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHTML(title)}</title>
${description ? `  <meta name="description" content="${escapeHTML(description)}">\n` : ''}  <link rel="stylesheet" href="/style.css">
</head>
<body>
${document}
${state.customHTML ? `<div id="custom-html">${state.customHTML}</div>` : ''}
  <script src="/script.js" defer></script>
</body>
</html>
`;

  const sqlDialect: SqlDialect = dialect === 'mongodb' ? 'mongodb' : (dialect as SqlDialect);

  return {
    title,
    html,
    css,
    js,
    sql: generateSchemaFile(schema, sqlDialect),
    authBackend: AUTH_BACKEND,
    httpHandler: HTTP_HANDLER,
    searchBackend: SEARCH_BACKEND,
    publishedAt: new Date().toISOString(),
  };
}