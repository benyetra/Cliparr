import { useState, useRef, useEffect } from 'react';
import { startPlexLogin, pollPlexLogin, type User } from '../lib/auth';

interface LoginProps {
  onLogin: (user: User) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error'>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleLogin() {
    setStatus('waiting');
    try {
      const { pinId, authUrl } = await startPlexLogin();
      window.open(authUrl, '_blank', 'width=800,height=600');

      // Poll for completion
      pollRef.current = setInterval(async () => {
        try {
          const user = await pollPlexLogin(pinId);
          if (user) {
            clearInterval(pollRef.current);
            onLogin(user);
          }
        } catch {
          // Continue polling
        }
      }, 2000);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          setStatus('error');
        }
      }, 5 * 60 * 1000);
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Cliparr</h1>
        <p className="tagline">Clip. Share. Stream.</p>

        {status === 'idle' && (
          <button className="btn-primary" onClick={handleLogin}>
            Sign in with Plex
          </button>
        )}

        {status === 'waiting' && (
          <>
            <div className="loading">
              <div className="spinner" />
              Waiting for Plex authorization...
            </div>
            <p style={{ color: 'var(--text-secondary)', marginTop: 16, fontSize: 14 }}>
              Complete the sign-in in the Plex window that opened.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <p style={{ color: 'var(--danger)', marginBottom: 16 }}>
              Login timed out or failed. Please try again.
            </p>
            <button className="btn-primary" onClick={handleLogin}>
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
