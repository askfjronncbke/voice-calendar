// ============================================
// 设置页面
// - 声音设置：发音人、语音播报开关
// - 显示设置：主题模式、大字号
// - 帮助：语音播报支持指令
// - localStorage 持久化
// ============================================

const SETTINGS_KEY = "voice_calendar_settings";

const DEFAULTS = {
  voice: "female",
  ttsEnabled: true,
  theme: "dark",
  largeFont: false,
};

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

// ---------- 应用设置到 UI ----------

function applyTheme() {
  const theme = _settings.theme;
  document.body.classList.remove("theme-light", "theme-system");

  if (theme === "light") {
    document.body.classList.add("theme-light");
  } else if (theme === "system") {
    document.body.classList.add("theme-system");
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

// ---------- 系统主题跟随 ----------

function initSystemThemeListener() {
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", function () {
    if (_settings.theme === "system") {
      applyTheme();
    }
  });
}

// ---------- 选项按钮组 ----------

function initOptionGroups() {
  document.querySelectorAll(".settings-option-group").forEach(function (group) {
    var key = group.getAttribute("data-key");
    var buttons = group.querySelectorAll(".settings-option-btn");

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        setSetting(key, btn.getAttribute("data-value"));
        if (key === "voice") {
          setTTSVoice(_settings.voice);
        }
        if (key === "theme") {
          applyTheme();
        }
      });
    });
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

// ---------- 帮助按钮 ----------

function initHelpButton() {
  var helpBtn = document.getElementById("settingsHelpBtn");
  if (!helpBtn) return;

  helpBtn.addEventListener("click", function () {
    var cmds = [
      "添加日程，例如：明天下午3点开会",
      "查询日程，例如：今天有什么安排",
      "删除日程，例如：删除明天的会议",
      "你也可以说：下周一下午2点去医院",
    ];
    speak("支持的语音指令如下：" + cmds.join("。"));
  });
}

// ---------- 设置页面激活时刷新 UI ----------

function refreshSettingsUI() {
  // 同步选项按钮
  document.querySelectorAll(".settings-option-group").forEach(function (group) {
    var key = group.getAttribute("data-key");
    var val = _settings[key];
    var buttons = group.querySelectorAll(".settings-option-btn");
    buttons.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-value") === val);
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
  initOptionGroups();
  initToggles();
  initHelpButton();
  initSystemThemeListener();
}
