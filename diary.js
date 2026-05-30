// ============================================
// 日记功能
// - localStorage 存储日记内容
// - 打字输入 + 自动保存
// - 年月快速选择（下拉列表）
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

function fmtDateISO(year, month, day) {
  return (
    String(year).padStart(4, "0") +
    "-" +
    String(month + 1).padStart(2, "0") +
    "-" +
    String(day).padStart(2, "0")
  );
}

function loadDiary(dateStr) {
  diaryDate = dateStr;
  const parts = dateStr.split("-");
  diaryYear = parseInt(parts[0]);
  diaryMonth = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  document.getElementById("diaryYearBtn").textContent = diaryYear + "年";
  document.getElementById("diaryMonthBtn").textContent = (diaryMonth + 1) + "月";
  document.getElementById("diaryTitle").textContent = diaryYear + "年" + (diaryMonth + 1) + "月" + day + "日";
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

// ---------- 年月下拉选择 ----------

function buildYearDropdown() {
  const dropdown = document.getElementById("diaryYearDropdown");
  const currentYear = new Date().getFullYear();
  dropdown.innerHTML = "";
  for (let y = currentYear - 5; y <= currentYear + 5; y++) {
    const item = document.createElement("div");
    item.classList.add("diary-dropdown-item");
    if (y === diaryYear) item.classList.add("selected");
    item.textContent = y + "年";
    item.addEventListener("click", function () {
      diaryYear = y;
      document.getElementById("diaryYearBtn").textContent = y + "年";
      closeAllDropdowns();
      applyDiaryDate();
    });
    dropdown.appendChild(item);
  }
}

function buildMonthDropdown() {
  const dropdown = document.getElementById("diaryMonthDropdown");
  dropdown.innerHTML = "";
  for (let m = 1; m <= 12; m++) {
    const item = document.createElement("div");
    item.classList.add("diary-dropdown-item");
    if (m === diaryMonth + 1) item.classList.add("selected");
    item.textContent = m + "月";
    item.addEventListener("click", function () {
      diaryMonth = m - 1;
      document.getElementById("diaryMonthBtn").textContent = m + "月";
      closeAllDropdowns();
      applyDiaryDate();
    });
    dropdown.appendChild(item);
  }
}

function applyDiaryDate() {
  const today = new Date();
  let day = 1;
  if (diaryYear === today.getFullYear() && diaryMonth === today.getMonth()) {
    day = today.getDate();
  }
  diaryDate = fmtDateISO(diaryYear, diaryMonth, day);
  document.getElementById("diaryTitle").textContent = diaryYear + "年" + (diaryMonth + 1) + "月" + day + "日";
  document.getElementById("diaryTextarea").value = getDiary(diaryDate);
  document.getElementById("diaryYearBtn").textContent = diaryYear + "年";
  document.getElementById("diaryMonthBtn").textContent = (diaryMonth + 1) + "月";
}

function toggleYearDropdown() {
  var dd = document.getElementById("diaryYearDropdown");
  var md = document.getElementById("diaryMonthDropdown");
  md.classList.remove("show");
  buildYearDropdown();
  dd.classList.toggle("show");
}

function toggleMonthDropdown() {
  var dd = document.getElementById("diaryMonthDropdown");
  var yd = document.getElementById("diaryYearDropdown");
  yd.classList.remove("show");
  buildMonthDropdown();
  dd.classList.toggle("show");
}

function closeAllDropdowns() {
  document.getElementById("diaryYearDropdown").classList.remove("show");
  document.getElementById("diaryMonthDropdown").classList.remove("show");
}

document.addEventListener("click", function (e) {
  if (!e.target.closest(".diary-ym-btn") && !e.target.closest(".diary-dropdown")) {
    closeAllDropdowns();
  }
});

// ---------- 自定义确认弹窗 ----------

function showDiaryConfirm(onConfirm) {
  const overlay = document.getElementById("diaryConfirmModal");
  document.getElementById("diaryConfirmMsg").textContent = "确定清空今天的日记吗？";
  overlay.classList.add("show");
  document.getElementById("diaryConfirmYes").onclick = function () {
    overlay.classList.remove("show");
    onConfirm();
  };
  document.getElementById("diaryConfirmNo").onclick = function () {
    overlay.classList.remove("show");
  };
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

  document.getElementById("diaryYearBtn").addEventListener("click", toggleYearDropdown);
  document.getElementById("diaryMonthBtn").addEventListener("click", toggleMonthDropdown);

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
