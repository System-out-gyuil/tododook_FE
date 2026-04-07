import { API_V1 as API_BASE } from './config';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export interface UserProfileDto {
  id: number;
  name: string;
  email: string;
  profileImage: string | null;
  statusMessage: string | null;
}

export async function getMyProfile(): Promise<UserProfileDto> {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.message as string) ?? '프로필 조회 실패');
  return data;
}

export async function updateProfileImage(file: File): Promise<UserProfileDto> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/users/me/profile-image`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: formData,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.message as string) ?? '프로필 이미지 업로드 실패');
  return data;
}

export async function deleteProfileImage(): Promise<UserProfileDto> {
  const res = await fetch(`${API_BASE}/users/me/profile-image`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.message as string) ?? '프로필 이미지 삭제 실패');
  return data;
}

export async function updateStatusMessage(statusMessage: string): Promise<UserProfileDto> {
  const res = await fetch(`${API_BASE}/users/me/status-message`, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ statusMessage }),
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.message as string) ?? '상태 메시지 변경 실패');
  return data;
}

export async function deleteAccount(): Promise<void> {
  const res = await fetch(`${API_BASE}/users/me`, {
    method: 'DELETE',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data?.message as string) ?? '회원 탈퇴 실패');
  }
}
