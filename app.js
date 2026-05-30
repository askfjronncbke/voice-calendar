// ============================================
// 主逻辑入口
// - 初始化日历界面
// - 全局事件：点击空白处关闭语音提示
// ============================================

document.addEventListener("click", function (e) {
  // 按钮有自己的交互逻辑，不关闭提示
  if (e.target.closest("#micBtn")) return;
  if (e.target.closest("#diaryImageBtn")) return;
  if (e.target.closest("#conflictConfirm")) return;
  if (e.target.closest("#conflictCancel")) return;
  if (e.target.closest("#cloudClose")) return;
  if (e.target.closest(".nav-tab")) return;

  var vr = document.getElementById("voiceResult");
  var ve = document.getElementById("voiceError");
  if (vr) vr.textContent = "";
  if (ve) ve.textContent = "";
});

// 冲突提示按钮事件 + 页面加载后自动播报今日事件
var _greeted = false;
document.addEventListener("DOMContentLoaded", function () {
  var confirmBtn = document.getElementById("conflictConfirm");
  var cancelBtn = document.getElementById("conflictCancel");
  if (confirmBtn) confirmBtn.addEventListener("click", confirmAdd);
  if (cancelBtn) cancelBtn.addEventListener("click", cancelAdd);

  if (!_greeted) {
    _greeted = true;
    setTimeout(showCloudGreeting, 600);
  }

  // 底部导航切换
  var navTabs = document.querySelectorAll(".nav-tab");
  navTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var page = this.getAttribute("data-page");
      switchPage(page);
    });
  });
});

function switchPage(name) {
  document.querySelectorAll(".page").forEach(function (p) {
    p.classList.remove("active");
  });
  document.querySelectorAll(".nav-tab").forEach(function (t) {
    t.classList.remove("active");
  });

  var pageEl = document.getElementById("page-" + name);
  if (pageEl) pageEl.classList.add("active");

  var tabEl = document.querySelector('.nav-tab[data-page="' + name + '"]');
  if (tabEl) tabEl.classList.add("active");
}
