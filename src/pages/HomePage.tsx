import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function HomePage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');
  const userStr = localStorage.getItem('user');

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    } else {
      navigate('/tododook', { replace: true });
    }
  }, [token, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!token) return null;

  const user = userStr ? JSON.parse(userStr) : null;
  return (
    <div className="home-page">
      <header className="home-header">
        <h1>투두둑</h1>
        <button type="button" onClick={handleLogout} className="logout-btn">
          로그아웃
        </button>
      </header>
      <main className="home-main">
        {user && (
          <p className="welcome">안녕하세요, <strong>{user.name}</strong>님.</p>
        )}
      </main>
    </div>
  );
}
