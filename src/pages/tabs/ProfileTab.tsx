import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCategories,
  getTodosByCategory,
  type TodoCategoryDto,
  type TodoDto,
} from '../../api/todoApi';
import {
  getMyProfile,
  updateProfileImage,
  deleteProfileImage,
  updateStatusMessage,
  type UserProfileDto,
} from '../../api/userApi';
import './ProfileTab.css';

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const DOW_LABELS = ['일','월','화','수','목','금','토'];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(136,136,136,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface CalendarCardProps {
  category: TodoCategoryDto;
  todos: TodoDto[];
  year: number;
  month: number;
}

function CalendarCard({ category, todos, year, month }: CalendarCardProps) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;

  const monthTodos = useMemo(
    () => todos.filter((t) => t.date.startsWith(prefix)),
    [todos, prefix],
  );

  const dayMap = useMemo(() => {
    const m: Record<string, { total: number; done: number }> = {};
    for (const todo of monthTodos) {
      if (!m[todo.date]) m[todo.date] = { total: 0, done: 0 };
      m[todo.date].total++;
      if (todo.done) m[todo.date].done++;
    }
    return m;
  }, [monthTodos]);

  const totalCount = monthTodos.length;
  const doneCount = useMemo(() => monthTodos.filter((t) => t.done).length, [monthTodos]);
  const percentage = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : null;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="pf-cat-card">
      <div className="pf-cat-header">
        <span className="pf-cat-dot" style={{ background: category.color }} />
        <span className="pf-cat-name">{category.name}</span>
        <div className="pf-cat-pct-wrap">
          {percentage !== null ? (
            <>
              <span className="pf-cat-pct-num" style={{ color: category.color }}>
                {percentage}
              </span>
              <span className="pf-cat-pct-sign">%</span>
            </>
          ) : (
            <span className="pf-cat-pct-empty">할일 없음</span>
          )}
        </div>
      </div>

      {percentage !== null && (
        <div className="pf-progress-bar">
          <div
            className="pf-progress-fill"
            style={{ width: `${percentage}%`, background: category.color }}
          />
        </div>
      )}

      <div className="pf-cal-grid">
        {DOW_LABELS.map((d) => (
          <div key={d} className="pf-cal-dow">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="pf-cal-cell-empty" />;
          const ds = toDateStr(year, month, day);
          const info = dayMap[ds];
          const isToday = ds === todayStr;
          const hasTodos = Boolean(info && info.total > 0);
          const ratio = hasTodos ? info.done / info.total : 0;
          const bgColor = hasTodos
            ? hexToRgba(category.color, 0.12 + ratio * 0.55)
            : undefined;

          return (
            <div
              key={ds}
              className={`pf-cal-cell${isToday ? ' pf-today' : ''}${hasTodos ? ' pf-has-todos' : ''}`}
              style={bgColor ? { background: bgColor } : undefined}
              title={hasTodos ? `${info.done}/${info.total} 완료` : undefined}
            >
              <span className="pf-cal-day">{day}</span>
              {hasTodos && ratio === 1 && <span className="pf-cal-check">✓</span>}
            </div>
          );
        })}
      </div>

      {totalCount > 0 && (
        <p className="pf-cat-stat">{doneCount} / {totalCount} 완료</p>
      )}
    </div>
  );
}

/* ── 프로필 편집 모달 ── */
interface ProfileModalProps {
  profile: UserProfileDto;
  onClose: () => void;
  onSaved: (updated: UserProfileDto) => void;
}

