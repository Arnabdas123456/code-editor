'use client';

import type { ProjectFile } from '@/lib/types/database';
import type { WebContainer, FileSystemTree, WebContainerProcess } from '@webcontainer/api';

export type RuntimeState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'running'
  | 'error'
  | 'stopped';

export type FrameworkType = 'nextjs' | 'vite' | 'node' | 'static' | 'unknown';
export type PackageManagerType = 'npm' | 'pnpm' | 'yarn';

export interface RuntimeErrorInfo {
  message: string;
  file?: string;
  line?: number;
  stack?: string;
  raw?: string;
}

export interface WebContainerRuntimeSnapshot {
  state: RuntimeState;
  framework: FrameworkType;
  packageManager: PackageManagerType;
  previewUrl: string | null;
  serverPort: number | null;
  lastError: RuntimeErrorInfo | null;
  isIsolated: boolean;
  isBooted: boolean;
}

// Convert files array to WebContainer FileSystemTree
export function filesToFileSystemTree(files: ProjectFile[]): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const file of files) {
    if (file.is_folder) continue;

    const parts = file.path.replace(/^\//, '').split('/');
    let current: FileSystemTree = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        current[part] = {
          file: {
            contents: file.content ?? '',
          },
        };
      } else {
        if (!current[part]) {
          current[part] = {
            directory: {},
          };
        }
        const node = current[part];
        if (node && 'directory' in node) {
          current = node.directory;
        }
      }
    }
  }

  return tree;
}

/**
 * Calculates a SHA-like fingerprint hash of project dependencies & package managers
 * to avoid unnecessary reinstalls during ordinary code edits.
 */
export function calculateDependencyFingerprint(files: ProjectFile[]): string {
  const pkgFile = files.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));
  const lockPnpm = files.find((f) => f.path.endsWith('pnpm-lock.yaml'));
  const lockYarn = files.find((f) => f.path.endsWith('yarn.lock'));
  const lockNpm = files.find((f) => f.path.endsWith('package-lock.json'));

  let pkgContent = '';
  if (pkgFile?.content) {
    try {
      const parsed = JSON.parse(pkgFile.content) as Record<string, unknown>;
      const relevant = {
        dependencies: parsed.dependencies || {},
        devDependencies: parsed.devDependencies || {},
        peerDependencies: parsed.peerDependencies || {},
        optionalDependencies: parsed.optionalDependencies || {},
        packageManager: parsed.packageManager || '',
      };
      pkgContent = JSON.stringify(relevant);
    } catch {
      pkgContent = pkgFile.content;
    }
  }

  const raw = [
    pkgContent,
    lockPnpm ? `pnpm:${lockPnpm.content.length}` : '',
    lockYarn ? `yarn:${lockYarn.content.length}` : '',
    lockNpm ? `npm:${lockNpm.content.length}` : '',
  ].join('||');

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Detect framework from project files
 */
export function detectFramework(files: ProjectFile[]): {
  framework: FrameworkType;
  devCommand: { cmd: string; args: string[] };
} {
  const pkgFile = files.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));

  if (!pkgFile?.content) {
    const hasHtml = files.some((f) => f.path === 'index.html' || f.path.endsWith('/index.html'));
    if (hasHtml) {
      return { framework: 'static', devCommand: { cmd: 'npx', args: ['serve', '.'] } };
    }
    return { framework: 'unknown', devCommand: { cmd: 'npm', args: ['run', 'dev'] } };
  }

  try {
    const parsed = JSON.parse(pkgFile.content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
    const scripts = parsed.scripts || {};

    if (deps['next'] || scripts['dev']?.includes('next')) {
      return {
        framework: 'nextjs',
        devCommand: { cmd: 'npm', args: ['run', 'dev'] },
      };
    }

    if (deps['vite'] || scripts['dev']?.includes('vite')) {
      return {
        framework: 'vite',
        devCommand: { cmd: 'npm', args: ['run', 'dev'] },
      };
    }

    if (deps['express'] || deps['fastify'] || scripts['start'] || scripts['dev']) {
      const devScript = scripts['dev'] ? ['run', 'dev'] : scripts['start'] ? ['run', 'start'] : ['run', 'dev'];
      return {
        framework: 'node',
        devCommand: { cmd: 'npm', args: devScript },
      };
    }

    return {
      framework: 'static',
      devCommand: { cmd: 'npx', args: ['serve', '.'] },
    };
  } catch {
    return {
      framework: 'unknown',
      devCommand: { cmd: 'npm', args: ['run', 'dev'] },
    };
  }
}

