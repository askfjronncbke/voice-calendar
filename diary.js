// ============================================
// 日记功能
// - localStorage 存储日记内容（含 base64 图片）
// - 打字输入 + 自动保存
// - 图片上传（base64 内嵌）
// - 语音输入（追加到日记内容）
// - 日期导航（左右箭头）
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

function fmtDiaryDate(dateStr) {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return parts[0] + "年" + parts[1] + "月" + parts[2] + "日";
  }
  return dateStr;
}

function loadDiary(dateStr) {
  diaryDate = dateStr;
  document.getElementById("diaryDate").textContent = fmtDiaryDate(dateStr);
  const textarea = document.getElementById("diaryTextarea");
  textarea.value = getDiary(dateStr);
}

function switchDiaryDate(delta) {
  const parts = diaryDate.split("-");
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + delta);
  const newDate = fmtDateISO(d.getFullYear(), d.getMonth(), d.getDate());
  loadDiary(newDate);
}

function fmtDateISO(year, month, day) {
  return (
    String(year).padStart(4, "0") +
    "-" +
    String(month + 1).padStart(2, "0") +
    "-" +
    String(day).padStart(2, "0")
  );
}

// ---------- 自动保存 ----------

function scheduleDiarySave() {
  if (diarySaveTimer) clearTimeout(diarySaveTimer);
  diarySaveTimer = setTimeout(function () {
    const textarea = document.getElementById("diaryTextarea");
    if (textarea && diaryDate) {
      saveDiary(diaryDate, textarea.value);
    }
  }, 600);
}

// ---------- 图片上传 ----------

function insertImage() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = function () {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      const textarea = document.getElementById("diaryTextarea");
      const imgMarkdown = "\n![图片](" + reader.result + ")\n";
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = textarea.value.substring(0, start);
      const after = textarea.value.substring(end);
      textarea.value = before + imgMarkdown + after;
      textarea.selectionStart = textarea.selectionEnd = start + imgMarkdown.length;
      textarea.focus();
      saveDiary(diaryDate, textarea.value);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ---------- 初始化 ----------

function initDiary() {
  const today = new Date();
  diaryDate = fmtDateISO(today.getFullYear(), today.getMonth(), today.getDate());
  loadDiary(diaryDate);

  document.getElementById("diaryPrevDay").addEventListener("click", function () {
    switchDiaryDate(-1);
  });
  document.getElementById("diaryNextDay").addEventListener("click", function () {
    switchDiaryDate(1);
  });

  const textarea = document.getElementById("diaryTextarea");
  textarea.addEventListener("input", scheduleDiarySave);

  document.getElementById("diaryImageBtn").addEventListener("click", insertImage);
}

document.addEventListener("DOMContentLoaded", initDiary);
