import React from 'react';
import {
  Film, Tv, Swords, Gamepad2, Music, BookOpen, MonitorDown,
  Clapperboard, Radio, Drama, Mic2, Trophy
} from 'lucide-react';

const iconMap = {
  Film, Tv, Swords, Gamepad2, Music, BookOpen, MonitorDown,
  Clapperboard, Radio, Drama, Mic2, Trophy
};

export default function CategoryTabs({ tabs, activeTab, onTabChange }) {
  return (
    <div
      data-testid="category-tabs"
      className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide"
      style={{ scrollbarWidth: 'none' }}
    >
      {tabs.map((tab) => {
        const Icon = iconMap[tab.icon];
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium
              whitespace-nowrap transition-all duration-200 border
              ${isActive
                ? 'bg-[#3b82f6]/15 text-[#38bdf8] border-[#3b82f6]/30'
                : 'bg-transparent text-[#94a3b8] border-transparent hover:text-[#f8fafc] hover:bg-[#181e2b]'
              }
            `}
          >
            {Icon && <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
