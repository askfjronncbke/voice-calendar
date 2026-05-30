// ============================================
// 设置页面
// - 声音设置：发音人下拉、语音播报开关
// - 显示设置：主题下拉（深色/浅色/跟随时间）、大字号
// - 帮助：点击弹出指令文字弹窗
// - localStorage 持久化
// ============================================

const SETTINGS_KEY = "voice_calendar_settings";

const DEFAULTS = {
  voice: "female",
  ttsEnabled: true,
  theme: "dark",
  largeFont: false,
};

const VOICE_LABELS = { female: "女声", male: "男声" };
const THEME_LABELS = { dark: "深色", light: "浅色", time: "跟随时间" };

let _settings = {};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    _settings = raw ? Object.assign({}, DEFAULTS, JSON.parse(raw)) : Object.assign({}, DEFAULTS);
  } catch (_) {
    _settings = Object.assign({}, DEFAULTS);
  }
  return _settings;
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(_settings));
}

function getSetting(key) {
  return _settings[key];
}

function setSetting(key, value) {
  _settings[key] = value;
  saveSettings();
}

// ---------- 跟随时间主题 ----------

let _timeThemeTimer = null;

function isDaytime() {
  var h = new Date().getHours();
  return h >= 6 && h < 18;
}

function applyTimeTheme() {
  if (_settings.theme !== "time") return;
  document.body.classList.remove("theme-light");
  document.body.classList.toggle("theme-time-light", isDaytime());
}

function startTimeThemeTimer() {
  if (_timeThemeTimer) clearInterval(_timeThemeTimer);
  _timeThemeTimer = setInterval(function () {
    if (_settings.theme === "time") {
      applyTimeTheme();
    }
  }, 60000);
}

// ---------- 应用设置到 UI ----------

function applyTheme() {
  var theme = _settings.theme;
  document.body.classList.remove("theme-light", "theme-time-light");

  if (theme === "light") {
    document.body.classList.add("theme-light");
  } else if (theme === "time") {
    if (isDaytime()) {
      document.body.classList.add("theme-time-light");
    }
    startTimeThemeTimer();
  } else {
    if (_timeThemeTimer) { clearInterval(_timeThemeTimer); _timeThemeTimer = null; }
  }
}

function applyLargeFont() {
  if (_settings.largeFont) {
    document.body.classList.add("large-font");
  } else {
    document.body.classList.remove("large-font");
  }
}

function applyAllSettings() {
  applyTheme();
  applyLargeFont();
  setTTSVoice(_settings.voice);
  setTTSEnabled(_settings.ttsEnabled);
}

// ---------- 下拉选择 ----------

function initSelects() {
  document.querySelectorAll(".settings-select").forEach(function (select) {
    var key = select.getAttribute("data-key");
    var btn = select.querySelector(".settings-select-btn");
    var dropdown = select.querySelector(".settings-select-dropdown");
    var items = dropdown.querySelectorAll(".settings-select-item");

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      // 关闭其他下拉
      document.querySelectorAll(".settings-select-dropdown.show").forEach(function (d) {
        if (d !== dropdown) d.classList.remove("show");
      });
      dropdown.classList.toggle("show");
    });

    items.forEach(function (item) {
      item.addEventListener("click", function () {
        var val = item.getAttribute("data-value");
        // 更新选中态
        items.forEach(function (i) { i.classList.remove("active"); });
        item.classList.add("active");
        // 更新按钮文字
        btn.textContent = item.textContent;
        // 关闭下拉
        dropdown.classList.remove("show");
        // 保存
        setSetting(key, val);
        if (key === "voice") {
          setTTSVoice(val);
        }
        if (key === "theme") {
          applyTheme();
        }
      });
    });
  });

  // 点击外部关闭下拉
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".settings-select")) {
      document.querySelectorAll(".settings-select-dropdown.show").forEach(function (d) {
        d.classList.remove("show");
      });
    }
  });
}

// ---------- 开关 ----------

function initToggles() {
  document.querySelectorAll(".settings-toggle-input").forEach(function (input) {
    var key = input.getAttribute("data-key");
    input.addEventListener("change", function () {
      setSetting(key, input.checked);
      if (key === "largeFont") {
        applyLargeFont();
      }
      if (key === "ttsEnabled") {
        setTTSEnabled(input.checked);
      }
    });
  });
}

// ---------- 帮助弹窗 ----------

function initHelpButton() {
  var helpBtn = document.getElementById("settingsHelpBtn");
  if (!helpBtn) return;

  var cmdsHTML = [
    "<b>添加日程</b>：明天下午3点开会",
    "<b>查询日程</b>：今天有什么安排 / 这周五忙不忙",
    "<b>删除日程</b>：删除明天的会议",
    "<b>日期表达</b>：今天/明天/后天/这周X/下周X/这周末",
    "<b>时间表达</b>：上午9点/下午3点半/晚上8点",
  ].join("<br><br>");

  helpBtn.addEventListener("click", function () {
    document.getElementById("helpModalMsg").innerHTML = cmdsHTML;
    document.getElementById("helpModal").classList.add("show");
  });

  document.getElementById("helpModalClose").addEventListener("click", function () {
    document.getElementById("helpModal").classList.remove("show");
  });
}

// ---------- 设置页面激活时刷新 UI ----------

function refreshSettingsUI() {
  // 同步下拉按钮
  var voiceBtn = document.getElementById("voiceSelectBtn");
  if (voiceBtn) voiceBtn.textContent = VOICE_LABELS[_settings.voice] || "女声";

  var themeBtn = document.getElementById("themeSelectBtn");
  if (themeBtn) themeBtn.textContent = THEME_LABELS[_settings.theme] || "深色";

  // 同步下拉选中态
  document.querySelectorAll(".settings-select").forEach(function (select) {
    var key = select.getAttribute("data-key");
    var val = _settings[key];
    var items = select.querySelectorAll(".settings-select-item");
    items.forEach(function (item) {
      item.classList.toggle("active", item.getAttribute("data-value") === val);
    });
  });

  // 同步开关
  document.querySelectorAll(".settings-toggle-input").forEach(function (input) {
    var key = input.getAttribute("data-key");
    input.checked = !!_settings[key];
  });
}

// ---------- 初始化 ----------

function initSettings() {
  loadSettings();
  applyAllSettings();
  initSelects();
  initToggles();
  initHelpButton();
}
