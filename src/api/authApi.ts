const API_BASE = 'http://localhost:8060/api/v1';

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  userId: number;
  name: string;
  email: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export async function signup(body: SignupRequest): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const message = getErrorMessage(data, '회원가입에 실패했습니다.');
    throw new Error(message);
  }
  return data;
}

export async function login(body: LoginRequest): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const message = getErrorMessage(data, '이메일 또는 비밀번호를 확인해주세요.');
    throw new Error(message);
  }
  return data;
}

function getErrorMessage(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.message === 'string') return data.message;
  const first = Object.values(data).find((v): v is string => typeof v === 'string');
  return first ?? fallback;
}
