// ============================================
// 讯飞语音听写 WebSocket API 接入
// - 点击麦克风：开始录音 / 停止录音
// - HMAC-SHA256 鉴权签名
// - PCM 16kHz 16bit 单声道采集
// - 实时识别结果显示
// ============================================

let _speechAppId = null;

let isRecording = false;
let ws = null;
let audioContext = null;
let mediaStream = null;
let scriptProcessor = null;
let frameIndex = 0;
let accumulatedText = "";
let micBtn = null;
let voiceResult = null;
let voiceError = null;
let speechCallback = null;

function setSpeechCallback(fn) { speechCallback = fn; }

function setSpeechElements(mic, result, error) {
  micBtn = mic;
  voiceResult = result;
  voiceError = error;
}

// ---------- 工具函数 ----------

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let result = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    result += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(result);
}

// ---------- 鉴权 ----------

async function getAuthUrl() {
  const response = await fetch("https://voice-calendar-production.up.railway.app/api/voice-proxy/speech-auth");
  if (!response.ok) throw new Error("Speech auth error: " + response.status);
  const data = await response.json();
  _speechAppId = data.appId;
  return data.url;
}

// ---------- 发送音频帧 ----------

function sendAudioFrame(audioBase64, status) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const frame = {
    common: { app_id: _speechAppId },
    business: {
      language: "zh_cn",
      domain: "iat",
      accent: "mandarin",
      vad_eos: 10000,
      dwa: "wpgs",
    },
    data: {
      status: status,
      format: "audio/L16;rate=16000",
      encoding: "raw",
      audio: audioBase64,
    },
  };

  ws.send(JSON.stringify(frame));
}

// ---------- 处理识别结果 ----------

function handleMessage(event) {
  const msg = JSON.parse(event.data);

  if (msg.code !== 0) {
    console.error("iFlytek error:", msg.code, msg.message);
    voiceError.textContent = "语音识别出错: " + msg.message;
    return;
  }

  if (!msg.data || !msg.data.result) return;

  const result = msg.data.result;

  // 拼接当前片段的所有词
  let frag = "";
  for (const wsItem of result.ws) {
    for (const cw of wsItem.cw) {
      frag += cw.w;
    }
  }

  console.log("iFlytek fragment:", JSON.stringify(frag), "sn:", result.sn, "ls:", result.ls);

  // wpgs 模式每条消息含当前句子的完整文本（非增量），直接覆盖该句
  // 但有时最后一条消息只剩标点，所以只有含实质内容时才更新
  const hasContent = frag.replace(/[。，！？、\.\,\!\?\s]/g, "").length > 0;
  if (hasContent || !accumulatedText) {
    accumulatedText = frag;
  }

  voiceResult.textContent = accumulatedText;
  voiceResult.classList.remove("listening");

  // 收到最终结果时触发解析
  if (result.ls && accumulatedText.replace(/[。，！？、\.\,\!\?\s]/g, "").length > 0) {
    console.log("Final text for parsing:", JSON.stringify(accumulatedText));
    voiceError.textContent = "";
    if (speechCallback) {
      speechCallback(accumulatedText.trim());
      speechCallback = null;
    } else {
      parseAndExecute(accumulatedText.trim());
    }
  }
}

// ---------- 音频采集 ----------

async function startRecording() {
  voiceError.textContent = "";
  accumulatedText = "";
  voiceResult.textContent = "正在聆听...";
  voiceResult.classList.add("listening");
  micBtn.classList.add("recording");

  try {
    // 获取麦克风权限（指定 16kHz 单声道）
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
    });

    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStream);

    // ScriptProcessorNode 获取原始 PCM
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    frameIndex = 0;

    scriptProcessor.onaudioprocess = (e) => {
      if (!isRecording) return;
      const input = e.inputBuffer.getChannelData(0);

      // Float32 → Int16 PCM
      const int16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      const base64 = arrayBufferToBase64(int16.buffer);
      const status = frameIndex === 0 ? 0 : 1;
      sendAudioFrame(base64, status);
      frameIndex++;
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    // 连接 WebSocket
    const authUrl = await getAuthUrl();
    ws = new WebSocket(authUrl);

    ws.onopen = () => {
      console.log("iFlytek WS connected");
      isRecording = true;
    };

    ws.onmessage = handleMessage;

    ws.onerror = (e) => {
      console.error("WebSocket error:", e);
      voiceError.textContent = "连接讯飞服务失败，请检查网络";
      cleanupRecording();
    };

    ws.onclose = () => {
      console.log("iFlytek WS closed");
    };
  } catch (e) {
    console.error("Start recording failed:", e);
    if (e.name === "NotAllowedError") {
      voiceError.textContent = "请允许麦克风权限后重试";
    } else {
      voiceError.textContent = "录音启动失败: " + e.message;
    }
    cleanupRecording();
  }
}

function stopRecording() {
  // 发送结束帧
  if (ws && ws.readyState === WebSocket.OPEN && audioContext) {
    // 发送一帧空的结束标识
    sendAudioFrame("", 2);
  }

  // 延迟关闭 WebSocket，等待服务端返回最终结果
  setTimeout(() => {
    cleanupRecording();
  }, 800);
}

