import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function BlockedBanner({ errors, onConfigure }) {
  return (
    <div data-testid="blocked-banner" className="mb-6 p-5 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/25 animate-fade-in">
      <div className="flex items-start gap-3">
        <ShieldAlert size={20} className="text-[#f59e0b] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#fbbf24]">zone-telechargement.org bloque la requête (Cloudflare)</h3>
          <p className="text-xs text-[#cbd5e1] mt-1">
            Configure un relais sur une IP résidentielle pour débloquer la recherche.
          </p>
          {errors?.length > 0 && (
            <ul data-testid="blocked-errors" className="mt-2 space-y-0.5">
              {errors.map((e, i) => <li key={i} className="text-[11px] font-mono text-[#94a3b8] truncate">{e}</li>)}
            </ul>
          )}
        </div>
        <button data-testid="blocked-configure-btn" onClick={onConfigure}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-[#f59e0b] text-[#0b0e14] text-xs font-semibold hover:bg-[#fbbf24] transition-colors">
          Configurer
        </button>
      </div>
    </div>
  );
}
