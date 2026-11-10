import React from 'react';
import {
  Search,
  RefreshCw,
  Slack,
  ExternalLink,
  LogOut,
  X,
} from 'lucide-react';
import { User } from '../../types';
import { api } from '../../services/api';

interface HeaderProps {
  user: User;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onDisconnectSlack: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing,
  onDisconnectSlack,
  onLogout,
}) => {
  return (
    <header className="h-16 border-b border-gray-100 bg-white px-6 flex items-center justify-between gap-4">
      {/* Left: Elasticsearch Search Bar + Refresh */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search emails by recipient, subject, or body..."
            className="w-full rounded-full bg-gray-100/80 pl-10 pr-9 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-[#00A63E]/20 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={onRefresh}
          title="Refresh emails"
          className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00A63E]' : ''}`}
          />
        </button>
      </div>

      {/* Right: Slack OAuth Connect/Disconnect, BullMQ Live Dashboard, & User Profile */}
      <div className="flex items-center gap-3">
        {user.slackConnected ? (
          <button
            onClick={onDisconnectSlack}
            title="Click to disconnect Slack"
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium bg-emerald-50 border border-emerald-200 text-[#00A63E] hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors cursor-pointer"
          >
            <Slack className="w-3.5 h-3.5" />
            Slack Connected (Disconnect)
          </button>
        ) : (
          <a
            href={api.getSlackOAuthStartUrl(user.id)}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Slack className="w-3.5 h-3.5" />
            Connect Slack
          </a>
        )}

        <a
          href={api.getBullBoardUrl()}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
        >
          BullMQ Queue
          <ExternalLink className="w-3 h-3" />
        </a>

        {/* User Avatar, Name, Email & Logout */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200">
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover border border-gray-200"
          />
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-gray-900 leading-tight">
              {user.name}
            </p>
            <p className="text-[11px] text-gray-500 leading-tight">
              {user.email}
            </p>
          </div>
          <button
            onClick={onLogout}
            title="Logout"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
