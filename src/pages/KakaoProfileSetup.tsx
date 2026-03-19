import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_V1 as API_BASE } from '../api/config';
import './Auth.css';
import './KakaoProfileSetup.css';

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken');
  return { Authorization: `Bearer ${token}` };
}

export default function KakaoProfileSetup() {
  const navigate = useNavigate();

  const storedUser = JSON.parse(localStorage.getItem('user') ?? '{}') as {
    name?: string;
    email?: string;
  };

  const [name, setName] = useState(storedUser.name ?? '');
  const [statusMessage, setStatusMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // 1. 이름 업데이트 (필수)
      const nameRes = await fetch(`${API_BASE}/users/me/name`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!nameRes.ok) {
        const data = await nameRes.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? '이름 설정에 실패했습니다.');
      }
      const nameData = await nameRes.json() as { name?: string };

      // 2. 프로필 이미지 업로드 (선택)
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        const imgRes = await fetch(`${API_BASE}/users/me/profile-image`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: formData,
        });
        if (!imgRes.ok) throw new Error('프로필 이미지 업로드에 실패했습니다.');
      }

      // 3. 상태메시지 업데이트 (선택)
      if (statusMessage.trim()) {
        const statusRes = await fetch(`${API_BASE}/users/me/status-message`, {
          method: 'PATCH',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ statusMessage: statusMessage.trim() }),
        });
        if (!statusRes.ok) throw new Error('상태메시지 설정에 실패했습니다.');
      }

      // localStorage 이름 업데이트
      const stored = JSON.parse(localStorage.getItem('user') ?? '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, name: nameData.name ?? name.trim() }));

      navigate('/tododook');
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로필 설정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card setup-card">
        <h1>투두둑</h1>
        <p className="auth-sub">프로필 설정</p>
        <p className="setup-desc">카카오 계정으로 처음 시작하셨네요!<br />사용할 프로필을 설정해주세요.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <p className="auth-error">{error}</p>}

          {/* 프로필 이미지 */}
          <div className="setup-avatar-wrap">
            <button
              type="button"
              className="setup-avatar"
              onClick={() => fileInputRef.current?.click()}
              title="프로필 사진 변경"
            >
              {imagePreview
                ? <img src={imagePreview} alt="미리보기" />
                : <span className="setup-avatar-placeholder">+</span>
              }
            </button>
            <p className="setup-avatar-hint">프로필 사진 (선택)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
          </div>

          {/* 이름 */}
          <label>
            이름 <span className="setup-required">*</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="사용할 이름을 입력해주세요"
              maxLength={20}
              required
              autoFocus
            />
          </label>

          {/* 상태메시지 */}
          <label>
            상태메시지 <span className="setup-optional">(선택)</span>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="상태메시지를 입력해주세요"
              maxLength={60}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? '저장 중...' : '시작하기'}
          </button>
        </form>

        <button
          type="button"
          className="setup-skip"
          onClick={() => navigate('/tododook')}
        >
          나중에 설정할게요
        </button>
      </div>
    </div>
  );
}
