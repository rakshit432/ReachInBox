import React, { useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SenderAccount, User } from './types';
import { api } from './services/api';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

const STORAGE_USER_KEY = 'reachinbox_user';
const STORAGE_SENDERS_KEY = 'reachinbox_senders';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_USER_KEY);
    return saved ? (JSON.parse(saved) as User) : null;
  });

  const [senders, setSenders] = useState<SenderAccount[]>(() => {
    const saved = localStorage.getItem(STORAGE_SENDERS_KEY);
    return saved ? (JSON.parse(saved) as SenderAccount[]) : [];
  });

  useEffect(() => {
    if (!user) return;
    api
      .getMe(user.id)
      .then((res) => {
        setUser(res.user);
        setSenders(res.senders);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(res.user));
        localStorage.setItem(STORAGE_SENDERS_KEY, JSON.stringify(res.senders));
      })
      .catch(() => {
        // Session expired or DB reset
      });
  }, [user?.id]);

  const handleLoginSuccess = (
    loggedInUser: User,
    userSenders: SenderAccount[]
  ) => {
    setUser(loggedInUser);
    setSenders(userSenders);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(loggedInUser));
    localStorage.setItem(STORAGE_SENDERS_KEY, JSON.stringify(userSenders));
  };

  const handleLogout = () => {
    setUser(null);
    setSenders([]);
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_SENDERS_KEY);
  };

  const googleClientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    'placeholder_client_id.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {!user ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : (
        <DashboardPage
          user={user}
          senders={senders}
          onUserUpdated={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
          }}
          onSendersUpdated={(updatedSenders) => {
            setSenders(updatedSenders);
            localStorage.setItem(
              STORAGE_SENDERS_KEY,
              JSON.stringify(updatedSenders)
            );
          }}
          onLogout={handleLogout}
        />
      )}
    </GoogleOAuthProvider>
  );
};

export default App;

