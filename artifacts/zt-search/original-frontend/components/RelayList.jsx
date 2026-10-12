import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

const inputCls = 'flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#0b0e14] border border-[#263042] text-[#f8fafc] text-xs font-mono placeholder-[#64748b] focus:outline-none focus:border-[#3b82f6]';

export default function RelayList({ relays, onChange }) {
  const update = (i, field, value) => onChange(relays.map((r, j) => (j === i ? { ...r, [field]: value } : r)));

  return (
    <div className="space-y-2" data-testid="relay-list">
      {relays.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input data-testid={`relay-url-input-${i}`} className={inputCls} placeholder="https://xxxx.trycloudflare.com"
                 value={r.url} onChange={(e) => update(i, 'url', e.target.value)} />
          <input data-testid={`relay-key-input-${i}`} className={`${inputCls} max-w-[130px]`} placeholder="clé relais"
                 value={r.key} onChange={(e) => update(i, 'key', e.target.value)} />
          <button data-testid={`relay-remove-btn-${i}`} onClick={() => onChange(relays.filter((_, j) => j !== i))}
                  className="p-2 rounded-lg text-[#64748b] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button data-testid="relay-add-btn" onClick={() => onChange([...relays, { url: '', key: '' }])}
              className="flex items-center gap-1.5 text-xs text-[#3b82f6] hover:text-[#60a5fa] transition-colors">
        <Plus size={14} /> Ajouter un relais
      </button>
    </div>
  );
}
