// ============================================
// 日历渲染逻辑
// - 渲染月视图（表头 + 42个日期格子）
// - 月份导航（上月/下月切换）
// - 有事件的日期显示小圆点标记
// - 点击日期显示/隐藏当天事件列表弹窗
// ============================================

let currentYear, currentMonth;

function initCalendar() {
  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth(); // 0-indexed
  renderCalendar();

  document.getElementById("prevMonth").addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });
}

function renderCalendar() {
  const monthYearEl = document.getElementById("monthYear");
  monthYearEl.textContent = currentYear + "年" + (currentMonth + 1) + "月";

  const daysGrid = document.getElementById("daysGrid");
  daysGrid.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const totalCells = 42; // 6 rows × 7 cols

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement("div");
    cell.classList.add("day-cell");

    let date, isOtherMonth = false;

    if (i < firstDay) {
      // 上个月末尾的日期
      date = daysInPrevMonth - firstDay + i + 1;
      isOtherMonth = true;
    } else if (i - firstDay >= daysInMonth) {
      // 下个月开头的日期
      date = i - firstDay - daysInMonth + 1;
      isOtherMonth = true;
    } else {
      // 当月日期
      date = i - firstDay + 1;
    }

    cell.textContent = date;

    if (isOtherMonth) {
      cell.classList.add("other-month");
    }

    if (
      date === todayDate &&
      !isOtherMonth &&
      currentMonth === todayMonth &&
      currentYear === todayYear
    ) {
      cell.classList.add("today");
    }

    daysGrid.appendChild(cell);
  }
}

document.addEventListener("DOMContentLoaded", initCalendar);
