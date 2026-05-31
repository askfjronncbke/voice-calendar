// ============================================
// 日记功能
// - localStorage 存储日记内容
// - 打字输入 + 自动保存
// - 迷你日历弹窗选择日期
// - 语音输入（追加到日记内容）
// ============================================

const DIARY_KEY = "voice_calendar_diary";

function getDiary(dateStr) {
  const raw = localStorage.getItem(DIARY_KEY);
  const all = raw ? JSON.parse(raw) : {};
  return all[dateStr] || "";
}

function saveDiary(dateStr, content) {
  const raw = localStorage.getItem(DIARY_KEY);
  const all = raw ? JSON.parse(raw) : {};
  all[dateStr] = content;
  localStorage.setItem(DIARY_KEY, JSON.stringify(all));
}

function hasDiary(dateStr) {
  const content = getDiary(dateStr);
  return content && content.trim().length > 0;
}

let diaryDate = null;
let diarySaveTimer = null;
let diaryYear = null;
let diaryMonth = null;

// 迷你日历当前查看的年月
let _mcYear = null;
let _mcMonth = null;

function fmtDateISO(year, month, day) {
  return (
    String(year).padStart(4, "0") +
    "-" +
    String(month + 1).padStart(2, "0") +
    "-" +
    String(day).padStart(2, "0")
  );
}

function fmtDateLabel(year, month, day) {
  return year + "年" + (month + 1) + "月" + day + "日";
}

function loadDiary(dateStr) {
  diaryDate = dateStr;
  const parts = dateStr.split("-");
  diaryYear = parseInt(parts[0]);
  diaryMonth = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  document.getElementById("diaryDateBtn").textContent = fmtDateLabel(diaryYear, diaryMonth, day);
  document.getElementById("diaryTextarea").value = getDiary(dateStr);
}

// ---------- 自动保存 ----------

function scheduleDiarySave() {
  if (diarySaveTimer) clearTimeout(diarySaveTimer);
  diarySaveTimer = setTimeout(function () {
    const textarea = document.getElementById("diaryTextarea");
    if (textarea && diaryDate) {
      saveDiary(diaryDate, textarea.value);
      renderCalendar();
    }
  }, 600);
}

// ---------- 迷你日历弹窗 ----------

function renderMiniCalendar() {
  const grid = document.getElementById("miniCalGrid");
  document.getElementById("miniCalYear").textContent = _mcYear + "年";
  document.getElementById("miniCalMonth").textContent = (_mcMonth + 1) + "月";

  grid.innerHTML = "";

  const firstDay = new Date(_mcYear, _mcMonth, 1).getDay();
  const daysInMonth = new Date(_mcYear, _mcMonth + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement("div");
    cell.classList.add("mini-cal-cell", "empty");
    grid.appendChild(cell);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.classList.add("mini-cal-cell");
    cell.textContent = d;

    const dateStr = fmtDateISO(_mcYear, _mcMonth, d);

    if (dateStr === diaryDate) {
      cell.classList.add("selected");
    }

    if (
      _mcYear === today.getFullYear() &&
      _mcMonth === today.getMonth() &&
      d === today.getDate()
    ) {
      cell.classList.add("today");
    }

    if (hasDiary(dateStr)) {
      const pencil = document.createElement("span");
      pencil.classList.add("mini-cal-pencil");
      pencil.textContent = "✏️";
      cell.appendChild(pencil);
    }

    cell.addEventListener("click", function () {
      diaryYear = _mcYear;
      diaryMonth = _mcMonth;
      diaryDate = dateStr;
      loadDiary(diaryDate);
      hideMiniCalendar();
    });

    grid.appendChild(cell);
  }
}

function showMiniCalendar() {
  _mcYear = diaryYear;
  _mcMonth = diaryMonth;
  renderMiniCalendar();
  document.getElementById("miniCalPopup").classList.add("show");
}

function hideMiniCalendar() {
  document.getElementById("miniCalPopup").classList.remove("show");
}

// ---------- 通用确认弹窗 ----------

function showConfirm(msg, onConfirm) {
  const overlay = document.getElementById("diaryConfirmModal");
  document.getElementById("diaryConfirmMsg").textContent = msg;
  overlay.classList.add("show");
  document.getElementById("diaryConfirmYes").onclick = function () {
    overlay.classList.remove("show");
    onConfirm();
  };
  document.getElementById("diaryConfirmNo").onclick = function () {
    overlay.classList.remove("show");
  };
}

