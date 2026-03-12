import { useState, useEffect, useRef, useMemo } from 'react';
import {
  getCategories,
  getTodosByDate,
  toggleTodoDone,
  updateTodoName,
  deleteTodo,
  moveTodoDate,
  updateTodoTime,
  type TodoCategoryDto,
  type TodoDto,
} from '../../api/todoApi';
import './TimelineTab.css';

const HOUR_HEIGHT = 64;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const BLOCK_GAP = 3;

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(date: Date): string {
  const dow = DAY_NAMES[date.getDay()];
  const isToday = toDateStr(date) === toDateStr(new Date());
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${dow})${isToday ? '  · 오늘' : ''}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/* ── 겹침 레이아웃 계산 ── */
interface LayoutTodo extends TodoDto {
  col: number;
  totalCols: number;
}

function layoutTimedTodos(todos: TodoDto[]): LayoutTodo[] {
  if (!todos.length) return [];

  const sorted = [...todos].sort(
    (a, b) => timeToMinutes(a.startTime!) - timeToMinutes(b.startTime!),
  );

  const columns: { endMin: number }[][] = [];
  const colOf = new Map<number, number>();

  for (const todo of sorted) {
    const startMin = timeToMinutes(todo.startTime!);
    const endMin = timeToMinutes(todo.endTime!);
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (startMin >= columns[c][columns[c].length - 1].endMin) {
        columns[c].push({ endMin });
        colOf.set(todo.id, c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ endMin }]);
      colOf.set(todo.id, columns.length - 1);
    }
  }

  return sorted.map((todo) => {
    const startMin = timeToMinutes(todo.startTime!);
    const endMin = timeToMinutes(todo.endTime!);
    const overlapping = sorted.filter((o) => {
      const os = timeToMinutes(o.startTime!);
      const oe = timeToMinutes(o.endTime!);
      return os < endMin && oe > startMin;
    });
    const maxCol = Math.max(...overlapping.map((o) => (colOf.get(o.id) ?? 0) + 1));
    return { ...todo, col: colOf.get(todo.id) ?? 0, totalCols: maxCol };
  });
}

