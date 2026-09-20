import type { ProjectFile } from '@/lib/types/database';

export interface PreviewFile {
  code: string;
  active?: boolean;
  hidden?: boolean;
}

export interface NextJsDetection {
  api: string;
  path: string;
  handled: boolean;
  message: string;
}

export interface SandpackAdapterResult {
  /** The files dictionary passed directly to SandpackProvider files prop */
  sandpackFiles: Record<string, PreviewFile>;
  /** The entry point file in Sandpack (e.g. '/src/App.tsx') */
  entryPath: string;
  /** Extra dependencies needed by the preview runtime */
  dependencies: Record<string, string>;
  /** Detections of Next.js imports and whether they are shimmed or unsupported */
  nextJsDetections: NextJsDetection[];
  /** Errors that prevent preview from running at all (e.g. no entry page found) */
  adapterError: string | null;
  /** Whether Tailwind was detected and configured in the preview environment */
  hasTailwind: boolean;
}

// -----------------------------------------------------------------------------
// Isolated Next.js Shims (Injected only into Sandpack virtual filesystem)
// -----------------------------------------------------------------------------

const SHIM_NEXT_LINK = `
import React from 'react';

export function Link({ href, children, className, onClick, ...rest }: any) {
  return (
    <a
      href={href || '#'}
      className={className}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (!href || href.startsWith('#') || !href.startsWith('http')) {
          e.preventDefault();
          console.log('[Preview Navigation] Clicked Link to:', href);
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export default Link;
`;

const SHIM_NEXT_IMAGE = `
import React from 'react';

export function Image({ src, alt, width, height, className, fill, style, priority, ...rest }: any) {
  const imgSrc = typeof src === 'object' && src !== null ? (src.src || '') : (src || '');
  const combinedStyle = fill
    ? { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }
    : style;

  return (
    <img
      src={imgSrc}
      alt={alt || ''}
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      className={className}
      style={combinedStyle}
      loading={priority ? 'eager' : 'lazy'}
      {...rest}
    />
  );
}

export default Image;
`;

const SHIM_NEXT_NAVIGATION = `
export function useRouter() {
  return {
    push: (url: string) => console.log('[Preview Router.push]:', url),
    replace: (url: string) => console.log('[Preview Router.replace]:', url),
    back: () => console.log('[Preview Router.back]'),
    forward: () => console.log('[Preview Router.forward]'),
    refresh: () => console.log('[Preview Router.refresh]'),
    prefetch: () => {},
  };
}

export function usePathname() {
  return '/';
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}

export function redirect(url: string) {
  console.log('[Preview redirect]:', url);
}

export function notFound() {
  console.warn('[Preview notFound() invoked]');
}
`;

const SHIM_NEXT_ROUTER = `
export function useRouter() {
  return {
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: (url: string) => console.log('[Preview Router.push]:', url),
    replace: (url: string) => console.log('[Preview Router.replace]:', url),
    reload: () => console.log('[Preview Router.reload]'),
    back: () => console.log('[Preview Router.back]'),
    prefetch: () => Promise.resolve(),
    events: {
      on: () => {},
      off: () => {},
      emit: () => {},
    },
  };
}

export function withRouter(Component: any) {
  return function WithRouterWrapper(props: any) {
    return <Component {...props} router={useRouter()} />;
  };
}

export default { useRouter, withRouter };
`;

const SHIM_NEXT_FONT = `
export function Inter() {
  return { className: 'font-sans', variable: '--font-inter', style: { fontFamily: 'sans-serif' } };
}
export function Roboto() {
  return { className: 'font-sans', variable: '--font-roboto', style: { fontFamily: 'sans-serif' } };
}
export function Poppins() {
  return { className: 'font-sans', variable: '--font-poppins', style: { fontFamily: 'sans-serif' } };
}
export default function fontLoader() {
  return { className: 'font-sans', variable: '--font-sans', style: { fontFamily: 'sans-serif' } };
}
`;

const PREVIEW_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Live Preview</title>
    <!-- Tailwind Play CDN for isolated preview styling -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              border: "hsl(var(--border, 217.2 32.6% 17.5%))",
              input: "hsl(var(--input, 217.2 32.6% 17.5%))",
              ring: "hsl(var(--ring, 224.3 76.3% 48%))",
              background: "hsl(var(--background, 222.2 84% 4.9%))",
              foreground: "hsl(var(--foreground, 210 40% 98%))",
              primary: {
                DEFAULT: "hsl(var(--primary, 221.2 83.2% 53.3%))",
                foreground: "hsl(var(--primary-foreground, 210 40% 98%))",
              },
            }
          }
        }
      }
    </script>
    <style>
      /* Ensure root takes full preview frame */
      html, body, #root {
        height: 100%;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body class="bg-[#0f0f1a] text-white antialiased">
    <div id="root"></div>
  </body>
