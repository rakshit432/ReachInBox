import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { api } from '../services/api';
import { SenderAccount, User } from '../types';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

interface LoginPageProps {
  onLoginSuccess: (user: User, senders: SenderAccount[]) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.loginWithGoogle({
          accessToken: tokenResponse.access_token,
        });
        onLoginSuccess(res.user, res.senders);
      } catch (err) {
        setError((err as Error).message || 'Google OAuth verification failed');
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      setError(
        'Google OAuth login failed. Ensure VITE_GOOGLE_CLIENT_ID is configured in frontend/.env.'
      );
    },
  });

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Centered Card Matching Figma Login Screen */}
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xs">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Login
        </h1>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Real Google OAuth Login Button (Matches Figma "Login with Google") */}
        <button
          type="button"
          onClick={() => googleLogin()}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-[#E8F8EE] hover:bg-[#d8f3e2] text-gray-800 font-medium text-sm py-2.5 px-4 transition-colors cursor-pointer disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
            />
          </svg>
          Login with Google
        </button>

        {/* Divider (Matches Figma "or sign up through email") */}
        <div className="relative my-5 flex items-center justify-center">
          <div className="border-t border-gray-200 w-full" />
          <span className="bg-white px-3 text-xs text-gray-400 whitespace-nowrap">
            or sign up through email
          </span>
          <div className="border-t border-gray-200 w-full" />
        </div>

        {/* Figma Email & Password Fields */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            googleLogin();
          }}
          className="space-y-3.5"
        >
          <Input
            type="email"
            placeholder="Email ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="pt-2">
            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full rounded-lg py-2.5 font-semibold"
            >
              Login
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
