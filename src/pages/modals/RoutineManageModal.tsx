import { useState, useEffect } from 'react';
import {
  getCategories,
  getRoutinesByCategory,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  type TodoCategoryDto,
  type RoutineDto,
  type RepeatConfig,
} from '../../api/todoApi';
import '../../components/Modal.css';

interface RoutineManageModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type RepeatType = RepeatConfig['type'];

const REPEAT_LABELS: Record<RepeatType, string> = {
  daily: '매일',
  weekly: '매주',
  biweekly: '격주',
  monthly: '매월',
  yearly: '매년',
};

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface RoutineFormState {
  name: string;
  startDate: string;
  endDate: string;
  passivity: boolean;
  repeatType: RepeatType;
  weeklyDays: number[];
  monthlyDays: number[];
}

function buildRepeatDays(form: RoutineFormState): string {
  switch (form.repeatType) {
    case 'daily':
      return JSON.stringify({ type: 'daily' });
    case 'weekly':
      return JSON.stringify({ type: 'weekly', weeklyDays: form.weeklyDays });
    case 'biweekly':
      return JSON.stringify({ type: 'biweekly', weeklyDays: form.weeklyDays });
    case 'monthly':
      return JSON.stringify({ type: 'monthly', monthlyDays: form.monthlyDays });
    case 'yearly':
      return JSON.stringify({ type: 'yearly' });
  }
}

function parseRepeatDays(r: RepeatConfig): Partial<RoutineFormState> {
  return {
    repeatType: r.type,
    weeklyDays: r.weeklyDays ?? [],
    monthlyDays: r.monthlyDays ?? [],
  };
}

const today = new Date().toISOString().slice(0, 10);

const defaultForm = (): RoutineFormState => ({
  name: '',
  startDate: today,
  endDate: today,
  passivity: false,
  repeatType: 'daily',
  weeklyDays: [],
  monthlyDays: [],
});

