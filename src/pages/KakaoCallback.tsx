import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type AuthResponse } from '../api/authApi';
import './Auth.css';

const API_BASE = 'http://localhost:8060/api';

export default function KakaoCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error');

    if (errorParam) {
      setError('카카오 로그인이 취소되었습니다.');
      return;
    }
    if (!code) {
      setError('인가 코드를 받지 못했습니다.');
      return;
    }

    processKakaoLogin(code);
  }, []);

  const processKakaoLogin = async (code: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/oauth/kakao/callback?code=${encodeURIComponent(code)}`
      );

      const data: AuthResponse = await res.json();

      if (!res.ok) {
        const msg = (data as unknown as { message?: string }).message;
        throw new Error(msg ?? '카카오 로그인에 실패했습니다.');
      }

      // 일반 로그인과 동일하게 localStorage에 저장
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem(
        'user',
        JSON.stringify({ userId: data.userId, name: data.name, email: data.email })
      );

      // 신규 유저면 프로필 설정 페이지로, 기존 유저면 앱으로
      navigate(data.newUser ? '/kakao/setup' : '/tododook');
    } catch (err) {
      setError(err instanceof Error ? err.message : '카카오 로그인 중 오류가 발생했습니다.');
    }
  };

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>투두둑</h1>
          <p className="auth-error" style={{ marginBottom: '1rem' }}>{error}</p>
          <button type="button" className="kakao-login-btn"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            onClick={() => navigate('/login')}
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>투두둑</h1>
        <p className="auth-sub">카카오 계정 확인 중...</p>
        <div className="kakao-loading">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}
