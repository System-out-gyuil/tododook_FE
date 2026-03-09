import { useState, useEffect, useRef } from 'react';
import {
  getCategories,
  updateCategory,
  deleteCategory,
  reorderCategories,
  type TodoCategoryDto,
} from '../../api/todoApi';
import '../../components/Modal.css';

interface CategoryManageModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const COLOR_OPTIONS = ['white', '#4a9eff', '#6bcf7f', '#f0b84d', '#e85d75', '#a78bfa'];

export default function CategoryManageModal({ onClose, onSuccess }: CategoryManageModalProps) {
  const [list, setList] = useState<TodoCategoryDto[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('white');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const savedPositions = useRef<Map<number, number>>(new Map());

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '목록 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (cat: TodoCategoryDto) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || 'white');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('white');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId == null || !editName.trim()) return;
    setError('');
    try {
      await updateCategory(editingId, {
        name: editName.trim(),
        color: editColor === 'white' ? undefined : editColor,
      });
      onSuccess();
      setList((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? { ...c, name: editName.trim(), color: editColor === 'white' ? 'white' : editColor }
            : c
        )
      );
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 카테고리를 삭제할까요? 연결된 할일은 유지되며, 카테고리만 삭제됩니다.')) return;
    setError('');
    try {
      await deleteCategory(id);
      onSuccess();
      setList((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  useEffect(() => {
    if (draggingIndex === null) return;
    itemRefs.current.forEach((el, id) => {
      const prevY = savedPositions.current.get(id);
      if (prevY === undefined) return;
      const currY = el.getBoundingClientRect().top;
      const diff = prevY - currY;
      if (Math.abs(diff) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${diff}px)`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.2s ease';
          el.style.transform = 'translateY(0)';
        });
      });
    });
  }, [dragOverIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearTransforms = () => {
    itemRefs.current.forEach((el) => {
      el.style.transition = '';
      el.style.transform = '';
    });
  };

  const savePositions = () => {
    savedPositions.current.clear();
    itemRefs.current.forEach((el, id) => {
      savedPositions.current.set(id, el.getBoundingClientRect().top);
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('form')) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    savePositions();
    setDraggingIndex(index);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    clearTransforms();
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = draggingIndex;
    const toIndex = dragOverIndex;
    clearTransforms();
    setDraggingIndex(null);
    setDragOverIndex(null);
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    const reordered = [...list];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    setList(reordered);
    setError('');
    try {
      await reorderCategories(reordered.map((c) => c.id));
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '순서 변경 실패');
      setList(list);
    }
  };

  const previewList = (() => {
    if (draggingIndex === null || dragOverIndex === null || draggingIndex === dragOverIndex) {
      return list;
    }
    const reordered = [...list];
    const [removed] = reordered.splice(draggingIndex, 1);
    reordered.splice(dragOverIndex, 0, removed);
    return reordered;
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>카테고리 관리</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="modal-body">
          {error && <p className="modal-error">{error}</p>}
          {loading ? (
            <p className="modal-loading">로딩 중...</p>
          ) : list.length === 0 ? (
            <p className="modal-empty">등록된 카테고리가 없습니다.</p>
          ) : (
            <ul
              className="category-manage-list"
              onDragOver={handleDragOver}
              onDragLeave={(e) => {
                if (
                  draggingIndex !== null &&
                  !e.currentTarget.contains(e.relatedTarget as Node)
                ) {
                  savePositions();
                  setDragOverIndex(null);
                }
              }}
            >
              {previewList.map((cat) => {
                const originalIndex = list.findIndex((c) => c.id === cat.id);
                const isDragging = draggingIndex === originalIndex;
                return (
                  <li
                    key={cat.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(cat.id, el);
                      else itemRefs.current.delete(cat.id);
                    }}
                    className={`category-manage-item${isDragging ? ' dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, originalIndex)}
                    onDragEnd={handleDragEnd}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      if (draggingIndex !== null && draggingIndex !== originalIndex) {
                        savePositions();
                        setDragOverIndex(originalIndex);
                      }
                    }}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    {editingId === cat.id ? (
                      <form onSubmit={handleUpdate} className="category-edit-form">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="modal-input inline"
                          autoFocus
                        />
                        <div className="color-options inline">
                          {COLOR_OPTIONS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={`color-swatch small ${editColor === c ? 'active' : ''}`}
                              style={{
                                background: c === 'white' ? '#2a3544' : c,
                                borderColor: c === 'white' ? '#4a5568' : c,
                              }}
                              onClick={() => setEditColor(c)}
                            />
                          ))}
                        </div>
                        <div className="category-edit-actions">
                          <button type="submit" className="modal-btn primary small">
                            저장
                          </button>
                          <button type="button" className="modal-btn secondary small" onClick={cancelEdit}>
                            취소
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <span
                          className="category-manage-name"
                          style={{
                            borderLeftColor:
                              cat.color === 'white' ? '#4a9eff' : cat.color,
                          }}
                        >
                          {cat.name}
                        </span>
                        <div className="category-manage-actions">
                          <button
                            type="button"
                            className="modal-btn secondary small"
                            onClick={() => startEdit(cat)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="modal-btn danger small"
                            onClick={() => handleDelete(cat.id)}
                          >
                            삭제
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
