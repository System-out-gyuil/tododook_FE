import { useState } from 'react';
import { createCategory } from '../../api/todoApi';
import '../../components/Modal.css';

interface CategoryRegisterModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const COLOR_OPTIONS = ['white', '#4a9eff', '#6bcf7f', '#f0b84d', '#e85d75', '#a78bfa'];

export default function CategoryRegisterModal({ onClose, onSuccess }: CategoryRegisterModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('white');
  const [customColor, setCustomColor] = useState('#ff5252');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isCustomActive = !COLOR_OPTIONS.includes(color);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('카테고리 이름을 입력하세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await createCategory({ name: name.trim(), color: color === 'white' ? undefined : color });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>카테고리 등록</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            {error && <p className="modal-error">{error}</p>}
            <label className="modal-label">
              카테고리 이름
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 업무, 운동"
                className="modal-input"
                autoFocus
              />
            </label>
            <label className="modal-label">
              색상
              <div className="color-options">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch ${color === c ? 'active' : ''}`}
                    style={{ background: c === 'white' ? '#2a3544' : c, borderColor: c === 'white' ? '#4a5568' : c }}
                    onClick={() => setColor(c)}
                  />
                ))}
                <label
                  className={`color-swatch color-swatch-custom ${isCustomActive ? 'active' : ''}`}
                  style={{ background: customColor }}
                  title="직접 선택"
                >
                  {!isCustomActive && <span className="color-swatch-custom-icon">✎</span>}
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setColor(e.target.value);
                    }}
                  />
                </label>
              </div>
            </label>
            <div className="modal-actions">
              <button type="button" className="modal-btn secondary" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="modal-btn primary" disabled={loading}>
                {loading ? '등록 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
