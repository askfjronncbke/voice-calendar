// ============================================
// localStorage 事件管理
// - 事件数据结构: { id, date, time, title }
// - addEvent(date, time, title)      — 添加事件
// - deleteEvent(id)                  — 按 id 删除
// - getEventsByDate(date)            — 按日期查询事件
// ============================================

const STORAGE_KEY = "voice_calendar_events";

function getAllEvents() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveAllEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function addEvent(date, time, title) {
  const events = getAllEvents();
  const event = {
    id: generateId(),
    date: date,   // "YYYY-MM-DD"
    time: time,   // "HH:MM" 或空字符串
    title: title,
  };
  events.push(event);
  saveAllEvents(events);
  return event;
}

function deleteEvent(id) {
  const events = getAllEvents();
  const index = events.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const removed = events.splice(index, 1)[0];
  saveAllEvents(events);
  return removed;
}

function getEventsByDate(date) {
  return getAllEvents().filter((e) => e.date === date);
}
