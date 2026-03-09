import { useState, useEffect, useCallback, useRef } from 'react';
import Holidays from 'date-holidays';
import {
  getCategories,
  getTodosByCategory,
  getRoutinesByCategory,
  createTodo,
  toggleTodoDone,
  reorderCategories,
  reorderTodos,
  moveTodoDate,
  moveTodoCategory,
  updateTodoName,
  deleteTodo,
  type TodoCategoryDto,
  type TodoDto,
  type RoutineDto,
  type RepeatConfig,
} from '../../api/todoApi';
import './TodoTab.css';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function isRoutineActiveOnDate(routine: RoutineDto, dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00');
  const start = new Date(routine.startDate + 'T00:00:00');
  const end = new Date(routine.endDate + 'T00:00:00');
  if (date < start || date > end) return false;

  const r: RepeatConfig = routine.repeatDays;
  const dow = date.getDay();
  const dom = date.getDate();
  const month = date.getMonth() + 1;

  switch (r.type) {
    case 'daily':
      return true;
    case 'weekly':
      return (r.weeklyDays ?? []).includes(dow);
    case 'biweekly': {
      const diffDays = Math.round((date.getTime() - start.getTime()) / 86400000);
      return Math.floor(diffDays / 7) % 2 === 0 && (r.weeklyDays ?? []).includes(dow);
    }
    case 'monthly':
      return (r.monthlyDays ?? []).includes(dom);
    case 'yearly': {
      const startMonth = start.getMonth() + 1;
      const startDay = start.getDate();
      if (r.yearlyDates && r.yearlyDates.length > 0) {
        return r.yearlyDates.some((yd) => yd.month === month && yd.day === dom);
      }
      return month === startMonth && dom === startDay;
    }
  }
}

