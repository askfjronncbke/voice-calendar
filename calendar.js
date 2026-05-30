// ============================================
// 日历渲染逻辑
// - 渲染月视图（表头 + 42个日期格子）
// - 月份导航（上月/下月切换）
// - 有事件的日期显示小圆点标记
// - 点击日期显示/隐藏当天事件列表弹窗
// ============================================

let currentYear, currentMonth;
let selectedDate = null; // "YYYY-MM-DD"

function fmtDate(year, month, day) {
  return (
    String(year).padStart(4, "0") +
    "-" +
    String(month + 1).padStart(2, "0") +
    "-" +
    String(day).padStart(2, "0")
  );
}

function initCalendar() {
  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth();
  selectedDate = fmtDate(currentYear, currentMonth, today.getDate());
  renderCalendar();

  document.getElementById("prevMonth").addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    selectedDate = null;
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    selectedDate = null;
    renderCalendar();
  });
}

function renderCalendar() {
  document.getElementById("monthYear").textContent =
    currentYear + "年" + (currentMonth + 1) + "月";

  const daysGrid = document.getElementById("daysGrid");
  daysGrid.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const totalCells = 42;

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement("div");
    cell.classList.add("day-cell");

    let day, isOtherMonth = false, cellMonth, cellYear;

    if (i < firstDay) {
      day = daysInPrevMonth - firstDay + i + 1;
      isOtherMonth = true;
      cellMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      cellYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    } else if (i - firstDay >= daysInMonth) {
      day = i - firstDay - daysInMonth + 1;
      isOtherMonth = true;
      cellMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      cellYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    } else {
      day = i - firstDay + 1;
      cellMonth = currentMonth;
      cellYear = currentYear;
    }

    cell.textContent = day;

    const dateStr = fmtDate(cellYear, cellMonth, day);

    // 事件小圆点
    if (getEventsByDate(dateStr).length > 0) {
      const dot = document.createElement("span");
      dot.classList.add("dot");
      cell.appendChild(dot);
    }

    // 日记铅笔图标
    if (hasDiary(dateStr)) {
      const pencil = document.createElement("span");
      pencil.classList.add("pencil");
      pencil.textContent = "✏";
      cell.appendChild(pencil);
    }

    if (isOtherMonth) {
      cell.classList.add("other-month");
    }

    if (
      day === todayDate &&
      !isOtherMonth &&
      currentMonth === todayMonth &&
      currentYear === todayYear
    ) {
      cell.classList.add("today");
    }

    if (dateStr === selectedDate && !isOtherMonth) {
      cell.classList.add("selected");
    }

    cell.addEventListener("click", () => {
      if (isOtherMonth) return;
      selectedDate = dateStr;
      renderCalendar();
      showEventPanel(dateStr);
    });

    daysGrid.appendChild(cell);
  }

  // 重新渲染后恢复事件面板（当 selectedDate 在当前月份时）
  if (selectedDate) {
    const [y, m] = selectedDate.split("-").map(Number);
    if (y === currentYear && m === currentMonth + 1) {
      showEventPanel(selectedDate);
    } else {
      hideEventPanel();
    }
  } else {
    hideEventPanel();
  }
}

// ---------- 事件列表面板 ----------

function showEventPanel(dateStr) {
  const panel = document.getElementById("eventPanel");
  const dateEl = document.getElementById("eventPanelDate");
  const listEl = document.getElementById("eventList");

  // 容错：对非标准日期格式做显示处理
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    dateEl.textContent = parts[0] + "年" + parts[1] + "月" + parts[2] + "日";
  } else {
    dateEl.textContent = dateStr;
  }

  const events = getEventsByDate(dateStr);
  listEl.innerHTML = "";

  if (events.length === 0) {
    const empty = document.createElement("div");
    empty.classList.add("event-empty");
    empty.textContent = "暂无事件";
    listEl.appendChild(empty);
  } else {
    events.forEach((ev) => {
      const item = document.createElement("div");
      item.classList.add("event-item");

      const info = document.createElement("div");
      info.classList.add("event-info");

      const title = document.createElement("span");
      title.classList.add("event-title");
      title.textContent = ev.title;

      const time = document.createElement("span");
      time.classList.add("event-time");
      time.textContent = ev.time || "全天";

      info.appendChild(title);
      info.appendChild(time);

      const delBtn = document.createElement("button");
      delBtn.classList.add("event-delete");
      delBtn.textContent = "×";
      delBtn.title = "删除事件";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showConfirm("确定删除「" + ev.title + "」吗？", function () {
          deleteEvent(ev.id);
          renderCalendar();
          showEventPanel(dateStr);
        });
      });

      item.appendChild(info);
      item.appendChild(delBtn);
      listEl.appendChild(item);
    });
  }

  panel.classList.add("show");
}

function hideEventPanel() {
  const panel = document.getElementById("eventPanel");
  panel.classList.remove("show");
}

document.addEventListener("DOMContentLoaded", initCalendar);