/**
 * Detect package manager from project files and package.json
 */
export function detectPackageManager(files: ProjectFile[]): PackageManagerType {
  const pkgFile = files.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));
  if (pkgFile?.content) {
    try {
      const parsed = JSON.parse(pkgFile.content) as { packageManager?: string };
      if (typeof parsed.packageManager === 'string') {
        if (parsed.packageManager.startsWith('pnpm')) return 'pnpm';
        if (parsed.packageManager.startsWith('yarn')) return 'yarn';
        if (parsed.packageManager.startsWith('npm')) return 'npm';
      }
    } catch {}
  }

  if (files.some((f) => f.path.endsWith('pnpm-lock.yaml'))) return 'pnpm';
  if (files.some((f) => f.path.endsWith('yarn.lock'))) return 'yarn';
  return 'npm';
}

/**
 * Unified WebContainer Runtime Manager
 * Owns WebContainer singleton lifecycle, mounting, dependency installation, dev server,
 * hot-sync, persistent terminal shell, and runtime errors.
 */
class WebContainerRuntimeManager {
  private instance: WebContainer | null = null;
  private bootPromise: Promise<WebContainer | null> | null = null;
  private state: RuntimeState = 'idle';
  private framework: FrameworkType = 'unknown';
  private packageManager: PackageManagerType = 'npm';
  private previewUrl: string | null = null;
  private serverPort: number | null = null;
  private lastError: RuntimeErrorInfo | null = null;
  private lastInstalledFingerprint: string | null = null;

  // Processes
  private devProcess: WebContainerProcess | null = null;
  private shellProcess: WebContainerProcess | null = null;
  private shellWriter: WritableStreamDefaultWriter<string> | null = null;

  // Listeners
  private snapshotListeners = new Set<(snap: WebContainerRuntimeSnapshot) => void>();
  private devOutputListeners = new Set<(chunk: string) => void>();
  private shellOutputListeners = new Set<(chunk: string) => void>();
  private errorListeners = new Set<(error: RuntimeErrorInfo) => void>();

  public isCrossOriginIsolated(): boolean {
    return typeof window !== 'undefined' && Boolean(window.crossOriginIsolated);
  }

  public getSnapshot(): WebContainerRuntimeSnapshot {
    return {
      state: this.state,
      framework: this.framework,
      packageManager: this.packageManager,
      previewUrl: this.previewUrl,
      serverPort: this.serverPort,
      lastError: this.lastError,
      isIsolated: this.isCrossOriginIsolated(),
      isBooted: Boolean(this.instance),
    };
  }

  private notifySnapshot() {
    const snap = this.getSnapshot();
    this.snapshotListeners.forEach((fn) => {
      try {
        fn(snap);
      } catch (err) {
        console.error('[WebContainerManager] Snapshot listener error:', err);
      }
    });
  }

  public subscribeSnapshot(listener: (snap: WebContainerRuntimeSnapshot) => void): () => void {
    this.snapshotListeners.add(listener);
    listener(this.getSnapshot());
    return () => this.snapshotListeners.delete(listener);
  }

  public subscribeDevOutput(listener: (chunk: string) => void): () => void {
    this.devOutputListeners.add(listener);
    return () => this.devOutputListeners.delete(listener);
  }

