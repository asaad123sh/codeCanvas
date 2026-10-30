import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type {
  ElementNode,
  PageConfig,
  DatabaseSchema,
  ExportTarget,
  SiteModel,
} from '../types';
import { generatePHPProject } from './phpGenerator';
import { generateNodeProject } from './nodeGenerator';
import { generateWordPressTheme } from './wordpressGenerator';
import { setClassIdMode } from './renderer';

export interface ExportDocument {
  elements: Record<string, ElementNode>;
  rootIds: string[];
  pageConfig: PageConfig;
  databaseSchema: DatabaseSchema;
  customHTML: string;
  customCSS: string;
  customJS: string;
  /** Whole site - when present the export ships every page. */
  site?: SiteModel;
}

export async function exportProject(target: ExportTarget, doc: ExportDocument) {
  // Class/id strategy must be set before any rendering: the renderer reads it
  // while emitting markup and CSS.
  setClassIdMode(target.classIdMode);
  const options = {
    customHTML: doc.customHTML,
    customCSS: doc.customCSS,
    customJS: doc.customJS,
    includeDatabase: target.includeDatabase,
    classIdMode: target.classIdMode,
  };

  let files: Record<string, string>;

  if (target.runtime === 'wordpress') {
    files = generateWordPressTheme(
      doc.elements,
      doc.rootIds,
      doc.pageConfig,
      doc.databaseSchema,
      target.projectName,
      options,
      doc.site
    );
  } else if (target.runtime === 'php') {
    files = generatePHPProject(
      doc.elements,
      doc.rootIds,
      doc.pageConfig,
      doc.databaseSchema,
      options,
      doc.site
    );
  } else {
    files = generateNodeProject(
      doc.elements,
      doc.rootIds,
      doc.pageConfig,
      doc.databaseSchema,
      target.database,
      options,
      doc.site
    );
  }

  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const safeName =
    target.projectName.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') ||
    'webcraft-project';
  saveAs(blob, `${safeName}.zip`);

  return { fileCount: Object.keys(files).length, name: `${safeName}.zip` };
}
