// ============================================
// 云朵今日播报
// - 页面加载时云朵从上方飘入
// - 显示今日问候语 + 事件列表
// - 关闭按钮触发飘出动画
// ============================================

function getWeekdayCN(date) {
  var days = ["日", "一", "二", "三", "四", "五", "六"];
  return "星期" + days[date.getDay()];
}

function showCloudGreeting() {
  var now = new Date();
  var hour = now.getHours();
  var greeting;
  if (hour >= 6 && hour < 11) greeting = "早上好呀";
  else if (hour >= 11 && hour < 13) greeting = "中午好呀";
  else if (hour >= 13 && hour < 18) greeting = "下午好呀";
  else greeting = "晚上好哦";

  var todayStr = fmtDateISO(now.getFullYear(), now.getMonth(), now.getDate());
  var weekday = getWeekdayCN(now);
  var events = getEventsByDate(todayStr);

  var cloud = document.getElementById("cloudGreeting");
  var cloudText = document.getElementById("cloudText");
  var cloudEvents = document.getElementById("cloudEvents");

  cloudText.textContent = greeting + "，今天是" + fmtSpokenDate(todayStr) + " " + weekday;

  cloudEvents.innerHTML = "";
  if (events.length === 0) {
    var empty = document.createElement("div");
    empty.className = "cloud-event-empty";
    empty.textContent = "暂无安排，祝您生活愉快！";
    cloudEvents.appendChild(empty);
  } else {
    sortEvents(events).forEach(function (e) {
      var item = document.createElement("div");
      item.className = "cloud-event-item";
      item.textContent = (e.time ? e.time + " " : "") + e.title;
      cloudEvents.appendChild(item);
    });
  }

  cloud.classList.add("show");

  // 8 秒后自动关闭
  if (window._cloudAutoCloseTimer) clearTimeout(window._cloudAutoCloseTimer);
  window._cloudAutoCloseTimer = setTimeout(closeCloudGreeting, 8000);

  // TTS 播报（若音频未解锁，暂存等待首次用户点击后播放）
  var greetingText;
  if (events.length === 0) {
    greetingText = greeting + "，今天是" + fmtSpokenDate(todayStr) + weekday + "，暂无安排，祝您生活愉快！";
  } else {
    var eventList = events
      .map(function (e) { return (e.time ? fmtSpokenTime(e.time) + "，" : "") + e.title; })
      .join("、");
    var blessing = getBlessing(events[events.length - 1].title);
    greetingText = greeting + "，今天是" + fmtSpokenDate(todayStr) + weekday + "，您有" + events.length + "个事件：" + eventList + "，" + blessing;
  }

  if (isAudioUnlocked()) {
    speak(greetingText);
  } else {
    _pendingGreeting = greetingText;
  }
}

function closeCloudGreeting() {
  if (window._cloudAutoCloseTimer) clearTimeout(window._cloudAutoCloseTimer);
  var cloud = document.getElementById("cloudGreeting");
  cloud.classList.add("hide");
  setTimeout(function () {
    cloud.classList.remove("show");
    cloud.classList.remove("hide");
  }, 400);
}

document.addEventListener("DOMContentLoaded", function () {
  var closeBtn = document.getElementById("cloudClose");
  if (closeBtn) closeBtn.addEventListener("click", closeCloudGreeting);
});