</html>`;

// -----------------------------------------------------------------------------
// Preview Adapter Core
// -----------------------------------------------------------------------------

/**
 * Transforms stored project_files into a self-contained Sandpack virtual bundle.
 * Isolates preview compatibility transformations in memory without mutating stored files.
 */
export function buildSandpackBundle(
  projectFiles: ProjectFile[],
  projectDependencies: Array<{ name: string; version: string }> = []
): SandpackAdapterResult {
  const sourceFiles = projectFiles.filter((file) => !file.is_folder);
  const sandpackFiles: Record<string, PreviewFile> = {};
  const nextJsDetections: NextJsDetection[] = [];

  // 1. Locate the entry page
  const pageFile =
    sourceFiles.find((f) => f.path === 'app/page.tsx' || f.path === 'app/page.jsx') ??
    sourceFiles.find((f) => f.path === 'pages/index.tsx' || f.path === 'pages/index.jsx') ??
    sourceFiles.find((f) => /\.(tsx|jsx)$/.test(f.path) && !f.path.includes('layout') && !f.path.includes('api/'));

  if (!pageFile) {
    return {
      sandpackFiles: {},
      entryPath: '',
      dependencies: {},
      nextJsDetections: [],
      adapterError: 'No entry page found (e.g. app/page.tsx). Create app/page.tsx to start the live preview.',
      hasTailwind: false,
    };
  }

  // 2. Check for globals.css and Tailwind usage
  const globalsFile = sourceFiles.find(
    (f) => f.path === 'app/globals.css' || f.path === 'globals.css' || f.path.endsWith('globals.css')
  );
  const hasTailwind = Boolean(
    globalsFile?.content.includes('tailwindcss') ||
    sourceFiles.some((f) => f.content.includes('className='))
  );

  // 3. Inject Next.js Virtual Shims into Sandpack
  sandpackFiles['/src/_shims/next-link.tsx'] = { code: SHIM_NEXT_LINK, hidden: true };
  sandpackFiles['/src/_shims/next-image.tsx'] = { code: SHIM_NEXT_IMAGE, hidden: true };
  sandpackFiles['/src/_shims/next-navigation.ts'] = { code: SHIM_NEXT_NAVIGATION, hidden: true };
  sandpackFiles['/src/_shims/next-router.ts'] = { code: SHIM_NEXT_ROUTER, hidden: true };
  sandpackFiles['/src/_shims/next-font.ts'] = { code: SHIM_NEXT_FONT, hidden: true };

  // 4. Inject Preview HTML with Tailwind CDN
  sandpackFiles['/public/index.html'] = { code: PREVIEW_HTML, hidden: true };

  // 5. Transform and map each source file into Sandpack's /src/ hierarchy
  for (const file of sourceFiles) {
    if (file.path === 'package.json' || file.path.startsWith('app/api/')) {
      continue;
    }

    const previewPath = `/src/${file.path}`;
    const { transformedCode, detections } = transformFileForPreview(
      file.path,
      file.content
    );

    nextJsDetections.push(...detections);
    sandpackFiles[previewPath] = { code: transformedCode };
  }

  // 6. Generate the React preview entrypoint (/src/App.tsx)
  const relativePageImport = `./${pageFile.path.replace(/\.(tsx|jsx|ts|js)$/, '')}`;
  const globalsImport = globalsFile ? `import './${globalsFile.path}';` : '';

  sandpackFiles['/src/App.tsx'] = {
    code: `import React, { Component, ErrorInfo, ReactNode } from 'react';
${globalsImport}
import PageComponent from '${relativePageImport}';

class PreviewErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Preview Runtime Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', background: '#13111c', color: '#f87171', minHeight: '100vh', boxSizing: 'border-box' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>⚠️ Live Preview Runtime Error</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 12px 0' }}>
            An unhandled error occurred while executing your component. Use <strong>Fix with AI</strong> to diagnose and repair.
          </p>
          <pre style={{ background: '#0a090f', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '14px', borderRadius: '8px', overflow: 'auto', fontSize: '12px', lineHeight: '1.6', color: '#fca5a5' }}>
            {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <PreviewErrorBoundary>
      <PageComponent />
    </PreviewErrorBoundary>
  );
}
`,
    active: true,
  };

  // 7. Resolve dependencies
  const approvedDeps: Record<string, string> = {
    'lucide-react': 'latest',
  };

  for (const dep of projectDependencies) {
    if (['lucide-react', 'framer-motion', 'date-fns', 'clsx', 'tailwind-merge'].includes(dep.name)) {
      approvedDeps[dep.name] = dep.version || 'latest';
    }
  }

  return {
    sandpackFiles,
    entryPath: '/src/App.tsx',
    dependencies: approvedDeps,
    nextJsDetections,
    adapterError: null,
    hasTailwind,
  };
}

// -----------------------------------------------------------------------------
// Isolated Code Transformer (In-Memory Only)
// -----------------------------------------------------------------------------

function transformFileForPreview(filePath: string, rawCode: string): {
  transformedCode: string;
  detections: NextJsDetection[];
} {
  const detections: NextJsDetection[] = [];
  let code = rawCode;

  // Calculate relative path from this file to /src/
  // E.g. app/page.tsx -> depth 1 -> ../
  // E.g. components/ui/button.tsx -> depth 2 -> ../../
  const pathSegments = filePath.split('/');
  const depth = pathSegments.length - 1;
  const rootRelativePrefix = depth === 0 ? './' : '../'.repeat(depth);

  // Strip 'use client' or 'use server' directives
  code = code.replace(/^\s*['"]use (client|server)['"];?\s*/m, '');

  // 1. Sanitize CSS files:
  // In Tailwind v4, `@import "tailwindcss";` causes 404 in Sandpack's browser iframe.
  // We safely remove it for the preview copy since Tailwind Play CDN already loads the full stylesheet.
  if (filePath.endsWith('.css')) {
    code = code.replace(/@import\s+['"]tailwindcss['"];?/g, '/* Tailwind loaded via Preview CDN */');
  }

  // 2. Detect and shim Next.js APIs:
  // next/link
  if (/from\s+['"]next\/link['"]/.test(code)) {
    detections.push({
      api: 'next/link',
      path: filePath,
      handled: true,
      message: 'Shimmed Next.js Link with preview interactive anchor',
    });
    code = code.replace(/from\s+['"]next\/link['"]/g, `from '${rootRelativePrefix}_shims/next-link'`);
  }

  // next/image
  if (/from\s+['"]next\/image['"]/.test(code)) {
    detections.push({
      api: 'next/image',
      path: filePath,
      handled: true,
      message: 'Shimmed Next.js Image with standard HTML img element',
    });
    code = code.replace(/from\s+['"]next\/image['"]/g, `from '${rootRelativePrefix}_shims/next-image'`);
  }

  // next/navigation
  if (/from\s+['"]next\/navigation['"]/.test(code)) {
    detections.push({
      api: 'next/navigation',
      path: filePath,
      handled: true,
      message: 'Shimmed Next.js navigation hooks (useRouter, usePathname, etc.)',
    });
    code = code.replace(/from\s+['"]next\/navigation['"]/g, `from '${rootRelativePrefix}_shims/next-navigation'`);
  }

  // next/router
  if (/from\s+['"]next\/router['"]/.test(code)) {
    detections.push({
      api: 'next/router',
      path: filePath,
      handled: true,
      message: 'Shimmed Pages router hooks (useRouter)',
    });
    code = code.replace(/from\s+['"]next\/router['"]/g, `from '${rootRelativePrefix}_shims/next-router'`);
  }

  // next/font (google or local)
  if (/from\s+['"]next\/font\/(google|local)['"]/.test(code)) {
    detections.push({
      api: 'next/font',
      path: filePath,
      handled: true,
      message: 'Shimmed Next.js font loader with standard web fonts',
    });
    code = code.replace(/from\s+['"]next\/font\/(google|local)['"]/g, `from '${rootRelativePrefix}_shims/next-font'`);
  }

  // Unsupported server-only Next.js APIs:
  const serverApis = ['next/headers', 'next/server', 'next/cache', 'next/og'];
  for (const serverApi of serverApis) {
    if (new RegExp(`from\\s+['"]${serverApi.replace('/', '\\/')}['"]`).test(code)) {
      detections.push({
        api: serverApi,
        path: filePath,
        handled: false,
        message: `Server-only API (${serverApi}) detected in preview component. May cause preview errors.`,
      });
    }
  }

  // 3. Resolve @/ aliases to correct relative paths in Sandpack:
  // e.g. In app/page.tsx: from '@/components/navbar' -> from '../components/navbar'
  // e.g. In components/card.tsx: from '@/lib/utils' -> from '../lib/utils'
  code = code.replace(/from\s+['"]@\/(.*?)['"]/g, (_match, subPath) => {
    return `from '${rootRelativePrefix}${subPath}'`;
  });

  code = code.replace(/import\s+['"]@\/(.*?)['"]/g, (_match, subPath) => {
    return `import '${rootRelativePrefix}${subPath}'`;
  });

  return { transformedCode: code, detections };
}
