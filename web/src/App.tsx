import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout, type User } from './lib/auth';
import { getAuthToken } from './lib/api';
import { Library } from './pages/Library';
import { ClipEditor } from './pages/ClipEditor';
import { Dashboard } from './pages/Dashboard';
import { Player } from './pages/Player';
import { Expired } from './pages/Expired';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Player pages don't need auth
    if (location.pathname.startsWith('/c/') || location.pathname === '/expired') {
      setLoading(false);
      return;
    }

    if (getAuthToken()) {
      getCurrentUser()
        .then((u) => setUser(u))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [location.pathname]);

  const handleLogin = (u: User) => {
    setUser(u);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate('/');
  };

  // Player routes (no auth needed)
  if (location.pathname.startsWith('/c/') || location.pathname === '/expired') {
    return (
      <Routes>
        <Route path="/c/:clipId" element={<Player />} />
        <Route path="/expired" element={<Expired />} />
      </Routes>
    );
  }

  if (loading) {
    return <div className="loading"><div className="spinner" />Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/dashboard" className="app-logo">
          Clip<span>arr</span>
        </Link>
        <nav className="app-nav">
          <Link to="/library" className={location.pathname.startsWith('/library') ? 'active' : ''}>
            Library
          </Link>
          <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
            My Clips
          </Link>
          {user.isAdmin && (
            <Link to="/settings" className={location.pathname === '/settings' ? 'active' : ''}>
              Settings
            </Link>
          )}
          <div className="user-info">
            {user.thumb && <img src={user.thumb} alt="" className="user-avatar" />}
            <span>{user.username}</span>
            <button className="btn-sm btn-secondary" onClick={handleLogout}>Logout</button>
          </div>
        </nav>
      </header>
      <main className="app-content">
        <Routes>
          <Route path="/library" element={<Library />} />
          <Route path="/library/:sectionKey" element={<Library />} />
          <Route path="/clip/:ratingKey" element={<ClipEditor />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
