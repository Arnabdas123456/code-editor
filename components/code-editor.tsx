"use client";

import React, { useRef, useEffect } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import type * as monacoType from "monaco-editor";

type CodeEditorProps = {
  path?: string;
  value: string;
  language: string;
  onChange: (value: string) => void;
  onSelectionChange?: (value: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  onSave?: () => void;
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

export default function CodeEditor({
  path,
  value,
  language,
  onChange,
  onSelectionChange,
  onCursorChange,
  onSave,
}: CodeEditorProps) {
  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    const handleLayout = () => {
      editorRef.current?.layout();
    };
    window.addEventListener("resize", handleLayout);
    window.addEventListener("monaco-layout", handleLayout);
    return () => {
      window.removeEventListener("resize", handleLayout);
      window.removeEventListener("monaco-layout", handleLayout);
    };
  }, []);

  const handleEditorMount = (
    editor: monacoType.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;

    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      onSelectionChange?.(
        selection ? editor.getModel()?.getValueInRange(selection) ?? "" : ""
      );
    });

    editor.onDidChangeCursorPosition((e) => {
      onCursorChange?.(e.position.lineNumber, e.position.column);
    });

    // Monaco shortcut for Cmd+S / Ctrl+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    // Initial layout recalculation
    editor.layout();
  };

  return (
    <div className="h-full w-full flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#121324]">
      <Editor
        height="100%"
        path={path}
        language={getMonacoLanguage(language)}
        theme="vs-dark"
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        onMount={handleEditorMount}
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