/* ── 미니 주간 스트립 ── */
function getWeekDates(date: Date): Date[] {
  const dow = date.getDay();
  const mon = new Date(date);
  mon.setDate(date.getDate() - ((dow + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

export default function TimelineTab() {
  const [dayOffset, setDayOffset] = useState(0);
  const [categories, setCategories] = useState<TodoCategoryDto[]>([]);
  const [todos, setTodos] = useState<TodoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── 팝업 상태 ── */
  const [popup, setPopup] = useState<TodoDto | null>(null);
  const [popupMode, setPopupMode] = useState<'menu' | 'edit' | 'date' | 'time'>('menu');
  const [popupEditName, setPopupEditName] = useState('');
  const [popupNewDate, setPopupNewDate] = useState('');
  const [popupStartTime, setPopupStartTime] = useState('');
  const [popupEndTime, setPopupEndTime] = useState('');
  const [popupTranslateY, setPopupTranslateY] = useState(0);
  const popupDragRef = useRef<{ startY: number } | null>(null);

  const currentDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dayOffset]);

  const dateStr = toDateStr(currentDate);
  const todayStr = toDateStr(new Date());
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      scrollRef.current.scrollTop = Math.max(0, (minutes / 60) * HOUR_HEIGHT - 240);
    }
  }, [loading]);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([getCategories(), getTodosByDate(dateStr)])
      .then(([cats, todosData]) => {
        setCategories(cats);
        setTodos(todosData);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '오류가 발생했습니다.'))
      .finally(() => setLoading(false));
  }, [dateStr]);

  const catColorMap = useMemo(() => {
    const m: Record<number, string> = {};
    categories.forEach((c) => { m[c.id] = c.color; });
    return m;
  }, [categories]);

  const timedTodos  = useMemo(() => todos.filter((t) => t.startTime && t.endTime), [todos]);
  const untimedTodos = useMemo(() => todos.filter((t) => !t.startTime), [todos]);
  const laidOut     = useMemo(() => layoutTimedTodos(timedTodos), [timedTodos]);

  const now = new Date();
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

  /* ── 투두 state 업데이트 헬퍼 ── */
  const updateTodo = (id: number, patch: Partial<TodoDto>) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const removeTodo = (id: number) =>
    setTodos((prev) => prev.filter((t) => t.id !== id));

  /* ── 팝업 열기/닫기 ── */
  const openPopup = (todo: TodoDto) => {
    setPopup(todo);
    setPopupMode('menu');
    setPopupEditName(todo.name);
    setPopupNewDate(todo.date);
    setPopupStartTime(todo.startTime ? todo.startTime.slice(0, 5) : '');
    setPopupEndTime(todo.endTime ? todo.endTime.slice(0, 5) : '');
    setPopupTranslateY(0);
  };

  const closePopup = () => {
    setPopup(null);
    setPopupMode('menu');
    setPopupTranslateY(0);
  };

  /* ── 드래그 닫기 핸들러 ── */
  const onHandlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    popupDragRef.current = { startY: e.clientY };
  };
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!popupDragRef.current) return;
    const delta = e.clientY - popupDragRef.current.startY;
    if (delta > 0) setPopupTranslateY(delta);
  };
  const onHandlePointerUp = (e: React.PointerEvent) => {
    if (!popupDragRef.current) return;
    const delta = e.clientY - popupDragRef.current.startY;
    popupDragRef.current = null;
    if (delta > 80) closePopup();
    else setPopupTranslateY(0);
  };

  /* ── 팝업 액션 핸들러 ── */
  const handleToggleDone = async () => {
    if (!popup) return;
    const backup = popup;
    const next = { ...popup, done: !popup.done };
    setPopup(null);
    updateTodo(popup.id, { done: next.done });
    try {
      await toggleTodoDone(popup.id);
    } catch {
      updateTodo(backup.id, { done: backup.done });
      setError('완료 상태 변경 실패');
    }
  };

  const handleDelete = async () => {
    if (!popup) return;
    const { id } = popup;
    setPopup(null);
    removeTodo(id);
    try {
      await deleteTodo(id);
    } catch {
      setError('삭제 실패');
    }
  };

  const handleSaveName = async () => {
    if (!popup || !popupEditName.trim()) return;
    const trimmed = popupEditName.trim();
    const backup = popup;
    setPopup(null);
    updateTodo(popup.id, { name: trimmed });
    try {
      await updateTodoName(popup.id, trimmed);
    } catch {
      updateTodo(backup.id, { name: backup.name });
      setError('수정 실패');
    }
  };

  const handleSaveDate = async () => {
    if (!popup || !popupNewDate) return;
    if (popupNewDate === popup.date) { closePopup(); return; }
    const backup = popup;
    setPopup(null);
    updateTodo(popup.id, { date: popupNewDate });
    try {
      await moveTodoDate(popup.id, popupNewDate);
    } catch {
      updateTodo(backup.id, { date: backup.date });
      setError('날짜 변경 실패');
    }
  };

  const handleSaveTime = async () => {
    if (!popup) return;
    const startTime = popupStartTime || null;
    const endTime   = popupEndTime   || null;
    const backup = popup;
    setPopup(null);
    updateTodo(popup.id, { startTime, endTime });
    try {
      await updateTodoTime(popup.id, startTime, endTime);
    } catch {
      updateTodo(backup.id, { startTime: backup.startTime, endTime: backup.endTime });
      setError('시간 변경 실패');
    }
  };

  const handleDoToday = async () => {
    if (!popup) return;
    const today = toDateStr(new Date());
    const backup = popup;
    setPopup(null);
    updateTodo(popup.id, { date: today });
    try {
      await moveTodoDate(popup.id, today);
    } catch {
      updateTodo(backup.id, { date: backup.date });
      setError('날짜 변경 실패');
    }
  };

  return (
    <div className="tl-tab">
      <div className="tl-tab-header">

      {/* ── 주간 스트립 ── */}
      <div className="tl-week-strip">
        <button className="tl-strip-arrow" onClick={() => setDayOffset((o) => o - 7)}>‹</button>
        <div className="tl-strip-days">
          {weekDates.map((d) => {
            const ds = toDateStr(d);
            const isSelected = ds === dateStr;
            const isToday = ds === todayStr;
            const dow = d.getDay();
            const dayCls = dow === 6 ? 'sat' : dow === 0 ? 'sun' : '';
            return (
              <button
                key={ds}
                className={`tl-strip-day ${isSelected ? 'selected' : ''}`}
                onClick={() =>
                  setDayOffset(Math.round((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000))
                }
              >
                <span className={`tl-strip-dow ${dayCls}`}>{['일','월','화','수','목','금','토'][dow]}</span>
                <span className={`tl-strip-date ${dayCls} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}>
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        <button className="tl-strip-arrow" onClick={() => setDayOffset((o) => o + 7)}>›</button>
      </div>

      {/* ── 날짜 헤더 ── */}
      <div className="tl-date-header">
        <button className="tl-nav-btn" onClick={() => setDayOffset((o) => o - 1)}>‹</button>
        <span className="tl-date-label">{formatDate(currentDate)}</span>
        {dayOffset !== 0 && (
          <button className="tl-today-btn" onClick={() => setDayOffset(0)}>오늘</button>
        )}
        <button className="tl-nav-btn" onClick={() => setDayOffset((o) => o + 1)}>›</button>
      </div>

      {error && <p className="tl-error">{error}</p>}

      {/* ── 시간 미지정 투두 ── */}
      {untimedTodos.length > 0 && (
        <div className="tl-untimed">
          <span className="tl-untimed-label">시간 미지정</span>
          <div className="tl-untimed-list">
            {untimedTodos.map((t) => (
              <span
                key={t.id}
                className={`tl-untimed-chip ${t.done ? 'done' : ''}`}
                style={{
                  background: `${catColorMap[t.categoryId] ?? '#888'}22`,
                  borderColor: catColorMap[t.categoryId] ?? '#888',
                  cursor: 'pointer',
                }}
                onClick={() => openPopup(t)}
              >
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* ── 타임라인 ── */}
      <div className="tl-scroll" ref={scrollRef}>
        {loading && <div className="tl-loading">불러오는 중...</div>}
        <div className="tl-body">

          {/* 시간 거터 */}
          <div className="tl-gutter">
            {HOURS.map((h) => (
              <div key={h} className="tl-hour-label" style={{ height: HOUR_HEIGHT }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {/* 이벤트 영역 */}
          <div className="tl-events" style={{ height: HOUR_HEIGHT * 24 }}>
            {HOURS.map((h) => (
              <div key={h} className={`tl-hour-line ${h % 6 === 0 ? 'major' : ''}`} style={{ top: h * HOUR_HEIGHT }} />
            ))}
            {HOURS.map((h) => (
              <div key={`half-${h}`} className="tl-half-line" style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
            ))}

            {/* 투두 블록 */}
            {laidOut.map((todo) => {
              const startMin = timeToMinutes(todo.startTime!);
              const endMin   = timeToMinutes(todo.endTime!);
              const duration = Math.max(endMin - startMin, 15);
              const top      = (startMin / 60) * HOUR_HEIGHT;
              const height   = Math.max((duration / 60) * HOUR_HEIGHT, 22);
              const BLOCK_W  = 100;
              const left     = `${todo.col * (BLOCK_W + BLOCK_GAP) + BLOCK_GAP}px`;
              const width    = `${BLOCK_W}px`;
              const color    = catColorMap[todo.categoryId] ?? '#888888';

              return (
                <div
                  key={todo.id}
                  className={`tl-todo-block ${todo.done ? 'done' : ''}`}
                  style={{ top, height, left, width, background: `${color}28`, borderLeft: `3px solid ${color}` }}
                  onClick={() => openPopup(todo)}
                >
                  {height >= 24 && <span className="tl-todo-name">{todo.name}</span>}
                  {height >= 40 && (
                    <span className="tl-todo-time">
                      {todo.startTime?.slice(0, 5)} ~ {todo.endTime?.slice(0, 5)}
                    </span>
                  )}
                </div>
              );
            })}

            {/* 현재 시간선 */}
            {dateStr === todayStr && (
              <div className="tl-now-line" style={{ top: nowTop }}>
                <span className="tl-now-dot" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 바텀시트 팝업 ── */}
      {popup && (
        <div className="todo-popup-overlay" onClick={closePopup}>
          <div
            className="todo-popup"
            style={{
              transform: `translateY(${popupTranslateY}px)`,
              transition: popupDragRef.current ? 'none' : 'transform 0.2s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="todo-popup-handle"
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
            />

            {popupMode === 'menu' && (
              <>
                <p className="todo-popup-title">{popup.name}</p>
                <div className="todo-popup-actions">
                  <button
                    className={popup.done ? 'tl-popup-undone' : 'tl-popup-done'}
                    onClick={handleToggleDone}
                  >
                    {popup.done ? '↩️ \u00a0미완료로 변경' : '✅ \u00a0완료'}
                  </button>
                  <button onClick={() => setPopupMode('edit')}>✏️ &nbsp;수정</button>
                  <button onClick={() => setPopupMode('time')}>⏰ &nbsp;시간 등록하기</button>
                  <button onClick={() => setPopupMode('date')}>📅 &nbsp;날짜 바꾸기</button>
                  {popup.date !== todayStr && (
                    <button onClick={handleDoToday}>⚡ &nbsp;오늘하기</button>
                  )}
                  <button className="todo-popup-delete" onClick={handleDelete}>
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
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setPopupMode('menu');
                  }}
                  autoFocus
                />
                <div className="todo-popup-row">
                  <button onClick={() => setPopupMode('menu')}>취소</button>
                  <button className="todo-popup-confirm" onClick={handleSaveName}>저장</button>
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
                  <button className="todo-popup-confirm" onClick={handleSaveDate}>저장</button>
                </div>
              </>
            )}

            {popupMode === 'time' && (
              <>
                <p className="todo-popup-label">시간 등록</p>
                <div className="todo-popup-time-row">
                  <label className="todo-popup-time-label">시작</label>
                  <input
                    type="time"
                    className="todo-popup-input todo-popup-time-input"
                    value={popupStartTime}
                    onChange={(e) => setPopupStartTime(e.target.value)}
                  />
                </div>
                <div className="todo-popup-time-row">
                  <label className="todo-popup-time-label">종료</label>
                  <input
                    type="time"
                    className="todo-popup-input todo-popup-time-input"
                    value={popupEndTime}
                    onChange={(e) => setPopupEndTime(e.target.value)}
                  />
                </div>
                <div className="todo-popup-row">
                  <button onClick={() => setPopupMode('menu')}>취소</button>
                  <button className="todo-popup-confirm" onClick={handleSaveTime}>저장</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