function cleanupRecording() {
  isRecording = false;
  micBtn.classList.remove("recording");
  accumulatedText = "";

  if (voiceResult.textContent === "正在聆听..." || !voiceResult.textContent) {
    voiceResult.classList.remove("listening");
  }

  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    ws = null;
  }
  frameIndex = 0;
}

// ---------- 初始化 ----------

let _isDragging = false;
let _justDragged = false;
let _offsetX = 0;
let _offsetY = 0;

function activeVoiceElements() {
  const diaryPage = document.getElementById("page-diary");
  if (diaryPage && diaryPage.classList.contains("active")) {
    return {
      result: document.getElementById("diaryVoiceResult"),
      error: document.getElementById("diaryVoiceError"),
    };
  }
  return {
    result: document.getElementById("voiceResult"),
    error: document.getElementById("voiceError"),
  };
}

var _audioUnlocked = false;
var _pendingGreeting = null;

function isAudioUnlocked() {
  return _audioUnlocked;
}

function unlockAudio(callback) {
  if (_audioUnlocked) return;
  _audioUnlocked = true;

  // 用 AudioContext 播放极短静音来可靠解锁浏览器的 autoplay 策略
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    var buffer = ctx.createBuffer(1, 1, 22050);
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    source.onended = function () {
      ctx.close().catch(function () {});
    };
  } catch (e) {
    // 降级：播放一段无声的数据 URI
    var dummy = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
    dummy.play().catch(function () {});
  }

  window._sharedAudio = new Audio();

  // 如果有待播报的问候语，立即播放
  if (_pendingGreeting) {
    var text = _pendingGreeting;
    _pendingGreeting = null;
    speak(text);
  }

  if (callback) callback();
}

function initSpeech() {
  micBtn = document.getElementById("micBtn");
  var els = activeVoiceElements();
  voiceResult = els.result;
  voiceError = els.error;

  // 长按拖动：第一次 pointermove 就进入拖拽，零延迟跟手
  micBtn.addEventListener("pointerdown", function (e) {
    var rect = micBtn.getBoundingClientRect();
    _offsetX = e.clientX - rect.left;
    _offsetY = e.clientY - rect.top;
    _isDragging = false;
  });

  document.addEventListener("pointermove", function (e) {
    if (_isDragging) {
      // 已在拖拽：跟随移动
      micBtn.style.left = (e.clientX - _offsetX) + "px";
      micBtn.style.top = (e.clientY - _offsetY) + "px";
      return;
    }

    // pointerdown 还没触发过（_offsetX 仍为 0 且未拖拽中），忽略
    if (_offsetX === 0 && _offsetY === 0) return;

    // 第一次移动：立刻切 fixed 并进入拖拽，然后立即跟手
    _isDragging = true;
    var rect = micBtn.getBoundingClientRect();
    micBtn.style.position = "fixed";
    micBtn.style.left = rect.left + "px";
    micBtn.style.top = rect.top + "px";
    micBtn.classList.add("dragging");
    // 接着立刻更新到当前光标位置（修复首次只能动一点点的 bug）
    micBtn.style.left = (e.clientX - _offsetX) + "px";
    micBtn.style.top = (e.clientY - _offsetY) + "px";
  });

  document.addEventListener("pointerup", function () {
    if (_isDragging) {
      _isDragging = false;
      micBtn.classList.remove("dragging");
      localStorage.setItem("mic_btn_position", JSON.stringify({
        left: parseInt(micBtn.style.left),
        top: parseInt(micBtn.style.top)
      }));
    }
    // 重置偏移量，防止后续无关的 pointermove 误触发拖拽
    _offsetX = 0;
    _offsetY = 0;
  });

  micBtn.addEventListener("pointercancel", function () {
    if (_isDragging) {
      _justDragged = true;
      _isDragging = false;
      micBtn.classList.remove("dragging");
    }
    _offsetX = 0;
    _offsetY = 0;
  });

  // ---- 短按录音 ----

  micBtn.addEventListener("click", function () {
    if (_isDragging || _justDragged) {
      _justDragged = false;
      return;
    }
    unlockAudio();
    var els = activeVoiceElements();
    voiceResult = els.result;
    voiceError = els.error;
    if (isRecording) {
      stopRecording();
    } else {
      var diaryPage = document.getElementById("page-diary");
      if (diaryPage && diaryPage.classList.contains("active")) {
        setSpeechCallback(function (text) {
          var textarea = document.getElementById("diaryTextarea");
          if (textarea) {
            var cur = textarea.value;
            var sep = cur && !cur.endsWith("\n") ? "\n" : "";
            textarea.value = cur + sep + text + "\n";
            saveDiary(diaryDate, textarea.value);
          }
          voiceResult.textContent = "";
        });
      } else {
        setSpeechCallback(null);
      }
      startRecording();
    }
  });

  // ---- 恢复上次位置 ----

  var saved = localStorage.getItem("mic_btn_position");
  if (saved) {
    var pos = JSON.parse(saved);
    micBtn.style.position = "fixed";
    micBtn.style.left = pos.left + "px";
    micBtn.style.top = pos.top + "px";
  }
}

document.addEventListener("DOMContentLoaded", initSpeech);
