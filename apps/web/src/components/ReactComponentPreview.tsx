'use client';

import { useEffect, useMemo, useState } from 'react';

type SampleCase = {
  id?: string;
  name?: string;
  input: string;
};

type HarnessInput = {
  exportName?: string;
  props?: Record<string, unknown>;
  assertions?: unknown[];
};

function parseHarnessInput(raw: string | null | undefined): HarnessInput | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as HarnessInput;
  } catch {
    return null;
  }
}

/** Strip ESM so Babel can run the snippet as a classic script with React globals. */
export function prepareUserSourceForPreview(source: string): string {
  return source
    .replace(/^\s*import\s+[^;]+;?\s*$/gm, '')
    .replace(/export\s+default\s+/g, '')
    .replace(/export\s+(function|const|class|let|var)\s+/g, '$1 ')
    .replace(/export\s*\{[^}]+\}\s*;?/g, '')
    .trim();
}

function buildSrcDoc(source: string, exportName: string, props: Record<string, unknown>): string {
  const prepared = prepareUserSourceForPreview(source);
  const propsJson = JSON.stringify(props ?? {});
  const exportJson = JSON.stringify(exportName || 'default');
  const declaredNames = Array.from(
    prepared.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_][A-Za-z0-9_]*)/g),
  ).map((m) => m[1]);
  const namesJson = JSON.stringify(Array.from(new Set(declaredNames)));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: system-ui, sans-serif; }
    #root { padding: 16px; min-height: 80px; }
    #error {
      display: none; margin: 12px; padding: 10px 12px; border-radius: 6px;
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px;
      white-space: pre-wrap;
    }
  </style>
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.26.9/babel.min.js"></script>
</head>
<body>
  <div id="error"></div>
  <div id="root"></div>
  <script>
    (function () {
      var errorEl = document.getElementById('error');
      function showError(err) {
        errorEl.style.display = 'block';
        errorEl.textContent = (err && err.stack) ? err.stack : String(err);
        document.getElementById('root').innerHTML = '';
      }
      window.addEventListener('error', function (e) { showError(e.error || e.message); });

      try {
        var userSource = ${JSON.stringify(prepared)};
        var props = ${propsJson};
        var exportName = ${exportJson};
        var declaredNames = ${namesJson};

        var transformed = Babel.transform(userSource, {
          presets: [['react', { runtime: 'classic' }]],
          filename: 'UserComponent.jsx'
        }).code;

        var module = { exports: {} };
        var exports = module.exports;
        var directAssign = declaredNames.map(function (n) {
          return 'try { if (typeof ' + n + ' !== "undefined") module.exports[' + JSON.stringify(n) + '] = ' + n + '; } catch (e) {}';
        }).join('\\n');
        var wrapper = transformed + '\\n' + directAssign + '\\nreturn module.exports;';

        var fn = new Function('React', 'ReactDOM', 'module', 'exports', 'require', wrapper);
        var exported = fn(React, ReactDOM, module, exports, function () {
          throw new Error('Imports are not available in the preview sandbox.');
        }) || module.exports;

        var Component =
          (exportName && exportName !== 'default' && exported[exportName]) ||
          exported.default ||
          exported[Object.keys(exported).find(function (k) { return typeof exported[k] === 'function'; })] ||
          (typeof exported === 'function' ? exported : null);

        if (!Component) {
          throw new Error('Could not find component "' + exportName + '". Export it with export function / export default.');
        }

        var root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Component, props));
      } catch (err) {
        showError(err);
      }
    })();
  </script>
</body>
</html>`;
}

type ReactComponentPreviewProps = {
  sourceCode: string;
  sampleInput?: string | null;
  sampleTestCases?: SampleCase[];
};

export function ReactComponentPreview({
  sourceCode,
  sampleInput,
  sampleTestCases,
}: ReactComponentPreviewProps) {
  const cases = useMemo(() => {
    const list: Array<{ label: string; harness: HarnessInput }> = [];
    if (sampleTestCases?.length) {
      sampleTestCases.forEach((tc, i) => {
        const harness = parseHarnessInput(tc.input);
        if (harness) list.push({ label: tc.name || `Sample ${i + 1}`, harness });
      });
    }
    if (list.length === 0) {
      const harness = parseHarnessInput(sampleInput);
      if (harness) list.push({ label: 'Sample', harness });
    }
    if (list.length === 0) {
      list.push({ label: 'Empty props', harness: { exportName: 'default', props: {} } });
    }
    return list;
  }, [sampleInput, sampleTestCases]);

  const [caseIndex, setCaseIndex] = useState(0);
  const [srcDoc, setSrcDoc] = useState('');
  const [busy, setBusy] = useState(false);

  const active = cases[Math.min(caseIndex, cases.length - 1)]!;

  useEffect(() => {
    setBusy(true);
    const timer = window.setTimeout(() => {
      const exportName = active.harness.exportName || 'default';
      const props = (active.harness.props || {}) as Record<string, unknown>;
      setSrcDoc(buildSrcDoc(sourceCode, exportName, props));
      setBusy(false);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [sourceCode, active]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <span style={{ color: '#9ca3af', fontSize: 12 }}>Props from</span>
        <select
          value={Math.min(caseIndex, cases.length - 1)}
          onChange={(e) => setCaseIndex(Number(e.target.value))}
          style={{
            background: '#3c3c3c',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 12,
          }}
        >
          {cases.map((c, i) => (
            <option key={`${c.label}-${i}`} value={i}>
              {c.label}
            </option>
          ))}
        </select>
        {busy && <span style={{ color: '#6b7280', fontSize: 12 }}>Updating…</span>}
        <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 'auto' }}>
          Live preview (browser sandbox — not the Docker judge)
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 160,
          height: 180,
          border: '1px solid #3e3e42',
          borderRadius: 6,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <iframe
          title="React UI preview"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          style={{ width: '100%', height: '100%', minHeight: 160, border: 'none', background: '#fff' }}
        />
      </div>

      <pre
        style={{
          marginTop: 8,
          marginBottom: 0,
          maxHeight: 72,
          overflow: 'auto',
          background: '#252526',
          border: '1px solid #3e3e42',
          borderRadius: 4,
          padding: '6px 8px',
          color: '#9cdcfe',
          fontSize: 11,
        }}
      >
        {JSON.stringify(
          { exportName: active.harness.exportName || 'default', props: active.harness.props || {} },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
