import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteAccount } from '../api/userApi';
import TodoTab from './tabs/TodoTab';
import TimelineTab from './tabs/TimelineTab';
import ProfileTab from './tabs/ProfileTab';
import CategoryRegisterModal from './modals/CategoryRegisterModal';
import CategoryManageModal from './modals/CategoryManageModal';
import RoutineManageModal from './modals/RoutineManageModal';
import './MainPage.css';
import '../mobile/mobile.css';

type TabId = 'todo' | 'timeline' | 'profile';
type ModalType = 'category-register' | 'category-manage' | 'routine-manage' | null;
type Theme = 'dark' | 'light';

/* ── 설정 바텀시트 ── */
interface SettingsSheetProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onClose: () => void;
  onDeleteAccount: () => Promise<void>;
}

function SettingsSheet({ theme, onThemeChange, onClose, onDeleteAccount }: SettingsSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await onDeleteAccount();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      setDeleting(false);
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="settings-handle" />
        <p className="settings-title">설정</p>

        {/* 테마 섹션 */}
        <div className="settings-section">
          <p className="settings-section-label">테마</p>
          <div className="settings-theme-row">
            <button
              type="button"
              className={`settings-theme-btn${theme === 'dark' ? ' active' : ''}`}
              onClick={() => onThemeChange('dark')}
            >
              <span className="settings-theme-icon">🌙</span>
              <span>다크 모드</span>
              {theme === 'dark' && <span className="settings-theme-check">✓</span>}
            </button>
            <button
              type="button"
              className={`settings-theme-btn${theme === 'light' ? ' active' : ''}`}
              onClick={() => onThemeChange('light')}
            >
              <span className="settings-theme-icon">☀️</span>
              <span>라이트 모드</span>
              {theme === 'light' && <span className="settings-theme-check">✓</span>}
            </button>
          </div>
        </div>

        {/* 계정 섹션 */}
        <div className="settings-section">
          <p className="settings-section-label">계정</p>
          {!confirmDelete ? (
            <button
              type="button"
              className="settings-delete-account-btn"
              onClick={() => setConfirmDelete(true)}
            >
              회원 탈퇴
            </button>
          ) : (
            <div className="settings-delete-confirm">
              <p className="settings-delete-desc">
                탈퇴하면 모든 투두, 루틴, 카테고리가 <strong>영구적으로 삭제</strong>됩니다.
              </p>
              {deleteError && <p className="settings-delete-error">{deleteError}</p>}
              <div className="settings-delete-actions">
                <button
                  type="button"
                  className="settings-delete-cancel"
                  onClick={() => { setConfirmDelete(false); setDeleteError(''); }}
                  disabled={deleting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="settings-delete-confirm-btn"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                >
                  {deleting ? '처리 중...' : '탈퇴하기'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MainPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('todo');
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [categoryRefreshKey, setCategoryRefreshKey] = useState(0);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) ?? 'dark',
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('accessToken');

  /* 테마 적용 */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [menuOpen]);

  if (!token) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'todo', label: '투두' },
    { id: 'timeline', label: '타임라인' },
    { id: 'profile', label: '프로필' },
  ];

  const openModal = (type: ModalType) => {
    setModalType(type);
    setMenuOpen(false);
  };

  const handleCategoryChange = () => setCategoryRefreshKey((k) => k + 1);

  const handleDeleteAccount = async () => {
    await deleteAccount();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="main-page">
      <header className="main-header">
        <h1></h1>

        {/* 투두 탭: 햄버거 메뉴 */}
        {activeTab === 'todo' && (
          <div className="header-actions" ref={menuRef}>
            <button
              type="button"
              className="hamburger-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="메뉴"
              aria-expanded={menuOpen}
            >
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </button>
            {menuOpen && (
              <div className="hamburger-menu">
                <button type="button" onClick={() => openModal('category-register')}>
                  카테고리 등록
                </button>
                <button type="button" onClick={() => openModal('category-manage')}>
                  카테고리 관리
                </button>
                <button type="button" onClick={() => openModal('routine-manage')}>
                  루틴 관리
                </button>
              </div>
            )}
          </div>
        )}

        {/* 프로필 탭: 설정 버튼 */}
        {activeTab === 'profile' && (
          <button
            type="button"
            className="settings-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="설정"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </header>

      <main className="main-content">
        {activeTab === 'todo' && <TodoTab refreshKey={categoryRefreshKey} />}
        {activeTab === 'timeline' && <TimelineTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      <nav className="main-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 카테고리 / 루틴 모달 */}
      {modalType === 'category-register' && (
        <CategoryRegisterModal onClose={() => setModalType(null)} onSuccess={handleCategoryChange} />
      )}
      {modalType === 'category-manage' && (
        <CategoryManageModal onClose={() => setModalType(null)} onSuccess={handleCategoryChange} />
      )}
      {modalType === 'routine-manage' && (
        <RoutineManageModal onClose={() => setModalType(null)} onSuccess={handleCategoryChange} />
      )}

      {/* 설정 바텀시트 */}
      {settingsOpen && (
        <SettingsSheet
          theme={theme}
          onThemeChange={(t) => setTheme(t)}
          onClose={() => setSettingsOpen(false)}
          onDeleteAccount={handleDeleteAccount}
        />
      )}
    </div>
  );
}
