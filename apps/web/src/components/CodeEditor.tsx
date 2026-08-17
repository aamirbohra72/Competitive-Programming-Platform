'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CodeEditorProps {
  language: string;
  value: string;
  onChange: (value: string) => void;
  height?: string;
  theme?: 'vs-dark' | 'light';
}

export function CodeEditor({ language, value, onChange, height = '500px', theme = 'vs-dark' }: CodeEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{
          height,
          background: theme === 'vs-dark' ? '#1e1e1e' : '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
        }}
      >
        Loading editor...
      </div>
    );
  }

  const editorLanguage = language === 'javascript' ? 'javascript' : language === 'python' ? 'python' : language === 'java' ? 'java' : language === 'cpp' ? 'cpp' : 'javascript';

  return (
    <MonacoEditor
      height={height}
      language={editorLanguage}
      value={value}
      onChange={(val) => onChange(val || '')}
      theme={theme}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        lineNumbers: 'on',
        roundedSelection: false,
        cursorStyle: 'line',
        readOnly: false,
      }}
    />
  );
}


