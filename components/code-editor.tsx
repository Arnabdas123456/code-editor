"use client";

import Editor from "@monaco-editor/react";

type CodeEditorProps = {
  path?: string;
  value: string;
  language: string;
  onChange: (value: string) => void;
  onSelectionChange?: (value: string) => void;
};

function getMonacoLanguage(language: string) {
  switch (language.toLowerCase()) {
    case "typescript":
    case "tsx":
      return "typescript";
    case "javascript":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
      return "html";
    case "markdown":
      return "markdown";
    default:
      return "plaintext";
  }
}

export default function CodeEditor({ path, value, language, onChange, onSelectionChange }: CodeEditorProps) {
  return (
    <div className="h-full w-full flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#121324]">
      <Editor
        height="100%"
        path={path}
        language={getMonacoLanguage(language)}
        theme="vs-dark"
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        onMount={(editor) => {
          editor.onDidChangeCursorSelection(() => {
            const selection = editor.getSelection();
            onSelectionChange?.(selection ? editor.getModel()?.getValueInRange(selection) ?? '' : '');
          });
        }}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineHeight: 21,
          padding: { top: 14, bottom: 14 },
          scrollBeyondLastLine: false,
          roundedSelection: false,
          tabSize: 2,
          wordWrap: "on",
          suggest: { showMethods: true, showFunctions: true },
        }}
      />
    </div>
  );
}
