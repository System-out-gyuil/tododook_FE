import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCategories,
  getTodosByCategory,
  createTodo,
  toggleTodoDone,
  reorderCategories,
  type TodoCategoryDto,
  type TodoDto,
} from '../../api/todoApi';
import './TodoTab.css';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

interface TodoTabProps {
  refreshKey?: number;
}

export default function TodoTab({ refreshKey = 0 }: TodoTabProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  );

  const [categories, setCategories] = useState<TodoCategoryDto[]>([]);
  const [categoryTodos, setCategoryTodos] = useState<Record<number, TodoDto[]>>({});
  const [newTodoByCategory, setNewTodoByCategory] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // FLIP 애니메이션용 refs
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const savedPositions = useRef<Map<number, number>>(new Map());

  const loadCategories = useCallback(async () => {
    try {
      const list = await getCategories();
      setCategories(list);
      for (const c of list) {
        const todos = await getTodosByCategory(c.id);
        setCategoryTodos((prev) => ({ ...prev, [c.id]: todos }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories, refreshKey]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleAddTodo = async (e: React.FormEvent, categoryId: number) => {
    e.preventDefault();
    const name = newTodoByCategory[categoryId]?.trim();
    if (!name) return;
    setError('');
    try {
      const created = await createTodo({
        categoryId,
        name,
        date: selectedDate,
      });
      setCategoryTodos((prev) => ({
        ...prev,
        [categoryId]: [...(prev[categoryId] ?? []), created],
      }));
      setNewTodoByCategory((prev) => ({ ...prev, [categoryId]: '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '할일 생성 실패');
    }
  };

  const handleToggleDone = async (todo: TodoDto) => {
    setError('');
    try {
      const updated = await toggleTodoDone(todo.id);
      setCategoryTodos((prev) => ({
        ...prev,
        [todo.categoryId]: (prev[todo.categoryId] ?? []).map((t) =>
          t.id === updated.id ? updated : t
        ),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패');
    }
  };

  // dragOverIndex 바뀔 때마다 FLIP 애니메이션 실행
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

  const handleCategoryDragStart = (e: React.DragEvent, index: number) => {
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

  const handleCategoryDragEnd = () => {
    clearTransforms();
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleCategoryDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCategoryDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    // 드래그 이벤트 타겟이 아닌 상태값을 사용 — 드래그 아이템 자신 위에 드롭해도 정확히 동작
    const fromIndex = draggingIndex;
    const toIndex = dragOverIndex;
    clearTransforms();
    setDraggingIndex(null);
    setDragOverIndex(null);
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    const reordered = [...categories];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    setCategories(reordered);
    setError('');
    try {
      await reorderCategories(reordered.map((c) => c.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '순서 변경 실패');
      setCategories(categories);
    }
  };

  // 드래그 중 실시간 미리보기 순서 계산
  const previewCategories = (() => {
    if (draggingIndex === null || dragOverIndex === null || draggingIndex === dragOverIndex) {
      return categories;
    }
    const reordered = [...categories];
    const [removed] = reordered.splice(draggingIndex, 1);
    reordered.splice(dragOverIndex, 0, removed);
    return reordered;
  })();

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = `${viewYear}년 ${viewMonth}월`;

  return (
    <div className="todo-tab">
      {error && <p className="todo-error">{error}</p>}
      <div className="todo-layout">
        <section className="todo-calendar">
          <div className="calendar-header">
            <button type="button" className="calendar-arrow" onClick={handlePrevMonth}>
              ‹
            </button>
            <span className="calendar-title">{monthLabel}</span>
            <button type="button" className="calendar-arrow" onClick={handleNextMonth}>
              ›
            </button>
          </div>
          <div className="calendar-grid">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <div key={d} className="calendar-weekday">
                {d}
              </div>
            ))}
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="calendar-day empty" />;
              }
              const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = dateStr === selectedDate;
              const isToday =
                viewYear === today.getFullYear() &&
                viewMonth === today.getMonth() + 1 &&
                day === today.getDate();
              return (
                <button
                  key={dateStr}
                  type="button"
                  className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => setSelectedDate(dateStr)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </section>

        <section className="todo-categories">
          <h3 className="categories-title">카테고리 · 할일</h3>
          <p className="categories-hint">카테고리는 우측 상단 메뉴(≡)에서 등록·관리할 수 있습니다.</p>
          {loading ? (
            <p className="todo-loading">로딩 중...</p>
          ) : (
            <div
              className="category-list"
              onDragOver={handleCategoryDragOver}
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
              {categories.length === 0 && (
                <p className="no-categories">카테고리를 추가해 보세요.</p>
              )}
              {previewCategories.map((cat) => {
                const originalIndex = categories.findIndex((c) => c.id === cat.id);
                const isDragging = draggingIndex === originalIndex;
                return (
                  <div
                    key={cat.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(cat.id, el);
                      else itemRefs.current.delete(cat.id);
                    }}
                    className={`category-block${isDragging ? ' dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleCategoryDragStart(e, originalIndex)}
                    onDragEnd={handleCategoryDragEnd}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      if (draggingIndex !== null && draggingIndex !== originalIndex) {
                        savePositions();
                        setDragOverIndex(originalIndex);
                      }
                    }}
                    onDragOver={handleCategoryDragOver}
                    onDrop={handleCategoryDrop}
                  >
                    <div
                      className="category-header"
                      style={{
                        borderLeftColor:
                          cat.color === 'white' ? '#4a9eff' : cat.color,
                      }}
                    >
                      {cat.name}
                    </div>
                    <form
                      onSubmit={(e) => handleAddTodo(e, cat.id)}
                      className="add-todo-form"
                    >
                      <input
                        type="text"
                        value={newTodoByCategory[cat.id] ?? ''}
                        onChange={(e) =>
                          setNewTodoByCategory((prev) => ({
                            ...prev,
                            [cat.id]: e.target.value,
                          }))
                        }
                        placeholder={`할일 (${selectedDate})`}
                        className="add-todo-input"
                      />
                      <button type="submit" className="add-todo-btn">
                        +
                      </button>
                    </form>
                    <ul className="todo-list">
                      {(categoryTodos[cat.id] ?? [])
                        .filter((t) => t.date === selectedDate)
                        .map((todo) => (
                          <li key={todo.id} className="todo-item">
                            <label className="todo-label">
                              <input
                                type="checkbox"
                                checked={todo.done}
                                onChange={() => handleToggleDone(todo)}
                              />
                              <span className={todo.done ? 'done' : ''}>{todo.name}</span>
                            </label>
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
