// ============================================
// 讯飞语音听写 WebSocket API 接入
// - 点击麦克风：开始录音 / 停止录音
// - HMAC-SHA256 鉴权签名
// - PCM 16kHz 16bit 单声道采集
// - 实时识别结果显示
// ============================================

const APP_ID = "b6427154";
const API_KEY = "4e1ff88bf9216fac771776a3f6bdc379";
const API_SECRET = "NTEyNDJiNjJjODRlZDM3YWQ5OTBmMGVh";
const WS_URL = "wss://iat-api.xfyun.cn/v2/iat";

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

function getRFC1123Date() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const d = new Date();
  return (
    days[d.getUTCDay()] +
    ", " +
    String(d.getUTCDate()).padStart(2, "0") +
    " " +
    months[d.getUTCMonth()] +
    " " +
    d.getUTCFullYear() +
    " " +
    String(d.getUTCHours()).padStart(2, "0") +
    ":" +
    String(d.getUTCMinutes()).padStart(2, "0") +
    ":" +
    String(d.getUTCSeconds()).padStart(2, "0") +
    " GMT"
  );
}

async function hmacSha256(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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
  const url = new URL(WS_URL);
  const host = url.host;
  const date = getRFC1123Date();

  const signatureOrigin =
    "host: " + host + "\n" +
    "date: " + date + "\n" +
    "GET " + url.pathname + " HTTP/1.1";

  const signature = await hmacSha256(signatureOrigin, API_SECRET);

  const authOrigin =
    'api_key="' + API_KEY +
    '", algorithm="hmac-sha256"' +
    ', headers="host date request-line"' +
    ', signature="' + signature + '"';

  const authorization = btoa(authOrigin);

  url.searchParams.set("host", host);
  url.searchParams.set("date", date);
  url.searchParams.set("authorization", authorization);

  return url.toString();
}

// ---------- 发送音频帧 ----------

function sendAudioFrame(audioBase64, status) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const frame = {
    common: { app_id: APP_ID },
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

let _dragTimer = null;
let _isDragging = false;
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

function initSpeech() {
  micBtn = document.getElementById("micBtn");
  var els = activeVoiceElements();
  voiceResult = els.result;
  voiceError = els.error;

  // 长按拖动：中心偏移量 + 同步 setPointerCapture
  micBtn.addEventListener("pointerdown", function (e) {
    micBtn.setPointerCapture(e.pointerId);
    var rect = micBtn.getBoundingClientRect();
    _offsetX = e.clientX - (rect.left + rect.width / 2);
    _offsetY = e.clientY - (rect.top + rect.height / 2);

    _dragTimer = setTimeout(function () {
      _isDragging = true;
      micBtn.classList.add("dragging");
      if (!micBtn.style.position || micBtn.style.position !== "fixed") {
        micBtn.style.position = "fixed";
        micBtn.style.left = rect.left + "px";
        micBtn.style.top = rect.top + "px";
      }
    }, 500);
  });

  micBtn.addEventListener("pointermove", function (e) {
    if (!_isDragging) return;
    var r = micBtn.getBoundingClientRect();
    micBtn.style.left = (e.clientX - _offsetX - r.width / 2) + "px";
    micBtn.style.top = (e.clientY - _offsetY - r.height / 2) + "px";
  });

  micBtn.addEventListener("pointerup", function () {
    clearTimeout(_dragTimer);
    if (_isDragging) {
      micBtn.classList.remove("dragging");
      localStorage.setItem("mic_btn_position", JSON.stringify({
        left: parseInt(micBtn.style.left),
        top: parseInt(micBtn.style.top)
      }));
      _isDragging = false;
    }
  });

  micBtn.addEventListener("click", function () {
    if (_isDragging) return;
    // 根据当前活跃页面切换语音目标
    var els = activeVoiceElements();
    voiceResult = els.result;
    voiceError = els.error;

    if (isRecording) {
      stopRecording();
    } else {
      // 日记页面：设置追加回调
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
        });
      } else {
        setSpeechCallback(null);
      }
      startRecording();
    }
  });

  // 恢复上次拖拽位置
  var saved = localStorage.getItem("mic_btn_position");
  if (saved) {
    var pos = JSON.parse(saved);
    micBtn.style.position = "fixed";
    micBtn.style.left = pos.left + "px";
    micBtn.style.top = pos.top + "px";
  }
}

document.addEventListener("DOMContentLoaded", initSpeech);