  public subscribeShellOutput(listener: (chunk: string) => void): () => void {
    this.shellOutputListeners.add(listener);
    return () => this.shellOutputListeners.delete(listener);
  }

  public subscribeError(listener: (error: RuntimeErrorInfo) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private emitDevOutput(chunk: string) {
    this.devOutputListeners.forEach((fn) => {
      try {
        fn(chunk);
      } catch {}
    });
  }

  private emitShellOutput(chunk: string) {
    this.shellOutputListeners.forEach((fn) => {
      try {
        fn(chunk);
      } catch {}
    });
  }

  private emitError(error: RuntimeErrorInfo) {
    this.lastError = error;
    this.errorListeners.forEach((fn) => {
      try {
        fn(error);
      } catch {}
    });
    this.notifySnapshot();
  }

  private setState(newState: RuntimeState) {
    this.state = newState;
    this.notifySnapshot();
  }

  /**
   * Boots the singleton WebContainer instance once per browser session.
   */
  public async boot(): Promise<WebContainer | null> {
    if (typeof window === 'undefined') return null;
    if (this.instance) return this.instance;
    if (this.bootPromise) return this.bootPromise;

    if (!this.isCrossOriginIsolated()) {
      const msg = 'Cross-Origin Isolation is required for WebContainer SharedArrayBuffer.';
      console.warn('[WebContainerManager]', msg);
      this.setState('error');
      this.emitError({
        message: msg,
        raw: 'window.crossOriginIsolated is false. COOP/COEP headers required.',
      });
      return null;
    }

    this.setState('initializing');

    this.bootPromise = (async () => {
      try {
        const { WebContainer } = await import('@webcontainer/api');
        this.instance = await WebContainer.boot();
        this.setState('ready');

        // Global server-ready listener
        this.instance.on('server-ready', (port: number, url: string) => {
          this.serverPort = port;
          this.previewUrl = url;
          this.setState('running');
          this.emitDevOutput(`\r\n\x1b[1;35m✔ Server ready on port ${port}: ${url}\x1b[0m\r\n`);
          this.notifySnapshot();
        });

        // Initialize persistent shell process
        void this.initPersistentShell();

        return this.instance;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[WebContainerManager] Boot error:', error);
        this.setState('error');
        this.emitError({
          message: error.message || 'WebContainer boot failed',
          stack: error.stack,
        });
        this.bootPromise = null;
        return null;
      }
    })();

    return this.bootPromise;
  }

  /**
   * Initializes persistent interactive shell (jsh or sh)
   */
  public async initPersistentShell(): Promise<void> {
    if (!this.instance || this.shellProcess) return;

    try {
      const shell = await this.instance.spawn('jsh', {
        terminal: {
          cols: 80,
          rows: 24,
        },
      });

      this.shellProcess = shell;
      this.shellWriter = shell.input.getWriter();

      shell.output.pipeTo(
        new WritableStream({
          write: (data) => {
            this.emitShellOutput(data);
          },
        })
      );

      void shell.exit.then(() => {
        this.shellProcess = null;
        this.shellWriter = null;
        this.emitShellOutput('\r\n\x1b[90m[Shell session ended]\x1b[0m\r\n');
      });
    } catch (err) {
      console.warn('[WebContainerManager] Failed to start jsh persistent shell:', err);
    }
  }

  /**
   * Writes input directly to the persistent interactive shell
   */
  public writeShell(input: string): void {
    if (this.shellWriter) {
      try {
        void this.shellWriter.write(input);
      } catch (err) {
        console.warn('[WebContainerManager] Shell write error:', err);
      }
    }
  }

  /**
   * Resizes the terminal shell
   */
  public resizeShell(cols: number, rows: number): void {
    if (this.shellProcess?.resize) {
      try {
        this.shellProcess.resize({ cols, rows });
      } catch {}
    }
  }

  /**
   * Interrupts the active shell or dev process (Ctrl+C)
   */
  public sendInterrupt(): void {
    this.writeShell('\x03');
  }

  /**
   * Mounts complete project from Supabase files to WebContainer filesystem.
   */
  public async mountProject(files: ProjectFile[]): Promise<boolean> {
    const wc = await this.boot();
    if (!wc) return false;

    this.setState('mounting');
    this.emitDevOutput('\r\n\x1b[36m[WebContainer] Mounting project files to virtual filesystem…\x1b[0m\r\n');

    try {
      const tree = filesToFileSystemTree(files);
      await wc.mount(tree);

      const { framework } = detectFramework(files);
      const pm = detectPackageManager(files);
      this.framework = framework;
      this.packageManager = pm;

      this.setState('ready');
      this.emitDevOutput(
        `\x1b[32m✔ Project mounted (${files.length} files). Framework: ${framework.toUpperCase()} | PM: ${pm}\x1b[0m\r\n`
      );
      return true;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[WebContainerManager] Mount error:', error);
      this.setState('error');
      this.emitError({
        message: error.message || 'Failed to mount project',
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Hot file synchronization: writes/updates a single file directly into WebContainer.
   * Triggers HMR in the running dev server without a full project remount.
   */
  public async syncFile(path: string, content: string): Promise<boolean> {
    if (!this.instance) return false;

    try {
      const cleanPath = path.replace(/^\//, '');
      const parts = cleanPath.split('/');
      if (parts.length > 1) {
        const dir = parts.slice(0, -1).join('/');
        await this.instance.fs.mkdir(dir, { recursive: true });
      }
      await this.instance.fs.writeFile(cleanPath, content);
      return true;
    } catch (err) {
      console.warn(`[WebContainerManager] Failed to sync file ${path}:`, err);
      return false;
    }
  }

  /**
   * Deletes a file or directory in WebContainer.
   */
  public async removeFile(path: string): Promise<boolean> {
    if (!this.instance) return false;

    try {
      const cleanPath = path.replace(/^\//, '');
      await this.instance.fs.rm(cleanPath, { recursive: true, force: true });
      return true;
    } catch (err) {
      console.warn(`[WebContainerManager] Failed to remove file ${path}:`, err);
      return false;
    }
  }

  /**
   * Renames a file or directory in WebContainer.
   */
  public async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    if (!this.instance) return false;

    try {
      const cleanOld = oldPath.replace(/^\//, '');
      const cleanNew = newPath.replace(/^\//, '');
      const parts = cleanNew.split('/');
      if (parts.length > 1) {
        const dir = parts.slice(0, -1).join('/');
        await this.instance.fs.mkdir(dir, { recursive: true });
      }
      const content = await this.instance.fs.readFile(cleanOld, 'utf-8');
      await this.instance.fs.writeFile(cleanNew, content);
      await this.instance.fs.rm(cleanOld, { recursive: true, force: true });
      return true;
    } catch (err) {
      console.warn(`[WebContainerManager] Failed to rename ${oldPath} to ${newPath}:`, err);
      return false;
    }
  }

  /**
   * Installs project dependencies using detected package manager,
   * respecting dependency fingerprinting so unchanged dependencies are skipped.
   */
  public async installDependencies(files: ProjectFile[], force = false): Promise<boolean> {
    const wc = await this.boot();
    if (!wc) return false;

    const currentFingerprint = calculateDependencyFingerprint(files);
    if (!force && this.lastInstalledFingerprint && this.lastInstalledFingerprint === currentFingerprint) {
      this.emitDevOutput('\x1b[90m[WebContainer] Dependency fingerprint unchanged. Skipping install.\x1b[0m\r\n');
      return true;
    }

    const pm = detectPackageManager(files);
    this.packageManager = pm;
    this.setState('installing');

    this.emitDevOutput(`\r\n\x1b[1;34m$ ${pm} install\x1b[0m\r\n`);

    try {
      const installProcess = await wc.spawn(pm, ['install']);

      installProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            this.emitDevOutput(data);
          },
        })
      );

      const exitCode = await installProcess.exit;
      if (exitCode !== 0) {
        const errStr = `${pm} install failed with exit code ${exitCode}`;
        this.emitDevOutput(`\r\n\x1b[31m[WebContainer] ${errStr}\x1b[0m\r\n`);
        this.setState('error');
        this.emitError({ message: errStr });
        return false;
      }

      this.lastInstalledFingerprint = currentFingerprint;
      this.emitDevOutput(`\r\n\x1b[32m✔ Dependencies successfully installed.\x1b[0m\r\n`);
      this.setState('ready');
      return true;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[WebContainerManager] Install error:', error);
      this.setState('error');
      this.emitError({
        message: error.message || 'Dependency installation failed',
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Starts the development server using detected framework and package manager.
   */
  public async startDevServer(files: ProjectFile[]): Promise<boolean> {
    const wc = await this.boot();
    if (!wc) return false;

    if (this.devProcess) {
      try {
        this.devProcess.kill();
      } catch {}
      this.devProcess = null;
    }

    const { framework, devCommand } = detectFramework(files);
    const pm = detectPackageManager(files);
    this.framework = framework;
    this.packageManager = pm;

    this.setState('starting');

    const cmd = pm === 'pnpm' || pm === 'yarn' ? pm : devCommand.cmd;
    const args = pm === 'pnpm' || pm === 'yarn' ? ['dev'] : devCommand.args;

    this.emitDevOutput(`\r\n\x1b[1;32m$ ${cmd} ${args.join(' ')}\x1b[0m\r\n`);

    try {
      const devProcess = await wc.spawn(cmd, args);
      this.devProcess = devProcess;

      devProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            this.emitDevOutput(data);

            if (
              data.includes('Error:') ||
              data.includes('Failed to compile') ||
              data.includes('SyntaxError') ||
              data.includes('TypeError')
            ) {
              const lines = data.split('\n');
              const errorLine = lines.find((l: string) => l.includes('Error:') || l.includes('Failed to compile')) || lines[0];
              this.emitError({
                message: errorLine.trim().slice(0, 300),
                raw: data.slice(0, 800),
              });
            }
          },
        })
      );

      void devProcess.exit.then((code: number) => {
        this.emitDevOutput(`\r\n\x1b[90m[dev server exited with code ${code}]\x1b[0m\r\n`);
        this.devProcess = null;
        if (this.state === 'running' || this.state === 'starting') {
          this.setState('stopped');
        }
      });

      return true;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[WebContainerManager] Dev server spawn error:', error);
      this.setState('error');
      this.emitError({
        message: error.message || 'Failed to start development server',
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * Complete automated workflow:
   * Mount -> Install (if changed) -> Start Dev Server
   */
  public async runProject(files: ProjectFile[], forceInstall = false): Promise<boolean> {
    const wc = await this.boot();
    if (!wc) return false;

    const mounted = await this.mountProject(files);
    if (!mounted) return false;

    const hasPkg = files.some((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));
    if (hasPkg) {
      const installed = await this.installDependencies(files, forceInstall);
      if (!installed) return false;
    }

    return this.startDevServer(files);
  }

  /**
   * Restarts the development server
   */
  public async restartDevServer(files: ProjectFile[]): Promise<boolean> {
    return this.startDevServer(files);
  }

  /**
   * Clean up runtime processes
   */
  public stopAll(): void {
    if (this.devProcess) {
      try {
        this.devProcess.kill();
      } catch {}
      this.devProcess = null;
    }
    if (this.shellProcess) {
      try {
        this.shellProcess.kill();
      } catch {}
      this.shellProcess = null;
      this.shellWriter = null;
    }
    this.setState('stopped');
  }
}

// Global Singleton Instance
export const webcontainerManager = new WebContainerRuntimeManager();
