import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, type LoginRequest } from '../api/authApi';
import './Auth.css';

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd"
        d="M9 1C4.582 1 1 3.79 1 7.223c0 2.178 1.45 4.09 3.633 5.17L3.75 15.5a.25.25 0 0 0 .38.26L8.09 13.4c.3.03.607.046.91.046 4.418 0 8-2.79 8-6.223S13.418 1 9 1z"
        fill="#3C1E1E"
      />
    </svg>
  );
}

const KAKAO_CLIENT_ID = import.meta.env.VITE_KAKAO_CLIENT_ID as string;
const KAKAO_REDIRECT_URI = import.meta.env.VITE_KAKAO_REDIRECT_URI as string;

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginRequest>({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTitleDoubleClick = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.location.href =
      `https://kauth.kakao.com/oauth/authorize?response_type=code` +
      `&client_id=${KAKAO_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
      `&prompt=login`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(form);
      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('user', JSON.stringify({ userId: res.userId, name: res.name, email: res.email }));
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 onDoubleClick={handleTitleDoubleClick} style={{ cursor: 'default', userSelect: 'none' }}>투두둑</h1>
        <p className="auth-sub">로그인</p>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <p className="auth-error">{error}</p>}
          <label>
            이메일
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="example@email.com"
              required
              autoComplete="email"
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="비밀번호"
              required
              autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <p className="auth-link">
          계정이 없으신가요? <Link to="/signup">회원가입</Link>
        </p>
        <div className="auth-divider"><span>또는</span></div>
        <button
          type="button"
          className="kakao-login-btn"
          onClick={() => {
            window.location.href =
              `https://kauth.kakao.com/oauth/authorize?response_type=code` +
              `&client_id=${KAKAO_CLIENT_ID}` +
              `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}`;
          }}
        >
          <KakaoIcon />
          카카오로 시작하기
        </button>
      </div>
    </div>
  );
}
