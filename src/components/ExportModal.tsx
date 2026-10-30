import React, { useState } from 'react';
import { Download, Server, Database, Package, Check, Loader2, X, FileCode, HardDrive, PlayCircle, CheckCircle2 } from 'lucide-react';
import { useBuilderStore } from '../store/builderStore';
import { generateSchemaFile } from '../export/sqlGenerator';
import { dialectFileName } from '../export/sqlDialect';
import type { ClassIdMode, ExportTarget } from '../types';

const LIVE_URL = 'http://localhost:4177';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { pageConfig, databaseSchema } = useBuilderStore();
  const [step, setStep] = useState<'runtime' | 'database' | 'config' | 'exporting' | 'done'>('runtime');
  const [target, setTarget] = useState<ExportTarget>({
    runtime: 'nodejs',
    database: 'mysql',
    projectName: pageConfig.title.replace(/\s+/g, '-').toLowerCase() || 'my-website',
    includeDatabase: true,
    classIdMode: 'unique',
  });
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ fileCount: number; name: string } | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  /**
   * Publish the current design to the local preview server and open it.
   *
   * This is the same page + same backend the export produces, so login,
   * registration and contact forms can be exercised before downloading.
   */
  const testLiveSite = async () => {
    setLiveBusy(true);
    setLiveMessage('Publishing your design…');
    try {
      const state = useBuilderStore.getState();
      const { exportHTML } = await import('../export/livePayload');
      const payload = exportHTML(state, databaseSchema, target.database, target.classIdMode);
      const response = await fetch(`${LIVE_URL}/__webcraft/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`publish failed (${response.status})`);
      setLiveMessage('Live! Opening your site…');
      window.open(`${LIVE_URL}/`, '_blank', 'noopener');
    } catch {
      setLiveMessage(
        `Start the preview server first: run "npm run live" in web-builder, then press this again.`
      );
    } finally {
      setLiveBusy(false);
      window.setTimeout(() => setLiveMessage(null), 9000);
    }
  };

  const downloadSchema = () => {
    const sql = generateSchemaFile(databaseSchema, target.database === 'mongodb' ? 'mongodb' : target.database);
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = dialectFileName(target.database === 'mongodb' ? 'mongodb' : target.database);
    link.click();
    URL.revokeObjectURL(url);
    setLiveMessage('schema downloaded');
    window.setTimeout(() => setLiveMessage(null), 2500);
  };


  const handleExport = async () => {
    setStep('exporting');
    setExporting(true);
    try {
      // Dynamic import to keep the initial bundle small
      const { exportProject } = await import('../export/exportManager');
      const state = useBuilderStore.getState();
      const outcome = await exportProject(target, {
        elements: state.elements,
        rootIds: state.rootIds,
        pageConfig: state.pageConfig,
        databaseSchema: state.databaseSchema,
        customHTML: state.customHTML,
        customCSS: state.customCSS,
        customJS: state.customJS,
      });
      setResult(outcome);
      setStep('done');
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Check console for details.');
      setStep('config');
    } finally {
      setExporting(false);
    }
  };

  const resetAndClose = () => {
    setStep('runtime');
    setResult(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={resetAndClose}>
      <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="panel-header">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600/20 rounded-lg">
              <Package className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Export Website</h2>
              <p className="text-xs text-surface-400">Generate production-ready code</p>
            </div>
          </div>
          <button onClick={resetAndClose} className="btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-surface-700/30">
          <div className="flex items-center justify-between">
            {['Runtime', 'Database', 'Configure', 'Export'].map((label, i) => {
              const steps = ['runtime', 'database', 'config', 'exporting'];
              const currentIdx = steps.indexOf(step);
              const isActive = i <= currentIdx || step === 'done';
              return (
                <React.Fragment key={label}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      isActive ? 'bg-primary-600 text-white' : 'bg-surface-700 text-surface-400'
                    }`}>
                      {i < currentIdx || step === 'done' ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className={`text-xs ${isActive ? 'text-primary-400' : 'text-surface-500'}`}>{label}</span>
                  </div>
                  {i < 3 && <div className={`flex-1 h-0.5 mx-2 ${isActive ? 'bg-primary-600' : 'bg-surface-700'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[350px]">
          {step === 'runtime' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Server className="w-5 h-5 text-primary-400" /> Select Backend Runtime
              </h3>
              <p className="text-sm text-surface-400 mb-6">Choose the server technology for your exported website.</p>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => { setTarget({ ...target, runtime: 'wordpress', database: 'mysql' }); setStep('database'); }}
                  className={`p-5 rounded-xl border-2 transition-all text-left ${
                    target.runtime === 'wordpress' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 hover:border-surface-500 bg-surface-800/50'
                  }`}
                >
                  <div className="text-3xl mb-3">🟢</div>
                  <h4 className="font-bold text-white text-lg">WordPress</h4>
                  <p className="text-sm text-surface-400 mt-1">A complete classic theme with Elementor-style markup and breakpoints.</p>
                  <ul className="mt-3 space-y-1 text-xs text-surface-400">
                    <li>• style.css / functions.php / templates</li>
                    <li>• wp_head() + wp_footer() hooks</li>
                    <li>• Page template + front page</li>
                    <li>• Forms saved to uploads</li>
                  </ul>
                </button>
                <button
                  onClick={() => { setTarget({ ...target, runtime: 'php', database: 'mysql' }); setStep('database'); }}
                  className={`p-5 rounded-xl border-2 transition-all text-left ${
                    target.runtime === 'php' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 hover:border-surface-500 bg-surface-800/50'
                  }`}
                >
                  <div className="text-3xl mb-3">🐘</div>
                  <h4 className="font-bold text-white text-lg">PHP</h4>
                  <p className="text-sm text-surface-400 mt-1">Classic server-side rendering with PDO database connections. Perfect for shared hosting.</p>
                  <ul className="mt-3 space-y-1 text-xs text-surface-400">
                    <li>• Apache/Nginx compatible</li>
                    <li>• PDO MySQL connections</li>
                    <li>• .htaccess routing</li>
                    <li>• Form handlers included</li>
                  </ul>
                </button>
                <button
                  onClick={() => { setTarget({ ...target, runtime: 'nodejs' }); setStep('database'); }}
                  className={`p-5 rounded-xl border-2 transition-all text-left ${
                    target.runtime === 'nodejs' ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 hover:border-surface-500 bg-surface-800/50'
                  }`}
                >
                  <div className="text-3xl mb-3">💚</div>
                  <h4 className="font-bold text-white text-lg">Node.js</h4>
                  <p className="text-sm text-surface-400 mt-1">Modern Express.js backend with REST API. Supports multiple databases.</p>
                  <ul className="mt-3 space-y-1 text-xs text-surface-400">
                    <li>• Express.js server</li>
                    <li>• RESTful API routes</li>
                    <li>• Multiple DB support</li>
                    <li>• Environment configs</li>
                  </ul>
                </button>
              </div>
            </div>
          )}

          {step === 'database' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Database className="w-5 h-5 text-primary-400" /> Select Database
              </h3>
              <p className="text-sm text-surface-400 mb-6">
                {target.runtime === 'nodejs'
                  ? 'Node.js supports multiple databases. Choose your preferred engine.'
                  : `${target.runtime === 'wordpress' ? 'WordPress' : 'PHP'} exports use MySQL / MariaDB (the WordPress standard).`}
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'mysql' as const, name: 'MySQL', icon: '🐬', desc: 'Most popular relational DB' },
                  { id: 'postgresql' as const, name: 'PostgreSQL', icon: '🐘', desc: 'Advanced relational DB', nodeOnly: true },
                  { id: 'mongodb' as const, name: 'MongoDB', icon: '🍃', desc: 'NoSQL document store', nodeOnly: true },
                ].map((db) => {
                  const disabled = db.nodeOnly && target.runtime !== 'nodejs';
                  return (
                    <button
                      key={db.id}
                      disabled={disabled}
                      onClick={() => { setTarget({ ...target, database: db.id }); setStep('config'); }}
                      className={`p-5 rounded-xl border-2 transition-all text-center ${
                        disabled ? 'opacity-40 cursor-not-allowed border-surface-800' :
                        target.database === db.id ? 'border-primary-500 bg-primary-500/10' : 'border-surface-700 hover:border-surface-500 bg-surface-800/50'
                      }`}
                    >
                      <div className="text-3xl mb-2">{db.icon}</div>
                      <h4 className="font-bold text-white">{db.name}</h4>
                      <p className="text-xs text-surface-400 mt-1">{db.desc}</p>
                      {disabled && <p className="text-xs text-red-400 mt-2">Node.js only</p>}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setStep('runtime')} className="btn-ghost mt-4">← Back</button>
            </div>
          )}

          {step === 'config' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary-400" /> Project Configuration
              </h3>
              <p className="text-sm text-surface-400 mb-6">Configure your export settings before generating files.</p>
              <div className="space-y-4">
                <div>
                  <label className="label-text">Project Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={target.projectName}
                    onChange={(e) => setTarget({ ...target, projectName: e.target.value })}
                    placeholder="my-awesome-website"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-surface-800 rounded-xl border border-surface-700/50">
                  <div>
                    <h4 className="font-medium text-white">Include Database Schema</h4>
                    <p className="text-xs text-surface-400 mt-1">Generate SQL migrations and connection files for {databaseSchema.tables.length} table(s)</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={target.includeDatabase}
                      onChange={(e) => setTarget({ ...target, includeDatabase: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                <div className="p-4 bg-surface-800 rounded-xl border border-surface-700/50">
                  <h4 className="font-medium text-white">Classes & IDs</h4>
                  <p className="text-xs text-surface-400 mt-1 mb-3">
                    How should the generated code assign classes and ids to your elements?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      {
                        id: 'unique' as const,
                        name: 'Every element unique',
                        desc: 'Each element gets its own class and id (wb-el-…) — pixel-perfect, fully independent styling.',
                      },
                      {
                        id: 'combined' as const,
                        name: 'Combine identical elements',
                        desc: 'Elements with identical styles share one class and drop their id — smaller CSS output.',
                      },
                    ]).map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setTarget({ ...target, classIdMode: mode.id as ClassIdMode })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          target.classIdMode === mode.id
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-surface-700 hover:border-surface-500 bg-surface-800/50'
                        }`}
                      >
                        <h5 className="font-semibold text-white text-sm">{mode.name}</h5>
                        <p className="text-xs text-surface-400 mt-1">{mode.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 bg-surface-800/50 rounded-xl border border-surface-700/30">
                  <h4 className="text-sm font-semibold text-surface-300 mb-2">Export Summary</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2"><FileCode className="w-4 h-4 text-primary-400" /><span className="text-surface-300">Runtime:</span><span className="font-bold text-white uppercase">{target.runtime}</span></div>
                    <div className="flex items-center gap-2"><Database className="w-4 h-4 text-primary-400" /><span className="text-surface-300">Database:</span><span className="font-bold text-white uppercase">{target.includeDatabase ? target.database : 'none'}</span></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep('database')} className="btn-secondary">← Back</button>
                <button onClick={handleExport} className="btn-primary flex-1 justify-center" disabled={!target.projectName}>
                  <Download className="w-4 h-4" /> Generate & Download ZIP
                </button>
              </div>
            </div>
          )}

          {step === 'runtime' && (
            <div className="mt-5 pt-5 border-t border-surface-700/50">
              <h4 className="text-sm font-semibold text-surface-300 mb-1">Test before you export</h4>
              <p className="text-xs text-surface-500 mb-3">
                Run <code className="text-surface-300 font-mono">npm run live</code> in the
                project folder once, then press the button: your design opens at{' '}
                <span className="text-surface-300 font-mono">{LIVE_URL}</span> with working
                registration, login and contact form submissions.
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={testLiveSite} className="btn-primary" disabled={liveBusy}>
                  {liveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  Test Live Website
                </button>
                <button onClick={downloadSchema} className="btn-secondary">
                  <FileCode className="w-4 h-4" /> Export schema.sql
                </button>
              </div>
              {liveMessage ? (
                <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {liveMessage}
                </p>
              ) : null}
            </div>
          )}

          {step === 'exporting' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-16 h-16 text-primary-500 animate-spin mb-6" />
              <h3 className="text-xl font-bold text-white mb-2">Generating Your Project...</h3>
              <p className="text-surface-400 text-sm">Creating {target.runtime.toUpperCase()} files with {target.database} database integration</p>
              <div className="mt-6 w-64 h-2 bg-surface-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                <Check className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Export Complete!</h3>
              <p className="text-surface-400 text-sm text-center max-w-md">
                Your project <strong className="text-white">{result?.name || `${target.projectName}.zip`}</strong> has been
                downloaded with {result ? `${result.fileCount} files` : 'all generated files'}.
                {target.runtime === 'wordpress'
                  ? ' Upload the folder as a theme under Appearance → Themes → Add New.'
                  : target.runtime === 'php'
                    ? ' Upload it to any PHP 7.4+ host, or run: php -S localhost:8000'
                    : ' Run: npm install && npm start'}
              </p>
              <button onClick={resetAndClose} className="btn-primary mt-6">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};