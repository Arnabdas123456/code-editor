'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Rocket, ChevronRight, ChevronDown, FileCode, Folder, Sparkles, Loader as Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function EditorPage() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    app: true,
    components: false,
    api: false,
  });

  const fileTree = [
    {
      type: 'folder',
      name: 'app',
      children: [
        { type: 'file', name: 'page.tsx' },
        { type: 'file', name: 'layout.tsx' },
        { type: 'file', name: 'globals.css' },
      ],
    },
    {
      type: 'folder',
      name: 'components',
      children: [
        { type: 'file', name: 'navbar.tsx' },
        { type: 'file', name: 'footer.tsx' },
        { type: 'file', name: 'button.tsx' },
      ],
    },
    {
      type: 'folder',
      name: 'api',
      children: [
        { type: 'file', name: 'route.ts' },
        { type: 'file', name: 'auth.ts' },
      ],
    },
    { type: 'file', name: 'package.json' },
    { type: 'file', name: 'tsconfig.json' },
  ];

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white flex flex-col">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAyIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40 -z-10" />

      <header className="border-b border-white/5 bg-[#0a0a12]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">My AI Project</h1>
              <p className="text-xs text-gray-400">Untitled Project</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-white/10 hover:bg-white/5"
              size="sm"
            >
              <Play className="w-4 h-4 mr-2" />
              Run
            </Button>
            <Button
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              size="sm"
            >
              <Rocket className="w-4 h-4 mr-2" />
              Deploy
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-white/5 bg-[#0a0a12] overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
              Project Files
            </h2>

            <div className="space-y-1">
              {fileTree.map((item, index) => (
                <div key={index}>
                  {item.type === 'folder' ? (
                    <div>
                      <button
                        onClick={() => toggleFolder(item.name)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded text-sm transition-colors"
                      >
                        {expandedFolders[item.name] ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <Folder className="w-4 h-4 text-blue-400" />
                        <span>{item.name}</span>
                      </button>

                      {expandedFolders[item.name] && item.children && (
                        <div className="ml-6 space-y-1 mt-1">
                          {item.children.map((child, childIndex) => (
                            <button
                              key={childIndex}
                              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded text-sm transition-colors"
                            >
                              <FileCode className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-300">{child.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded text-sm transition-colors">
                      <FileCode className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-300">{item.name}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">AI Prompt Editor</h2>
                <p className="text-gray-400">
                  Describe what you want to build and let AI generate the code
                </p>
              </div>

              <div className="relative">
                <Textarea
                  placeholder="Describe what you want to build...&#10;&#10;Example: Create a landing page with a hero section, features grid, and pricing cards. Use a dark theme with blue accents."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[300px] bg-[#1a1a2e]/50 border-white/10 focus:border-blue-500/50 backdrop-blur-xl text-lg resize-none"
                />

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="mt-4 w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate Project
                    </>
                  )}
                </Button>
              </div>

              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20"
                >
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    <div>
                      <p className="font-medium text-blue-400">AI is working...</p>
                      <p className="text-sm text-gray-400">
                        Analyzing your requirements and generating code
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </main>

        <aside className="w-96 border-l border-white/5 bg-[#0a0a12] flex flex-col">
          <Tabs defaultValue="preview" className="flex-1 flex flex-col">
            <TabsList className="w-full bg-transparent border-b border-white/5 rounded-none p-0">
              <TabsTrigger
                value="code"
                className="flex-1 rounded-none data-[state=active]:bg-white/5 data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
              >
                Code
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="flex-1 rounded-none data-[state=active]:bg-white/5 data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
              >
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="code" className="flex-1 p-4 mt-0 overflow-auto">
              <div className="bg-[#1a1a2e]/50 rounded-lg p-4 font-mono text-sm">
                <div className="text-gray-400">
                  <div className="text-purple-400">import</div> {'{'} useState {'}'}{' '}
                  <div className="text-purple-400 inline">from</div>{' '}
                  <div className="text-green-400 inline">'react'</div>;
                  <br />
                  <br />
                  <div className="text-purple-400 inline">export default function</div>{' '}
                  <div className="text-yellow-400 inline">Component</div>() {'{'}
                  <br />
                  {'  '}
                  <div className="text-purple-400 inline">return</div> (
                  <br />
                  {'    '}&lt;<div className="text-blue-400 inline">div</div>&gt;
                  <br />
                  {'      '}Generated code will appear here
                  <br />
                  {'    '}&lt;/<div className="text-blue-400 inline">div</div>&gt;
                  <br />
                  {'  '});
                  <br />
                  {'}'}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 p-4 mt-0 overflow-auto">
              <div className="bg-white rounded-lg h-full flex items-center justify-center text-gray-800">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-blue-600" />
                  </div>
                  <p className="text-gray-600">Your generated UI will appear here</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
