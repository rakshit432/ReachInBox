import React, { useCallback, useEffect, useState } from 'react';
import {
  DashboardTab,
  EmailJob,
  SenderAccount,
  User,
} from '../types';
import { api } from '../services/api';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { ScheduledEmailsTable } from '../components/tables/ScheduledEmailsTable';
import { SentEmailsTable } from '../components/tables/SentEmailsTable';
import { EmailDetailView } from '../components/tables/EmailDetailModal';
import { ComposeEmailView } from '../components/compose/ComposeEmailView';
import { ToastContainer, ToastMessage } from '../components/ui/Toast';

interface DashboardPageProps {
  user: User;
  senders: SenderAccount[];
  onUserUpdated: (updated: User) => void;
  onSendersUpdated: (updated: SenderAccount[]) => void;
  onLogout: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  senders,
  onUserUpdated,
  onSendersUpdated,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('scheduled');
  const [viewMode, setViewMode] = useState<'list' | 'compose' | 'detail'>(
    'list'
  );
  const [selectedEmail, setSelectedEmail] = useState<EmailJob | null>(null);

  const [emails, setEmails] = useState<EmailJob[]>([]);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'info', message: string) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const fetchEmails = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const res = await api.listEmails(user.id, activeTab, searchQuery);
        setEmails(res.emails);
        if (res.counts) {
          setScheduledCount(res.counts.scheduled);
          setSentCount(res.counts.sent);
        }
      } catch (err) {
        if (!silent) {
          showToast('error', (err as Error).message || 'Failed to load emails');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user.id, activeTab, searchQuery, showToast]
  );

  useEffect(() => {
    fetchEmails(false);
    const interval = setInterval(() => {
      fetchEmails(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slackStatus = params.get('slack');
    if (slackStatus === 'connected') {
      showToast('success', 'Slack workspace connected via OAuth!');
      api.getMe(user.id).then((res) => onUserUpdated(res.user));
      window.history.replaceState({}, '', window.location.pathname);
    } else if (slackStatus === 'error') {
      const msg = params.get('message') || 'Slack OAuth authorization failed';
      showToast('error', msg);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user.id, onUserUpdated, showToast]);

  const handleDisconnectSlack = async () => {
    try {
      const res = await api.disconnectSlack(user.id);
      onUserUpdated(res.user);
      showToast(
        'info',
        'Slack disconnected. Rate-limit hits will no longer notify Slack.'
      );
    } catch (err) {
      showToast('error', (err as Error).message);
    }
  };

  const handleScheduleSubmit = async (payload: {
    senderId: string;
    recipients: string[];
    subject: string;
    body: string;
    startTime: string;
    delayBetweenEmailsSeconds: number;
    hourlyLimit: number;
  }) => {
    const res = await api.scheduleEmails({
      userId: user.id,
      ...payload,
    });
    showToast('success', res.message);
    setViewMode('list');
    setActiveTab('scheduled');
    await fetchEmails(false);
  };

  const handleCreateNewSender = async () => {
    try {
      const res = await api.createSenderAccount({ userId: user.id });
      onSendersUpdated([res.sender, ...senders]);
      showToast(
        'success',
        `Created new Ethereal sender: ${res.sender.email}`
      );
    } catch (err) {
      showToast('error', (err as Error).message);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar
        user={user}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setViewMode('list');
        }}
        onComposeClick={() => setViewMode('compose')}
        scheduledCount={scheduledCount}
        sentCount={sentCount}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {viewMode === 'compose' ? (
          <ComposeEmailView
            senders={senders}
            onCreateNewSender={handleCreateNewSender}
            onScheduleSubmit={handleScheduleSubmit}
            onCancel={() => setViewMode('list')}
          />
        ) : viewMode === 'detail' && selectedEmail ? (
          <EmailDetailView
            email={selectedEmail}
            onBack={() => setViewMode('list')}
          />
        ) : (
          <>
            <Header
              user={user}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefresh={() => fetchEmails(true)}
              isRefreshing={isRefreshing}
              onDisconnectSlack={handleDisconnectSlack}
              onLogout={onLogout}
            />

            <main className="flex-1 overflow-y-auto bg-white">
              {activeTab === 'scheduled' ? (
                <ScheduledEmailsTable
                  emails={emails}
                  isLoading={isLoading}
                  isSearching={Boolean(searchQuery.trim())}
                  onSelectEmail={(email) => {
                    setSelectedEmail(email);
                    setViewMode('detail');
                  }}
                  onComposeClick={() => setViewMode('compose')}
                />
              ) : (
                <SentEmailsTable
                  emails={emails}
                  isLoading={isLoading}
                  isSearching={Boolean(searchQuery.trim())}
                  onSelectEmail={(email) => {
                    setSelectedEmail(email);
                    setViewMode('detail');
                  }}
                />
              )}
            </main>
          </>
        )}
      </div>

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((prev) => prev.filter((item) => item.id !== id))
        }
      />
    </div>
  );
};
