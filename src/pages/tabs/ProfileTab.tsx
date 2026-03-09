import { useNavigate } from 'react-router-dom';

export default function ProfileTab() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="tab-placeholder profile-tab">
      {user && (
        <div className="profile-info">
          <p><strong>{user.name}</strong>님</p>
          <p className="profile-email">{user.email}</p>
        </div>
      )}
      <button type="button" className="logout-btn" onClick={handleLogout}>
        로그아웃
      </button>
    </div>
  );
}
