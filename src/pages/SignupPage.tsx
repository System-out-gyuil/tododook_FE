import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup, type SignupRequest } from '../api/authApi';
import './Auth.css';

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<SignupRequest>({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(form);
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>투두둑</h1>
        <p className="auth-sub">회원가입</p>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <p className="auth-error">{error}</p>}
          <label>
            이름
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="이름"
              required
              autoComplete="name"
            />
          </label>
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
              placeholder="비밀번호 (4자 이상)"
              required
              minLength={4}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>
        <p className="auth-link">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  );
}