function showBinaryConfirm(msg, yesLabel, noLabel, onYes, onNo) {
  var overlay = document.getElementById("diaryConfirmModal");
  var yesBtn = document.getElementById("diaryConfirmYes");
  var noBtn = document.getElementById("diaryConfirmNo");
  document.getElementById("diaryConfirmMsg").textContent = msg;
  yesBtn.textContent = yesLabel;
  noBtn.textContent = noLabel;
  overlay.classList.add("show");
  yesBtn.onclick = function () {
    overlay.classList.remove("show");
    yesBtn.textContent = "确定";
    noBtn.textContent = "取消";
    onYes();
  };
  noBtn.onclick = function () {
    overlay.classList.remove("show");
    yesBtn.textContent = "确定";
    noBtn.textContent = "取消";
    if (onNo) onNo();
  };
}
function showDiaryConfirm(onConfirm) {
  showConfirm("确定清空今天的日记吗？", onConfirm);
}

// ---------- 日记框拖拽调整高度 ----------

function initResizeHandle() {
  const handle = document.getElementById("diaryResizeHandle");
  const paper = document.querySelector(".diary-paper");
  let resizing = false;
  let _resizeOffsetY = 0;
  let _resizeStartH = 0;

  handle.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    resizing = true;
    handle.setPointerCapture(e.pointerId);
    _resizeOffsetY = e.clientY;
    _resizeStartH = paper.getBoundingClientRect().height;
    paper.style.flex = "none";
  });

  document.addEventListener("pointermove", function (e) {
    if (!resizing) return;
    var dy = e.clientY - _resizeOffsetY;
    paper.style.minHeight = Math.max(200, _resizeStartH + dy) + "px";
    paper.style.height = paper.style.minHeight;
  });

  document.addEventListener("pointerup", function () {
    if (resizing) {
      resizing = false;
    }
  });

  handle.addEventListener("pointercancel", function () {
    resizing = false;
  });
}

// ---------- 初始化 ----------

function initDiary() {
  const today = new Date();
  diaryYear = today.getFullYear();
  diaryMonth = today.getMonth();
  diaryDate = fmtDateISO(diaryYear, diaryMonth, today.getDate());
  loadDiary(diaryDate);

  document.getElementById("diaryDateBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    var popup = document.getElementById("miniCalPopup");
    if (popup.classList.contains("show")) {
      hideMiniCalendar();
    } else {
      showMiniCalendar();
    }
  });

  document.getElementById("miniCalPrevYear").addEventListener("click", function (e) {
    e.stopPropagation();
    _mcYear--;
    renderMiniCalendar();
  });

  document.getElementById("miniCalNextYear").addEventListener("click", function (e) {
    e.stopPropagation();
    _mcYear++;
    renderMiniCalendar();
  });

  document.getElementById("miniCalPrevMonth").addEventListener("click", function (e) {
    e.stopPropagation();
    if (_mcMonth === 0) {
      _mcYear--;
      _mcMonth = 11;
    } else {
      _mcMonth--;
    }
    renderMiniCalendar();
  });

  document.getElementById("miniCalNextMonth").addEventListener("click", function (e) {
    e.stopPropagation();
    if (_mcMonth === 11) {
      _mcYear++;
      _mcMonth = 0;
    } else {
      _mcMonth++;
    }
    renderMiniCalendar();
  });

  // 点击弹窗外部关闭
  document.addEventListener("click", function (e) {
    var popup = document.getElementById("miniCalPopup");
    if (!popup.classList.contains("show")) return;
    if (!e.target.closest("#miniCalPopup") && !e.target.closest("#diaryDateBtn")) {
      hideMiniCalendar();
    }
  });

  const textarea = document.getElementById("diaryTextarea");
  textarea.addEventListener("input", scheduleDiarySave);

  document.getElementById("diaryTrashBtn").addEventListener("click", function () {
    showDiaryConfirm(function () {
      textarea.value = "";
      saveDiary(diaryDate, "");
      renderCalendar();
    });
  });

  initResizeHandle();
}

document.addEventListener("DOMContentLoaded", initDiary);
