import {
  DashboardTab,
  EmailJob,
  ListEmailsResponse,
  ScheduleEmailsPayload,
  ScheduleEmailsResponse,
  SenderAccount,
  User,
} from '../types';

const rawEnvUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:4000/api'
)
  .trim()
  .replace(/\/+$/, '');

const API_BASE_URL = rawEnvUrl.endsWith('/api')
  ? rawEnvUrl
  : `${rawEnvUrl}/api`;

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `API request failed (${response.status})`);
  }
  return data as T;
}

export const api = {
  getBullBoardUrl(): string {
    return API_BASE_URL.replace(/\/api$/, '') + '/admin/queues';
  },

  getSlackOAuthStartUrl(userId: string): string {
    return `${API_BASE_URL}/slack/oauth/start?userId=${encodeURIComponent(
      userId
    )}`;
  },

  async loginWithGoogle(payload: {
    credential?: string;
    accessToken?: string;
  }): Promise<{ user: User; senders: SenderAccount[] }> {
    return request<{ user: User; senders: SenderAccount[] }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMe(
    userId: string
  ): Promise<{ user: User; senders: SenderAccount[] }> {
    return request<{ user: User; senders: SenderAccount[] }>(
      `/auth/me?userId=${encodeURIComponent(userId)}`
    );
  },

  async listEmails(
    userId: string,
    tab: DashboardTab,
    searchQuery = ''
  ): Promise<ListEmailsResponse> {
    const params = new URLSearchParams({
      userId,
      tab,
    });
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }
    return request<ListEmailsResponse>(`/emails?${params.toString()}`);
  },

  async getEmailById(id: string): Promise<{ email: EmailJob }> {
    return request<{ email: EmailJob }>(`/emails/${encodeURIComponent(id)}`);
  },

  async scheduleEmails(
    payload: ScheduleEmailsPayload
  ): Promise<ScheduleEmailsResponse> {
    return request<ScheduleEmailsResponse>('/emails/schedule', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createSenderAccount(payload: {
    userId: string;
    email?: string;
    name?: string;
    hourlyLimit?: number;
  }): Promise<{ sender: SenderAccount }> {
    return request<{ sender: SenderAccount }>('/senders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async disconnectSlack(
    userId: string
  ): Promise<{ message: string; user: User }> {
    return request<{ message: string; user: User }>('/slack/disconnect', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },
};
