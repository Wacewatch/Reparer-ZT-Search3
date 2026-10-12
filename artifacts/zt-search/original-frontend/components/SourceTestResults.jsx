import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function SourceTestResults({ results }) {
  if (!results) return null;
  if (!results.length) {
    return <p data-testid="source-test-empty" className="text-xs text-[#64748b]">Aucune source configurée.</p>;
  }
  return (
    <div data-testid="source-test-results" className="space-y-1.5">
      {results.map((r, i) => (
        <div key={i} data-testid={`source-test-row-${i}`}
             className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${r.ok ? 'border-[#22c55e]/30 bg-[#22c55e]/5' : 'border-[#ef4444]/30 bg-[#ef4444]/5'}`}>
          {r.ok ? <CheckCircle2 size={14} className="text-[#22c55e] shrink-0" /> : <XCircle size={14} className="text-[#ef4444] shrink-0" />}
          <span className="font-mono text-[#cbd5e1] truncate flex-1">{r.source}</span>
          <span className="font-mono text-[#64748b] shrink-0">
            {r.error ? r.error.slice(0, 40) : `HTTP ${r.http_code}`} · {r.ms} ms
          </span>
        </div>
      ))}
    </div>
  );
}
