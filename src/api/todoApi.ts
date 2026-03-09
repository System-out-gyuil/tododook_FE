const API_BASE = 'http://localhost:8060/api/v1';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** 403/401 시 로그인 페이지로 보내기 위해 사용 (MainPage 등에서 호출) */
export function handleAuthError(status: number): boolean {
  if (status === 401 || status === 403) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return true;
  }
  return false;
}

export interface TodoCategoryDto {
  id: number;
  name: string;
  color: string;
  categoryOrder: number;
  reveal: boolean;
}

export interface TodoDto {
  id: number;
  name: string;
  date: string;
  done: boolean;
  startTime: string | null;
  endTime: string | null;
  categoryId: number;
}

export async function getCategories(): Promise<TodoCategoryDto[]> {
  const res = await fetch(`${API_BASE}/categories`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (handleAuthError(res.status)) throw new Error('인증이 만료되었습니다. 다시 로그인해 주세요.');
  if (!res.ok) throw new Error((data?.message as string) ?? '카테고리 조회 실패');
  return data;
}

export async function createCategory(body: { name: string; color?: string }): Promise<TodoCategoryDto> {
  const res = await fetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (handleAuthError(res.status)) throw new Error('인증이 만료되었습니다.');
  if (!res.ok) throw new Error((data?.message as string) ?? '카테고리 생성 실패');
  return data;
}

export async function updateCategory(
  id: number,
  body: { name: string; color?: string }
): Promise<TodoCategoryDto> {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (handleAuthError(res.status)) throw new Error('인증이 만료되었습니다.');
  if (!res.ok) throw new Error((data?.message as string) ?? '카테고리 수정 실패');
  return data;
}

export async function deleteCategory(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (handleAuthError(res.status)) throw new Error('인증이 만료되었습니다.');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data?.message as string) ?? '카테고리 삭제 실패');
  }
}

export async function reorderCategories(categoryIds: number[]): Promise<void> {
  const res = await fetch(`${API_BASE}/categories/reorder`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ categoryIds }),
    credentials: 'include',
  });
  if (handleAuthError(res.status)) throw new Error('인증이 만료되었습니다.');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data?.message as string) ?? '순서 변경 실패');
  }
}

export async function getTodosByDate(date: string): Promise<TodoDto[]> {
  const res = await fetch(`${API_BASE}/todos?date=${date}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (handleAuthError(res.status)) throw new Error('인증이 만료되었습니다.');
  if (!res.ok) throw new Error((data?.message as string) ?? '할일 조회 실패');
  return data;
}

export async function getTodosByCategory(categoryId: number): Promise<TodoDto[]> {
  const res = await fetch(`${API_BASE}/todos?categoryId=${categoryId}`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (handleAuthError(res.status)) throw new Error('인증이 만료되었습니다.');
  if (!res.ok) throw new Error((data?.message as string) ?? '할일 조회 실패');
  return data;
}

export async function createTodo(body: {
  categoryId: number;
  name: string;
  date: string;
  startTime?: string;
  endTime?: string;
}): Promise<TodoDto> {
  const res = await fetch(`${API_BASE}/todos`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (handleAuthError(res.status)) throw new Error('인증이 만료되었습니다.');
  if (!res.ok) throw new Error((data?.message as string) ?? '할일 생성 실패');
  return data;
}

export async function toggleTodoDone(id: number): Promise<TodoDto> {
  const res = await fetch(`${API_BASE}/todos/${id}/done`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (handleAuthError(res.status)) throw new Error('인증이 만료되었습니다.');
  if (!res.ok) throw new Error((data?.message as string) ?? '할일 수정 실패');
  return data;
}
