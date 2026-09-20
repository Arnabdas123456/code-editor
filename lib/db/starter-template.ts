export interface StarterFile {
  name: string;
  path: string;
  content: string;
  language: string;
  isFolder: boolean;
}

export function getDefaultProjectFiles(projectName: string, prompt?: string): StarterFile[] {
  const sanitizedName = projectName.trim() || 'My AI Project';
  const promptComment = prompt ? `\n// Generated based on prompt: "${prompt}"\n` : '';

  return [
    {
      name: 'app',
      path: 'app',
      content: '',
      language: 'folder',
      isFolder: true,
    },
    {
      name: 'page.tsx',
      path: 'app/page.tsx',
      content: `'use client';
${promptComment}
import React from 'react';
import { Sparkles, Code2, Rocket, Zap } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
          <Sparkles className="w-4 h-4" />
          <span>${sanitizedName}</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
          Welcome to ${sanitizedName}
        </h1>

        <p className="text-gray-400 text-lg sm:text-xl max-w-xl mx-auto">
          AI-generated Next.js project with Tailwind CSS, React 19, and full Supabase persistence.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          <div className="p-6 rounded-2xl bg-[#1a1a2e]/60 border border-white/10 hover:border-blue-500/40 transition">
            <Code2 className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="font-semibold text-lg">Clean Code</h3>
            <p className="text-sm text-gray-400 mt-1">Modular components structured for scalability.</p>
          </div>
          <div className="p-6 rounded-2xl bg-[#1a1a2e]/60 border border-white/10 hover:border-purple-500/40 transition">
            <Zap className="w-8 h-8 text-purple-400 mb-3" />
            <h3 className="font-semibold text-lg">Instant Preview</h3>
            <p className="text-sm text-gray-400 mt-1">Real-time reactive updates as you edit.</p>
          </div>
          <div className="p-6 rounded-2xl bg-[#1a1a2e]/60 border border-white/10 hover:border-indigo-500/40 transition">
            <Rocket className="w-8 h-8 text-indigo-400 mb-3" />
            <h3 className="font-semibold text-lg">Production Ready</h3>
            <p className="text-sm text-gray-400 mt-1">Backed by Supabase database & authentication.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
`,
      language: 'typescript',
      isFolder: false,
    },
    {
      name: 'layout.tsx',
      path: 'app/layout.tsx',
      content: `import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '${sanitizedName}',
  description: 'Built with AI Code Editor and Supabase',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0f0f1a] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
`,
      language: 'typescript',
      isFolder: false,
    },
    {
      name: 'globals.css',
      path: 'app/globals.css',
      content: `@import "tailwindcss";

@layer base {
  body {
    background-color: #0f0f1a;
    color: #ffffff;
    font-family: system-ui, -apple-system, sans-serif;
  }
}
`,
      language: 'css',
      isFolder: false,
    },
    {
      name: 'components',
      path: 'components',
      content: '',
      language: 'folder',
      isFolder: true,
    },
    {
      name: 'navbar.tsx',
      path: 'components/navbar.tsx',
      content: `'use client';

import React from 'react';
import Link from 'next/link';

export function Navbar() {
  return (
    <header className="w-full border-b border-white/10 bg-[#0a0a12]/80 backdrop-blur px-6 py-4 flex items-center justify-between">
      <div className="font-bold text-lg text-white">${sanitizedName}</div>
      <nav className="flex items-center gap-4 text-sm text-gray-300">
        <Link href="#features" className="hover:text-white transition">Features</Link>
        <Link href="#about" className="hover:text-white transition">About</Link>
      </nav>
    </header>
  );
}
`,
      language: 'typescript',
      isFolder: false,
    },
    {
      name: 'package.json',
      path: 'package.json',
      content: JSON.stringify(
        {
          name: sanitizedName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          version: '0.1.0',
          private: true,
          dependencies: {
            next: '^16.0.0',
            react: '^19.0.0',
            'react-dom': '^19.0.0',
            'lucide-react': '^0.400.0',
          },
        },
        null,
        2
      ),
      language: 'json',
      isFolder: false,
    },
  ];
}
