// ============================================
// 侧边栏逻辑
// - 点击日期后从右侧滑入
// - 显示当天日期标题
// - 关闭按钮/点击遮罩收回
// ============================================

function openSidebar(dateStr) {
  var sidebar = document.getElementById("sidebar");
  var overlay = document.getElementById("sidebarOverlay");
  var dateEl = document.getElementById("sidebarDate");

  var parts = dateStr.split("-");
  if (parts.length === 3) {
    dateEl.textContent = parts[0] + "年" + parts[1] + "月" + parts[2] + "日";
  } else {
    dateEl.textContent = dateStr;
  }

  sidebar.classList.add("show");
  overlay.classList.add("show");
}

function closeSidebar() {
  var sidebar = document.getElementById("sidebar");
  var overlay = document.getElementById("sidebarOverlay");
  sidebar.classList.remove("show");
  overlay.classList.remove("show");
}

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("sidebarClose").addEventListener("click", closeSidebar);
  document.getElementById("sidebarOverlay").addEventListener("click", closeSidebar);
});
