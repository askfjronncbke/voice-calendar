// ============================================
// 主逻辑入口
// - 初始化日历界面
// - 全局事件：点击空白处关闭语音提示
// ============================================

document.addEventListener("click", function (e) {
  // 点击麦克风按钮时不关闭提示（按钮有自己的交互逻辑）
  if (e.target.closest("#micBtn")) return;

  var vr = document.getElementById("voiceResult");
  var ve = document.getElementById("voiceError");
  if (vr) vr.textContent = "";
  if (ve) ve.textContent = "";
});