function ProfileModal({ profile, onClose, onSaved }: ProfileModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMsg, setStatusMsg] = useState(profile.statusMessage ?? '');
  const [preview, setPreview] = useState<string | null>(profile.profileImage);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleImageClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = async () => {
    if (!profile.profileImage && !pendingFile) return;
    if (pendingFile) {
      setPendingFile(null);
      setPreview(null);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await deleteProfileImage();
      setPreview(null);
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      let updated: UserProfileDto = profile;

      if (pendingFile) {
        updated = await updateProfileImage(pendingFile);
      }

      updated = await updateStatusMessage(statusMsg);
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pf-modal-overlay" onClick={onClose}>
      <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pf-modal-handle" />

        <p className="pf-modal-title">프로필 편집</p>

        {/* 프로필 이미지 */}
        <div className="pf-modal-avatar-wrap">
          <button type="button" className="pf-modal-avatar-btn" onClick={handleImageClick}>
            {preview ? (
              <img src={preview} alt="profile" className="pf-modal-avatar-img" />
            ) : (
              <span className="pf-modal-avatar-letter">
                {profile.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <span className="pf-modal-avatar-overlay">사진 변경</span>
          </button>
          {(preview || pendingFile) && (
            <button type="button" className="pf-modal-remove-img" onClick={handleRemoveImage}>
              삭제
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* 이름 / 이메일 (읽기 전용) */}
        <div className="pf-modal-info">
          <p className="pf-modal-name">{profile.name}</p>
          <p className="pf-modal-email">{profile.email}</p>
        </div>

        {/* 상태 메시지 */}
        <div className="pf-modal-field">
          <label className="pf-modal-label">상태 메시지</label>
          <input
            className="pf-modal-input"
            placeholder="상태 메시지를 입력하세요"
            value={statusMsg}
            maxLength={80}
            onChange={(e) => setStatusMsg(e.target.value)}
          />
        </div>

        {error && <p className="pf-modal-error">{error}</p>}

        {/* 버튼 */}
        <div className="pf-modal-actions">
          <button type="button" className="pf-modal-cancel" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button type="button" className="pf-modal-save" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 메인 탭 ── */
export default function ProfileTab() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  const localUser = userStr ? JSON.parse(userStr) : null;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [categories, setCategories] = useState<TodoCategoryDto[]>([]);
  const [todosMap, setTodosMap] = useState<Record<number, TodoDto[]>>({});
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getMyProfile(),
      getCategories(),
    ]).then(async ([prof, cats]) => {
      setProfile(prof);
      setCategories(cats);
      const entries = await Promise.all(
        cats.map(async (c) => {
          const todos = await getTodosByCategory(c.id);
          return [c.id, todos] as [number, TodoDto[]];
        }),
      );
      setTodosMap(Object.fromEntries(entries));
    }).finally(() => setLoading(false));
  }, []);

  const displayName = profile?.name ?? localUser?.name ?? '';
  const displayEmail = profile?.email ?? localUser?.email ?? '';

  return (
    <div className="pf-tab">
      {/* 유저 정보 */}
      <div className="pf-user-section">
        <button
          type="button"
          className="pf-user-info pf-user-info-btn"
          onClick={() => setShowModal(true)}
          title="프로필 편집"
        >
          {profile?.profileImage ? (
            <img src={profile.profileImage} alt="profile" className="pf-avatar-img" />
          ) : (
            <div className="pf-avatar">
              {displayName?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="pf-user-text">
            <p className="pf-user-name">{displayName}</p>
            {profile?.statusMessage ? (
              <p className="pf-user-status">{profile.statusMessage}</p>
            ) : (
              <p className="pf-user-email">{displayEmail}</p>
            )}
          </div>
          <span className="pf-edit-icon">✎</span>
        </button>
        <button type="button" className="pf-logout-btn" onClick={handleLogout}>
          로그아웃
        </button>
      </div>

      {/* 월 네비게이션 */}
      <div className="pf-month-nav">
        <button type="button" className="pf-nav-btn" onClick={prevMonth}>‹</button>
        <span className="pf-month-label">{year}년 {MONTH_NAMES[month]}</span>
        <button type="button" className="pf-nav-btn" onClick={nextMonth}>›</button>
      </div>

      {/* 카테고리 캘린더 목록 */}
      <div className="pf-cards">
        {loading ? (
          <p className="pf-loading">불러오는 중...</p>
        ) : categories.length === 0 ? (
          <p className="pf-empty">카테고리가 없습니다.</p>
        ) : (
          categories.map((cat) => (
            <CalendarCard
              key={cat.id}
              category={cat}
              todos={todosMap[cat.id] ?? []}
              year={year}
              month={month}
            />
          ))
        )}
      </div>

      {/* 프로필 편집 모달 */}
      {showModal && profile && (
        <ProfileModal
          profile={profile}
          onClose={() => setShowModal(false)}
          onSaved={(updated) => setProfile(updated)}
        />
      )}

    </div>
  );
}
