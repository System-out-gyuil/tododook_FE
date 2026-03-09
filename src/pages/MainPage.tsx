import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TodoTab from './tabs/TodoTab';
import TimelineTab from './tabs/TimelineTab';
import ProfileTab from './tabs/ProfileTab';
import CategoryRegisterModal from './modals/CategoryRegisterModal';
import CategoryManageModal from './modals/CategoryManageModal';
import RoutineManageModal from './modals/RoutineManageModal';
import './MainPage.css';

type TabId = 'todo' | 'timeline' | 'profile';
type ModalType = 'category-register' | 'category-manage' | 'routine-manage' | null;

export default function MainPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('todo');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [categoryRefreshKey, setCategoryRefreshKey] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    }
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

  const handleCategoryChange = () => {
    setCategoryRefreshKey((k) => k + 1);
  };

  return (
    <div className="main-page">
      <header className="main-header">
        <h1>투두둑</h1>
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

      {modalType === 'category-register' && (
        <CategoryRegisterModal
          onClose={() => setModalType(null)}
          onSuccess={handleCategoryChange}
        />
      )}
      {modalType === 'category-manage' && (
        <CategoryManageModal
          onClose={() => setModalType(null)}
          onSuccess={handleCategoryChange}
        />
      )}
      {modalType === 'routine-manage' && (
        <RoutineManageModal onClose={() => setModalType(null)} onSuccess={handleCategoryChange} />
      )}
    </div>
  );
}
