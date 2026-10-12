import React from 'react';
import { Download, Play, ExternalLink, Shield, ShieldCheck } from 'lucide-react';

function QualityBadge({ quality }) {
  const q = (quality || '').toUpperCase();
  let classes = 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  if (q.includes('4K') || q.includes('2160') || q.includes('UHD') || q.includes('ULTRA'))
    classes = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  else if (q.includes('1080'))
    classes = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  else if (q.includes('720'))
    classes = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
  else if (q.includes('WEBRIP') || q.includes('WEB-DL') || q.includes('BLURAY'))
    classes = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${classes}`}>
      {quality || 'Inconnu'}
    </span>
  );
}

function LangBadge({ lang }) {
  if (!lang) return null;
  let classes = 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30';
  if (lang.includes('FRENCH') || lang.includes('VF') || lang.includes('MULTI'))
    classes = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${classes}`}>
      {lang}
    </span>
  );
}

function LinkRow({ link }) {
  return (
    <div
      data-testid="link-row"
      className="grid grid-cols-[1fr_100px_80px_auto] sm:grid-cols-[1fr_110px_80px_70px_auto] gap-3 items-center
                 px-3 py-2.5 bg-[#0b0e14]/60 rounded-lg text-[12.5px]
                 hover:bg-[#181e2b] transition-colors duration-150"
    >
      <div className="font-medium text-[#f8fafc] truncate" title={link.filename}>
        {link.filename || '—'}
      </div>
      <div className="text-center">
        <span className="inline-block bg-[#202838] text-[#94a3b8] px-2 py-0.5 rounded text-[11px] font-medium">
          {link.host || '?'}
        </span>
      </div>
      <div className="text-center">
        {link.protection ? (
          <span className="inline-flex items-center gap-1 text-[#f59e0b] text-[10px]">
            <Shield size={10} /> {link.protection}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[#10b981] text-[10px]">
            <ShieldCheck size={10} /> direct
          </span>
        )}
      </div>
      <div className="hidden sm:block text-[#64748b] text-[11px]">{link.size || ''}</div>
      <div>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-open"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                     bg-[#3b82f6] hover:bg-[#2563eb] text-white transition-colors duration-150"
        >
          <ExternalLink size={11} /> Ouvrir
        </a>
      </div>
    </div>
  );
}

export default function QualityBlock({ quality }) {
  const ddl = quality.downloadLinks || [];
  const stream = quality.streamLinks || [];

  if (ddl.length === 0 && stream.length === 0) return null;

  return (
    <div
      data-testid="quality-block"
      className="bg-[#181e2b] border border-[#263042] rounded-xl overflow-hidden mb-4 animate-fade-up"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a2235] to-[#181e2b] px-5 py-3.5 border-b border-[#263042]
                      flex flex-wrap items-center gap-3">
        <QualityBadge quality={quality.quality} />
        <LangBadge lang={quality.lang} />
        {quality.size && (
          <span className="text-[#64748b] text-xs ml-auto">{quality.size}</span>
        )}
      </div>

      {/* Download links */}
      {ddl.length > 0 && (
        <div className="px-5 py-4">
          <h4 className="flex items-center gap-2 text-[13px] font-semibold text-[#3b82f6] uppercase tracking-wider mb-3">
            <Download size={14} /> Téléchargement ({ddl.length})
          </h4>
          <div className="space-y-1.5">
            {ddl.map((lk, i) => (
              <LinkRow key={`dl-${i}`} link={lk} />
            ))}
          </div>
        </div>
      )}

      {/* Stream links */}
      {stream.length > 0 && (
        <div className={`px-5 py-4 ${ddl.length > 0 ? 'border-t border-[#263042]/50' : ''}`}>
          <h4 className="flex items-center gap-2 text-[13px] font-semibold text-[#10b981] uppercase tracking-wider mb-3">
            <Play size={14} /> Streaming ({stream.length})
          </h4>
          <div className="space-y-1.5">
            {stream.map((lk, i) => (
              <LinkRow key={`st-${i}`} link={lk} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
