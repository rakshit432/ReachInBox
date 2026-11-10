import React from 'react';
import { Clock, Send, ChevronDown } from 'lucide-react';
import { DashboardTab, User } from '../../types';
import { Button } from '../ui/Button';

interface SidebarProps {
  user: User;
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  onComposeClick: () => void;
  scheduledCount: number;
  sentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onSelectTab,
  onComposeClick,
  scheduledCount,
  sentCount,
}) => {
  return (
    <aside className="w-64 border-r border-gray-100 bg-white flex flex-col shrink-0 select-none">
      {/* Brand Logo (Matches Figma "ONB") */}
      <div className="px-5 pt-5 pb-3">
        <span className="text-2xl font-black tracking-tighter text-gray-900">
          ONB
        </span>
      </div>

      {/* User Card (Matches Figma Top-Left User Pill) */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5 border border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        </div>
      </div>

      {/* Primary "Compose" Button (Matches Figma Green Outlined Pill) */}
      <div className="px-4 mb-6">
        <Button
          variant="outline-green"
          className="w-full py-2.5 font-semibold"
          onClick={onComposeClick}
        >
          Compose
        </Button>
      </div>

      {/* CORE Navigation Section (Scheduled & Sent Tabs) */}
      <div className="px-4 flex-1">
        <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Core
        </p>

        <nav className="space-y-1">
          <button
            onClick={() => onSelectTab('scheduled')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'scheduled'
                ? 'bg-[#E8F8EE] text-gray-900 font-semibold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Clock
                className={`w-4 h-4 ${
                  activeTab === 'scheduled' ? 'text-[#00A63E]' : 'text-gray-400'
                }`}
              />
              Scheduled
            </span>
            <span className="text-xs font-medium text-gray-500">
              {scheduledCount}
            </span>
          </button>

          <button
            onClick={() => onSelectTab('sent')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'sent'
                ? 'bg-[#E8F8EE] text-gray-900 font-semibold'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Send
                className={`w-4 h-4 ${
                  activeTab === 'sent' ? 'text-[#00A63E]' : 'text-gray-400'
                }`}
              />
              Sent
            </span>
            <span className="text-xs font-medium text-gray-500">
              {sentCount}
            </span>
          </button>
        </nav>
      </div>
    </aside>
  );
};

