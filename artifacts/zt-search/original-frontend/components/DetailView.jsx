import React from 'react';
import { ArrowLeft, Film, Star, Calendar, Clock, MapPin, User, Users, Tag } from 'lucide-react';
import QualityBlock from './QualityBlock';
import { posterUrl } from '@/api/zt';

export default function DetailView({ detail, refResult, onBack, isLoading }) {
  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <button
          data-testid="detail-back"
          onClick={onBack}
          className="flex items-center gap-1.5 text-[#94a3b8] hover:text-[#3b82f6] text-sm font-medium mb-5 transition-colors"
        >
          <ArrowLeft size={16} /> Retour aux résultats
        </button>
        <div className="grid md:grid-cols-[220px_1fr] gap-6">
          <div className="aspect-[2/3] rounded-xl shimmer" />
          <div className="space-y-3">
            <div className="h-8 w-3/4 shimmer rounded-lg" />
            <div className="h-4 w-1/2 shimmer rounded" />
            <div className="h-20 w-full shimmer rounded-lg mt-4" />
          </div>
        </div>
        <div className="mt-6 space-y-4">
          {[1, 2].map(i => <div key={i} className="h-32 shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const res = detail;
  const poster = res.poster || refResult?.poster;

  const metaFields = [
    { label: 'Origine', value: res.origin, icon: MapPin },
    { label: 'Réalisation', value: res.director, icon: User },
    { label: 'Acteur(s)', value: res.actors, icon: Users },
    { label: 'Genre', value: res.genres, icon: Tag },
    { label: 'Durée', value: res.duration, icon: Clock },
    { label: 'Date', value: res.release_date || res.year, icon: Calendar },
    { label: 'Note', value: res.rating, icon: Star },
    { label: 'Développeur', value: res.developer },
    { label: 'Éditeur', value: res.publisher },
    { label: 'Plateforme', value: res.platform },
    { label: 'Mode(s)', value: res.modes },
    { label: 'Artiste', value: res.artist },
    { label: 'Album', value: res.album },
    { label: 'Auteur', value: res.author },
    { label: 'Langue', value: res.lang_meta },
    { label: 'Format', value: res.format_meta },
    { label: 'Taille', value: res.size_meta },
  ].filter(f => f.value);

  return (
    <div data-testid="detail-view" className="animate-fade-in">
      <button
        data-testid="detail-back"
        onClick={onBack}
        className="flex items-center gap-1.5 text-[#94a3b8] hover:text-[#3b82f6]
                   text-sm font-medium mb-5 transition-colors duration-200"
      >
        <ArrowLeft size={16} /> Retour aux résultats
      </button>

      {/* Header */}
      <div className="grid md:grid-cols-[220px_1fr] gap-6 mb-8">
        {/* Poster */}
        <div className="aspect-[2/3] bg-[#121721] rounded-xl overflow-hidden border border-[#263042] relative mx-auto md:mx-0 w-full max-w-[220px]">
          {poster ? (
            <img
              src={posterUrl(poster)}
              alt={res.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#64748b]">
              <Film size={48} strokeWidth={1.2} />
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#f8fafc] leading-tight mb-1">
            {res.title || refResult?.title}
          </h2>
          {res.originalTitle && res.originalTitle !== res.title && (
            <p className="text-[#94a3b8] italic text-sm mb-3">{res.originalTitle}</p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(res.year || refResult?.year) && (
              <span className="text-xs font-semibold px-2 py-1 rounded bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/25">
                <Calendar size={11} className="inline mr-1" />
                {res.year || refResult?.year}
              </span>
            )}
            {res.rating && (
              <span className="text-xs font-semibold px-2 py-1 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25">
                <Star size={11} className="inline mr-1" />
                {res.rating}
              </span>
            )}
          </div>

          {/* Meta grid */}
          {metaFields.length > 0 && (
            <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-sm mb-4">
              {metaFields.map((f, i) => (
                <React.Fragment key={i}>
                  <div className="text-[#64748b] font-medium flex items-center gap-1">
                    {f.icon && React.createElement(f.icon, { size: 12 })}
                    {f.label}
                  </div>
                  <div className="text-[#94a3b8]">{f.value}</div>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Synopsis */}
          {res.synopsis && (
            <p className="text-[#94a3b8] text-sm leading-relaxed">{res.synopsis}</p>
          )}
        </div>
      </div>

      {/* Qualities */}
      {res.qualities && res.qualities.length > 0 ? (
        <div>
          <h3 className="text-lg font-bold text-[#f8fafc] mb-4">
            Liens disponibles
          </h3>
          {res.qualities.map((q, i) => (
            <QualityBlock key={i} quality={q} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-[#64748b]">
          <Film size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun lien trouvé pour ce contenu</p>
        </div>
      )}
    </div>
  );
}