export default function RoutineManageModal({ onClose, onSuccess }: RoutineManageModalProps) {
  const [categories, setCategories] = useState<TodoCategoryDto[]>([]);
  const [categoryRoutines, setCategoryRoutines] = useState<Record<number, RoutineDto[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [addingCatId, setAddingCatId] = useState<number | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);
  const [form, setForm] = useState<RoutineFormState>(defaultForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
        const routinesMap: Record<number, RoutineDto[]> = {};
        for (const c of cats) {
          routinesMap[c.id] = await getRoutinesByCategory(c.id);
        }
        setCategoryRoutines(routinesMap);
      } catch (e) {
        setError(e instanceof Error ? e.message : '로드 실패');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resetForm = () => {
    setForm(defaultForm());
    setAddingCatId(null);
    setEditingRoutineId(null);
  };

  const startAdd = (catId: number) => {
    resetForm();
    setAddingCatId(catId);
  };

  const startEdit = (routine: RoutineDto) => {
    setAddingCatId(null);
    setEditingRoutineId(routine.id);
    const parsed = parseRepeatDays(routine.repeatDays);
    setForm({
      name: routine.name,
      startDate: routine.startDate,
      endDate: routine.endDate,
      passivity: routine.passivity,
      repeatType: parsed.repeatType ?? 'daily',
      weeklyDays: parsed.weeklyDays ?? [],
      monthlyDays: parsed.monthlyDays ?? [],
    });
  };

  const handleSubmit = async (e: React.FormEvent, categoryId: number) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    const repeatDays = buildRepeatDays(form);
    const body = {
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      passivity: form.passivity,
      repeatDays,
    };
    try {
      if (editingRoutineId !== null) {
        const updated = await updateRoutine(editingRoutineId, body);
        setCategoryRoutines((prev) => ({
          ...prev,
          [categoryId]: prev[categoryId].map((r) => (r.id === updated.id ? updated : r)),
        }));
      } else {
        const created = await createRoutine({ categoryId, ...body });
        setCategoryRoutines((prev) => ({
          ...prev,
          [categoryId]: [...(prev[categoryId] ?? []), created],
        }));
      }
      onSuccess();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (routine: RoutineDto) => {
    if (!window.confirm(`"${routine.name}" 루틴을 삭제할까요?`)) return;
    setError('');
    try {
      await deleteRoutine(routine.id);
      setCategoryRoutines((prev) => ({
        ...prev,
        [routine.categoryId]: prev[routine.categoryId].filter((r) => r.id !== routine.id),
      }));
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  const toggleWeeklyDay = (d: number) => {
    setForm((f) => ({
      ...f,
      weeklyDays: f.weeklyDays.includes(d)
        ? f.weeklyDays.filter((x) => x !== d)
        : [...f.weeklyDays, d],
    }));
  };

  const toggleMonthlyDay = (d: number) => {
    setForm((f) => ({
      ...f,
      monthlyDays: f.monthlyDays.includes(d)
        ? f.monthlyDays.filter((x) => x !== d)
        : [...f.monthlyDays, d],
    }));
  };

  const repeatLabel = (r: RoutineDto): string => {
    const cfg = r.repeatDays;
    switch (cfg.type) {
      case 'daily': return '매일';
      case 'weekly': return `매주 ${(cfg.weeklyDays ?? []).map((d) => DOW_LABELS[d]).join('·')}`;
      case 'biweekly': return `격주 ${(cfg.weeklyDays ?? []).map((d) => DOW_LABELS[d]).join('·')}`;
      case 'monthly': return `매월 ${(cfg.monthlyDays ?? []).join('·')}일`;
      case 'yearly': return '매년';
    }
  };

  const renderForm = (categoryId: number) => (
    <form
      onSubmit={(e) => handleSubmit(e, categoryId)}
      className="routine-form"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="routine-form-row">
        <label className="routine-form-label">루틴 이름</label>
        <input
          type="text"
          className="modal-input"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="루틴 이름 입력"
          autoFocus
        />
      </div>

      <div className="routine-form-row routine-form-dates">
        <div>
          <label className="routine-form-label">시작 날짜</label>
          <input
            type="date"
            className="modal-input"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="routine-form-label">종료 날짜</label>
          <input
            type="date"
            className="modal-input"
            value={form.endDate}
            min={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          />
        </div>
      </div>

      <div className="routine-form-row">
        <label className="routine-form-label">반복 주기</label>
        <select
          className="modal-input"
          value={form.repeatType}
          onChange={(e) =>
            setForm((f) => ({ ...f, repeatType: e.target.value as RepeatType, weeklyDays: [], monthlyDays: [] }))
          }
        >
          {(Object.keys(REPEAT_LABELS) as RepeatType[]).map((t) => (
            <option key={t} value={t}>{REPEAT_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {(form.repeatType === 'weekly' || form.repeatType === 'biweekly') && (
        <div className="routine-form-row">
          <label className="routine-form-label">요일 선택</label>
          <div className="routine-dow-group">
            {DOW_LABELS.map((label, idx) => (
              <button
                key={idx}
                type="button"
                className={`routine-dow-btn${form.weeklyDays.includes(idx) ? ' active' : ''}`}
                onClick={() => toggleWeeklyDay(idx)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.repeatType === 'monthly' && (
        <div className="routine-form-row">
          <label className="routine-form-label">날짜 선택</label>
          <div className="routine-monthly-grid">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                className={`routine-monthly-btn${form.monthlyDays.includes(d) ? ' active' : ''}`}
                onClick={() => toggleMonthlyDay(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.repeatType === 'yearly' && (
        <p className="routine-form-hint">시작 날짜({form.startDate})와 같은 날짜마다 반복됩니다.</p>
      )}

      <div className="routine-form-row routine-form-passivity">
        <label className="routine-passivity-label">
          <input
            type="checkbox"
            checked={form.passivity}
            onChange={(e) => setForm((f) => ({ ...f, passivity: e.target.checked }))}
          />
          <span>수동으로 할일 추가</span>
          <span className="routine-passivity-hint">
            {form.passivity
              ? '반투명하게 표시 → 클릭하면 할일에 추가'
              : '해당 날짜마다 자동으로 할일에 표시'}
          </span>
        </label>
      </div>

      <div className="modal-actions">
        <button type="button" className="modal-btn secondary" onClick={resetForm}>
          취소
        </button>
        <button type="submit" className="modal-btn primary" disabled={saving || !form.name.trim()}>
          {saving ? '저장 중...' : editingRoutineId !== null ? '수정' : '추가'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>루틴 관리</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="modal-body">
          {error && <p className="modal-error">{error}</p>}
          {loading ? (
            <p className="modal-loading">로딩 중...</p>
          ) : categories.length === 0 ? (
            <p className="modal-empty">카테고리를 먼저 등록해 주세요.</p>
          ) : (
            <div className="routine-category-list">
              {categories.map((cat) => {
                const routines = categoryRoutines[cat.id] ?? [];
                const isAdding = addingCatId === cat.id;
                return (
                  <div key={cat.id} className="routine-category-block">
                    <div
                      className="category-header"
                      style={{ borderLeftColor: cat.color === 'white' ? '#4a9eff' : cat.color }}
                    >
                      {cat.name}
                    </div>

                    {routines.length === 0 && !isAdding && (
                      <p className="routine-empty">등록된 루틴이 없습니다.</p>
                    )}

                    <ul className="routine-list">
                      {routines.map((routine) => (
                        <li key={routine.id} className="routine-item">
                          {editingRoutineId === routine.id ? (
                            renderForm(cat.id)
                          ) : (
                            <div className="routine-item-info">
                              <div className="routine-item-name">{routine.name}</div>
                              <div className="routine-item-meta">
                                <span>{routine.startDate} ~ {routine.endDate}</span>
                                <span className="routine-item-badge">{repeatLabel(routine)}</span>
                                <span className={`routine-item-badge ${routine.passivity ? 'badge-manual' : 'badge-auto'}`}>
                                  {routine.passivity ? '수동' : '자동'}
                                </span>
                              </div>
                              <div className="routine-item-actions">
                                <button
                                  type="button"
                                  className="modal-btn secondary small"
                                  onClick={() => startEdit(routine)}
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  className="modal-btn danger small"
                                  onClick={() => handleDelete(routine)}
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>

                    {isAdding ? (
                      renderForm(cat.id)
                    ) : (
                      <button
                        type="button"
                        className="routine-add-btn"
                        onClick={() => startAdd(cat.id)}
                      >
                        + 루틴 추가
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
