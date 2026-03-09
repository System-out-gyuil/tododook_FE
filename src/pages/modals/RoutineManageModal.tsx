import '../../components/Modal.css';

interface RoutineManageModalProps {
  onClose: () => void;
}

export default function RoutineManageModal({ onClose }: RoutineManageModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>루틴 관리</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-placeholder">루틴 관리 기능은 준비 중입니다.</p>
        </div>
      </div>
    </div>
  );
}