function makeGradient(colors: string[]): string {
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  const stops = colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ');
  return `linear-gradient(135deg, ${stops})`;
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildKoreanHolidaySet(year: number): Set<string> {
  const hd = new Holidays('KR');
  const list = hd.getHolidays(year).filter((h) => h.type === 'public');

  const base = new Set<string>();
  for (const h of list) {
    const dateStr = typeof h.date === 'string' ? h.date.slice(0, 10) : '';
    if (!dateStr) continue;
    base.add(dateStr);

    // 설날·추석은 전날과 다음날도 연휴
    if (h.name.includes('설날') || h.name.includes('추석')) {
      const d = new Date(dateStr + 'T00:00:00');
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      base.add(toDateStr(prev));
      base.add(toDateStr(next));
    }
  }

  // 대체공휴일 계산: 공휴일이 토/일이면 다음 평일로 이동
  const result = new Set(base);
  const sorted = [...base].sort();

  for (const dateStr of sorted) {
    const date = new Date(dateStr + 'T00:00:00');
    const dow = date.getDay();
    if (dow === 0 || dow === 6) {
      const candidate = new Date(date);
      candidate.setDate(candidate.getDate() + 1);
      while (
        candidate.getDay() === 0 ||
        candidate.getDay() === 6 ||
        result.has(toDateStr(candidate))
      ) {
        candidate.setDate(candidate.getDate() + 1);
      }
      result.add(toDateStr(candidate));
    }
  }

  return result;
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

  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());

  const [categories, setCategories] = useState<TodoCategoryDto[]>([]);
  const [categoryTodos, setCategoryTodos] = useState<Record<number, TodoDto[]>>({});
  const [categoryRoutines, setCategoryRoutines] = useState<Record<number, RoutineDto[]>>({});
  const [addingCatId, setAddingCatId] = useState<number | null>(null);
  const [newTodoName, setNewTodoName] = useState('');

  // 투두 팝업 상태
  const [todoPopup, setTodoPopup] = useState<TodoDto | null>(null);
  const [popupMode, setPopupMode] = useState<'menu' | 'edit' | 'date'>('menu');
  const [popupEditName, setPopupEditName] = useState('');
  const [popupNewDate, setPopupNewDate] = useState('');

  // 투두 드래그 상태
  const [draggingTodo, setDraggingTodo] = useState<{ id: number; categoryId: number } | null>(null);
  const [dragOverTodoId, setDragOverTodoId] = useState<number | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<number | null>(null);
  const [calendarDropTarget, setCalendarDropTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // 카테고리 FLIP 애니메이션용 refs
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const savedPositions = useRef<Map<number, number>>(new Map());
  // 투두 FLIP 애니메이션용 refs
  const todoItemRefs = useRef<Map<number, HTMLLIElement>>(new Map());
  const todoSavedPositions = useRef<Map<number, number>>(new Map());

  const loadCategories = useCallback(async () => {
    try {
      const list = await getCategories();
      setCategories(list);
      for (const c of list) {
        const [todos, routines] = await Promise.all([
          getTodosByCategory(c.id),
          getRoutinesByCategory(c.id),
        ]);
        setCategoryTodos((prev) => ({ ...prev, [c.id]: todos }));
        setCategoryRoutines((prev) => ({ ...prev, [c.id]: routines }));
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

  useEffect(() => {
    try {
      setHolidayDates(buildKoreanHolidaySet(viewYear));
    } catch {
      setHolidayDates(new Set());
    }
  }, [viewYear]);

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

  const handleAddTodo = async (categoryId: number, name: string) => {
    const trimmed = name.trim();
    setAddingCatId(null);
    setNewTodoName('');
    if (!trimmed) return;
    setError('');
    try {
      const created = await createTodo({
        categoryId,
        name: trimmed,
        date: selectedDate,
      });
      setCategoryTodos((prev) => ({
        ...prev,
        [categoryId]: [...(prev[categoryId] ?? []), created],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '할일 생성 실패');
    }
  };

  // 투두 드래그 핸들러
  const handleTodoDragStart = (e: React.DragEvent, todo: TodoDto) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(todo.id));
    saveTodoPositions();
    setDraggingTodo({ id: todo.id, categoryId: todo.categoryId });
    setDragOverTodoId(null);
  };

  const handleTodoDragEnd = () => {
    clearTodoTransforms();
    setDraggingTodo(null);
    setDragOverTodoId(null);
    setDragOverCategoryId(null);
    setCalendarDropTarget(null);
  };

  const handleTodoDragEnter = (e: React.DragEvent, targetTodo: TodoDto) => {
    e.preventDefault();
    if (
      draggingTodo &&
      draggingTodo.id !== targetTodo.id &&
      draggingTodo.categoryId === targetTodo.categoryId
    ) {
      saveTodoPositions();
      setDragOverTodoId(targetTodo.id);
    }
  };

  // targetCategoryId: 투두가 속한 카테고리 id (todo item onDrop에서 전달)
  const handleTodoDrop = async (e: React.DragEvent, targetCategoryId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingTodo) return;

    // 다른 카테고리로 이동
    if (draggingTodo.categoryId !== targetCategoryId) {
      const { id: todoId, categoryId: sourceCatId } = draggingTodo;
      const todo = (categoryTodos[sourceCatId] ?? []).find((t) => t.id === todoId);
      if (!todo) return;

      clearTodoTransforms();
      setDraggingTodo(null);
      setDragOverTodoId(null);
      setDragOverCategoryId(null);

      setCategoryTodos((prev) => ({
        ...prev,
        [sourceCatId]: (prev[sourceCatId] ?? []).filter((t) => t.id !== todoId),
        [targetCategoryId]: [...(prev[targetCategoryId] ?? []), { ...todo, categoryId: targetCategoryId }],
      }));

      try {
        await moveTodoCategory(todoId, targetCategoryId);
      } catch {
        setCategoryTodos((prev) => ({
          ...prev,
          [sourceCatId]: [...(prev[sourceCatId] ?? []), todo],
          [targetCategoryId]: (prev[targetCategoryId] ?? []).filter((t) => t.id !== todoId),
        }));
      }
      return;
    }

    // 같은 카테고리 내 순서 변경 (상태값 기반)
    if (dragOverTodoId === null || draggingTodo.id === dragOverTodoId) return;

    const catId = draggingTodo.categoryId;
    const todosOnDate = (categoryTodos[catId] ?? []).filter((t) => t.date === selectedDate);
    const fromIdx = todosOnDate.findIndex((t) => t.id === draggingTodo.id);
    const toIdx = todosOnDate.findIndex((t) => t.id === dragOverTodoId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

    const reordered = [...todosOnDate];
    const [removed] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, removed);

    setCategoryTodos((prev) => ({
      ...prev,
      [catId]: [
        ...(prev[catId] ?? []).filter((t) => t.date !== selectedDate),
        ...reordered,
      ],
    }));

    clearTodoTransforms();
    setDraggingTodo(null);
    setDragOverTodoId(null);

    try {
      await reorderTodos({ todoIds: reordered.map((t) => t.id) });
    } catch {
      setCategoryTodos((prev) => ({
        ...prev,
        [catId]: [
          ...(prev[catId] ?? []).filter((t) => t.date !== selectedDate),
          ...todosOnDate,
        ],
      }));
    }
  };

  // 카테고리 빈 영역에 드롭할 때 (투두 아이템 위가 아닌 경우)
  const handleCategoryTodoDrop = async (e: React.DragEvent, targetCatId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingTodo || draggingTodo.categoryId === targetCatId) return;

    const { id: todoId, categoryId: sourceCatId } = draggingTodo;
    const todo = (categoryTodos[sourceCatId] ?? []).find((t) => t.id === todoId);
    if (!todo) return;

    clearTodoTransforms();
    setDraggingTodo(null);
    setDragOverTodoId(null);
    setDragOverCategoryId(null);

    setCategoryTodos((prev) => ({
      ...prev,
      [sourceCatId]: (prev[sourceCatId] ?? []).filter((t) => t.id !== todoId),
      [targetCatId]: [...(prev[targetCatId] ?? []), { ...todo, categoryId: targetCatId }],
    }));

    try {
      await moveTodoCategory(todoId, targetCatId);
    } catch {
      setCategoryTodos((prev) => ({
        ...prev,
        [sourceCatId]: [...(prev[sourceCatId] ?? []), todo],
        [targetCatId]: (prev[targetCatId] ?? []).filter((t) => t.id !== todoId),
      }));
    }
  };

  // 캘린더 날짜로 드롭 핸들러
  const handleCalendarDrop = async (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setCalendarDropTarget(null);
    if (!draggingTodo || targetDate === selectedDate) return;

    const { id, categoryId } = draggingTodo;
    setDraggingTodo(null);

    // 낙관적 업데이트
    setCategoryTodos((prev) => ({
      ...prev,
      [categoryId]: (prev[categoryId] ?? []).map((t) =>
        t.id === id ? { ...t, date: targetDate } : t
      ),
    }));

    try {
      await moveTodoDate(id, targetDate);
    } catch {
      // 롤백
      setCategoryTodos((prev) => ({
        ...prev,
        [categoryId]: (prev[categoryId] ?? []).map((t) =>
          t.id === id ? { ...t, date: selectedDate } : t
        ),
      }));
    }
  };

  const handleAddRoutineTodo = async (routine: RoutineDto) => {
    setError('');
    try {
      const created = await createTodo({
        categoryId: routine.categoryId,
        name: routine.name,
        date: selectedDate,
      });
      setCategoryTodos((prev) => ({
        ...prev,
        [routine.categoryId]: [...(prev[routine.categoryId] ?? []), created],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : '할일 추가 실패');
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

  // 투두 팝업 핸들러
  const handleOpenTodoPopup = (todo: TodoDto) => {
    setTodoPopup(todo);
    setPopupMode('menu');
    setPopupEditName(todo.name);
    setPopupNewDate(todo.date);
  };

  const handleCloseTodoPopup = () => {
    setTodoPopup(null);
    setPopupMode('menu');
  };

  const handleDeleteTodo = async () => {
    if (!todoPopup) return;
    const { id, categoryId } = todoPopup;
    const backup = todoPopup;
    setTodoPopup(null);
    setCategoryTodos((prev) => ({
      ...prev,
      [categoryId]: (prev[categoryId] ?? []).filter((t) => t.id !== id),
    }));
    try {
      await deleteTodo(id);
    } catch (e) {
      setCategoryTodos((prev) => ({
        ...prev,
        [categoryId]: [...(prev[categoryId] ?? []), backup],
      }));
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const handleSaveEditName = async () => {
    if (!todoPopup || !popupEditName.trim()) return;
    const trimmed = popupEditName.trim();
    const backup = todoPopup;
    setTodoPopup(null);
    setCategoryTodos((prev) => ({
      ...prev,
      [todoPopup.categoryId]: (prev[todoPopup.categoryId] ?? []).map((t) =>
        t.id === todoPopup.id ? { ...t, name: trimmed } : t
      ),
    }));
    try {
      await updateTodoName(todoPopup.id, trimmed);
    } catch (e) {
      setCategoryTodos((prev) => ({
        ...prev,
        [backup.categoryId]: (prev[backup.categoryId] ?? []).map((t) =>
          t.id === backup.id ? backup : t
        ),
      }));
      setError(e instanceof Error ? e.message : '수정 실패');
    }
  };

  const handleDoToday = async () => {
    if (!todoPopup) return;
    const today = toDateStr(new Date());
    const backup = todoPopup;
    setTodoPopup(null);
    setCategoryTodos((prev) => ({
      ...prev,
      [todoPopup.categoryId]: (prev[todoPopup.categoryId] ?? []).map((t) =>
        t.id === todoPopup.id ? { ...t, date: today } : t
      ),
    }));
    try {
      await moveTodoDate(todoPopup.id, today);
    } catch (e) {
      setCategoryTodos((prev) => ({
        ...prev,
        [backup.categoryId]: (prev[backup.categoryId] ?? []).map((t) =>
          t.id === backup.id ? backup : t
        ),
      }));
      setError(e instanceof Error ? e.message : '날짜 변경 실패');
    }
  };

  const handleSaveDateChange = async () => {
    if (!todoPopup || !popupNewDate) return;
    if (popupNewDate === todoPopup.date) { setTodoPopup(null); return; }
    const backup = todoPopup;
    setTodoPopup(null);
    setCategoryTodos((prev) => ({
      ...prev,
      [todoPopup.categoryId]: (prev[todoPopup.categoryId] ?? []).map((t) =>
        t.id === todoPopup.id ? { ...t, date: popupNewDate } : t
      ),
    }));
    try {
      await moveTodoDate(todoPopup.id, popupNewDate);
    } catch (e) {
      setCategoryTodos((prev) => ({
        ...prev,
        [backup.categoryId]: (prev[backup.categoryId] ?? []).map((t) =>
          t.id === backup.id ? backup : t
        ),
      }));
      setError(e instanceof Error ? e.message : '날짜 변경 실패');
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

  // 투두 FLIP 애니메이션
  useEffect(() => {
    if (!draggingTodo) return;
    todoItemRefs.current.forEach((el, id) => {
      const prevY = todoSavedPositions.current.get(id);
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
  }, [dragOverTodoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearTodoTransforms = () => {
    todoItemRefs.current.forEach((el) => {
      el.style.transition = '';
      el.style.transform = '';
    });
  };

  const saveTodoPositions = () => {
    todoSavedPositions.current.clear();
    todoItemRefs.current.forEach((el, id) => {
      todoSavedPositions.current.set(id, el.getBoundingClientRect().top);
    });
  };

  const handleCategoryDragStart = (e: React.DragEvent, index: number) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('form') ||
      target.closest('.todo-item')
    ) {
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

  const getPreviewTodos = (catId: number): TodoDto[] => {
    const todosOnDate = (categoryTodos[catId] ?? []).filter((t) => t.date === selectedDate);
    if (
      !draggingTodo ||
      draggingTodo.categoryId !== catId ||
      dragOverTodoId === null
    ) {
      return todosOnDate;
    }
    const fromIdx = todosOnDate.findIndex((t) => t.id === draggingTodo.id);
    const toIdx = todosOnDate.findIndex((t) => t.id === dragOverTodoId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return todosOnDate;
    const reordered = [...todosOnDate];
    const [removed] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, removed);
    return reordered;
  };

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
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div
                key={d}
                className={`calendar-weekday${i === 0 ? ' sunday' : i === 6 ? ' saturday' : ''}`}
              >
                {d}
              </div>
            ))}
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="calendar-day-cell empty" />;
              }
              const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = dateStr === selectedDate;
              const isToday =
                viewYear === today.getFullYear() &&
                viewMonth === today.getMonth() + 1 &&
                day === today.getDate();

              const dayOfWeek = new Date(viewYear, viewMonth - 1, day).getDay();
              const isSaturday = dayOfWeek === 6;
              const isRedDay = dayOfWeek === 0 || holidayDates.has(dateStr);

              const todosOnDate = categories.flatMap((cat) =>
                (categoryTodos[cat.id] ?? [])
                  .filter((t) => t.date === dateStr)
                  .map((t) => ({
                    ...t,
                    categoryColor: cat.color === 'white' ? '#4a9eff' : cat.color,
                  }))
              );
              const totalCount = todosOnDate.length;
              const doneCount = todosOnDate.filter((t) => t.done).length;
              const remainCount = totalCount - doneCount;
              const allDone = totalCount > 0 && doneCount === totalCount;
              const completedColors = [
                ...new Set(todosOnDate.filter((t) => t.done).map((t) => t.categoryColor)),
              ];

              const btnBackground =
                completedColors.length > 0
                  ? makeGradient(completedColors)
                  : isSelected
                  ? 'rgba(74, 158, 255, 0.35)'
                  : undefined;

              const isCalDrop = calendarDropTarget === dateStr;

              return (
                <div
                  key={dateStr}
                  className={`calendar-day-cell${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}${isSaturday ? ' saturday' : ''}${isRedDay ? ' sunday' : ''}${isCalDrop ? ' cal-drop-target' : ''}`}
                  onDragOver={(e) => {
                    if (!draggingTodo) return;
                    e.preventDefault();
                    setCalendarDropTarget(dateStr);
                  }}
                  onDragLeave={() => {
                    if (calendarDropTarget === dateStr) setCalendarDropTarget(null);
                  }}
                  onDrop={(e) => handleCalendarDrop(e, dateStr)}
                >
                  <button
                    type="button"
                    className="calendar-day-btn"
                    style={btnBackground ? { background: btnBackground } : undefined}
                    onClick={() => setSelectedDate(dateStr)}
                  >
                    {allDone ? '✓' : remainCount > 0 ? remainCount : ''}
                  </button>
                  <span className="calendar-day-num">{day}</span>
                </div>
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
                    className={`category-block${isDragging ? ' dragging' : ''}${dragOverCategoryId === cat.id ? ' cat-todo-drop-target' : ''}`}
                    draggable
                    onDragStart={(e) => handleCategoryDragStart(e, originalIndex)}
                    onDragEnd={handleCategoryDragEnd}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      if (draggingTodo && draggingTodo.categoryId !== cat.id) {
                        // 투두를 다른 카테고리로 드래그 중
                        setDragOverCategoryId(cat.id);
                      } else if (draggingIndex !== null && draggingIndex !== originalIndex) {
                        savePositions();
                        setDragOverIndex(originalIndex);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverCategoryId(null);
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      if (draggingTodo && draggingTodo.categoryId !== cat.id) {
                        handleCategoryTodoDrop(e, cat.id);
                      } else {
                        handleCategoryDrop(e);
                      }
                    }}
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
                    <div className="add-todo-form">
                      {addingCatId === cat.id ? (
                        <input
                          type="text"
                          value={newTodoName}
                          onChange={(e) => setNewTodoName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTodo(cat.id, newTodoName);
                            if (e.key === 'Escape') {
                              setAddingCatId(null);
                              setNewTodoName('');
                            }
                          }}
                          onBlur={() => handleAddTodo(cat.id, newTodoName)}
                          placeholder={`할일 입력 후 엔터 (${selectedDate})`}
                          className="add-todo-input"
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className="add-todo-btn add-todo-open-btn"
                          onClick={() => {
                            setAddingCatId(cat.id);
                            setNewTodoName('');
                          }}
                        >
                          +
                        </button>
                      )}
                    </div>
                    <ul className="todo-list">
                      {getPreviewTodos(cat.id).map((todo) => {
                          const isDraggingThis = draggingTodo?.id === todo.id;
                          return (
                            <li
                              key={todo.id}
                              ref={(el) => {
                                if (el) todoItemRefs.current.set(todo.id, el);
                                else todoItemRefs.current.delete(todo.id);
                              }}
                              className={`todo-item${isDraggingThis ? ' todo-dragging' : ''}`}
                              draggable
                              onDragStart={(e) => handleTodoDragStart(e, todo)}
                              onDragEnd={handleTodoDragEnd}
                              onDragEnter={(e) => handleTodoDragEnter(e, todo)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleTodoDrop(e, cat.id)}
                            >
                              <div className="todo-label">
                                <input
                                  type="checkbox"
                                  checked={todo.done}
                                  onChange={() => handleToggleDone(todo)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span
                                  className={`todo-name${todo.done ? ' done' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenTodoPopup(todo);
                                  }}
                                >
                                  {todo.name}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      {(() => {
                        const realTodosOnDate = (categoryTodos[cat.id] ?? []).filter(
                          (t) => t.date === selectedDate
                        );
                        const ghostRoutines = (categoryRoutines[cat.id] ?? []).filter(
                          (r) =>
                            isRoutineActiveOnDate(r, selectedDate) &&
                            !realTodosOnDate.some((t) => t.name === r.name)
                        );
                        return ghostRoutines.map((routine) =>
                          routine.passivity ? (
                            <li
                              key={`ghost-${routine.id}`}
                              className="todo-item ghost-manual"
                              onClick={() => handleAddRoutineTodo(routine)}
                              title="클릭하면 할일로 추가됩니다"
                            >
                              <span className="todo-label">
                                <span className="ghost-icon">○</span>
                                <span>{routine.name}</span>
                                <span className="ghost-hint">클릭하여 추가</span>
                              </span>
                            </li>
                          ) : (
                            <li key={`ghost-${routine.id}`} className="todo-item ghost-auto">
                              <label className="todo-label">
                                <input
                                  type="checkbox"
                                  onChange={() => handleAddRoutineTodo(routine)}
                                />
                                <span>{routine.name}</span>
                              </label>
                            </li>
                          )
                        );
                      })()}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 투두 바텀시트 팝업 */}
      {todoPopup && (
        <div className="todo-popup-overlay" onClick={handleCloseTodoPopup}>
          <div className="todo-popup" onClick={(e) => e.stopPropagation()}>
            <div className="todo-popup-handle" />

            {popupMode === 'menu' && (
              <>
                <p className="todo-popup-title">{todoPopup.name}</p>
                <div className="todo-popup-actions">
                  <button onClick={() => setPopupMode('edit')}>✏️ &nbsp;수정</button>
                  <button onClick={() => setPopupMode('date')}>📅 &nbsp;날짜 바꾸기</button>
                  {todoPopup.date !== toDateStr(new Date()) && (
                    <button onClick={handleDoToday}>⚡ &nbsp;오늘하기</button>
                  )}
                  <button className="todo-popup-delete" onClick={handleDeleteTodo}>
                    🗑️ &nbsp;삭제
                  </button>
                </div>
              </>
            )}

            {popupMode === 'edit' && (
              <>
                <p className="todo-popup-label">할일 이름 수정</p>
                <input
                  className="todo-popup-input"
                  value={popupEditName}
                  onChange={(e) => setPopupEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEditName();
                    if (e.key === 'Escape') setPopupMode('menu');
                  }}
                  autoFocus
                />
                <div className="todo-popup-row">
                  <button onClick={() => setPopupMode('menu')}>취소</button>
                  <button className="todo-popup-confirm" onClick={handleSaveEditName}>
                    저장
                  </button>
                </div>
              </>
            )}

            {popupMode === 'date' && (
              <>
                <p className="todo-popup-label">날짜 변경</p>
                <input
                  type="date"
                  className="todo-popup-input"
                  value={popupNewDate}
                  onChange={(e) => setPopupNewDate(e.target.value)}
                />
                <div className="todo-popup-row">
                  <button onClick={() => setPopupMode('menu')}>취소</button>
                  <button className="todo-popup-confirm" onClick={handleSaveDateChange}>
                    저장
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
