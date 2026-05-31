// ============================================
// 讯飞语音合成（流式版）WebSocket API
// - 文字转语音播放
// - 支持发音人切换（男声/女声）
// ============================================

let _ttsAppId = null;

// 发音人配置
const SPEAKERS = {
  female: { vcn: "xiaoyan", label: "女声" },
  male:   { vcn: "aisjiuxu",  label: "男声" },
};

let ttsCurrentVoice = "female"; // "female" | "male"
let ttsAudioEl = null;
let ttsEnabled = true;

function setTTSEnabled(val) { ttsEnabled = !!val; }
function isTTSEnabled() { return ttsEnabled; }

// ---------- 鉴权（由 Java 后端代理生成签名 URL） ----------

async function ttsGetAuthUrl() {
  const response = await fetch("https://voice-calendar-production.up.railway.app/api/voice-proxy/tts-auth");
  if (!response.ok) throw new Error("TTS auth error: " + response.status);
  const data = await response.json();
  _ttsAppId = data.appId;
  return data.url;
}

// ---------- 音频解码 ----------

function safeAtob(b64) {
  // 去除空白字符
  let cleaned = b64.replace(/\s/g, "");
  // 处理 URL-safe base64（- → +, _ → /）
  cleaned = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  // 补齐 padding（atob 要求长度是4的倍数）
  while (cleaned.length % 4 !== 0) {
    cleaned += "=";
  }
  return atob(cleaned);
}

function decodeAudioChunks(chunks) {
  // 每个 chunk 是独立 base64 编码的，需要分别解码后拼接二进制数据
  const parts = [];
  for (const chunk of chunks) {
    try {
      parts.push(safeAtob(chunk));
    } catch (e) {
      console.warn("TTS: skipping chunk, decode failed:", e.message);
    }
  }
  if (parts.length === 0) return null;

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      combined[offset + i] = p.charCodeAt(i);
    }
    offset += p.length;
  }
  return combined;
}

function ttsPlayAudio(audioChunks) {
  const bytes = decodeAudioChunks(audioChunks);
  if (!bytes) return;

  // 优先使用已解锁的 AudioContext 播放（绕过 autoplay 限制）
  var ctx = window._ttsAudioCtx;
  if (ctx && ctx.state !== "closed") {
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    var audioData = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    ctx.decodeAudioData(audioData, function (buffer) {
      var source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }, function () {
      // MP3 解码失败，降级到 Audio 元素
      console.warn("TTS: AudioContext decode failed, falling back to Audio element");
      playViaAudioElement(bytes);
    });
  } else {
    // AudioContext 不可用，降级到 Audio 元素
    playViaAudioElement(bytes);
  }
}

function playViaAudioElement(bytes) {
  const blob = new Blob([bytes.buffer], { type: "audio/mp3" });
  const url = URL.createObjectURL(blob);
  var audioEl = new Audio(url);
  audioEl.play().catch(function (e) {
    console.warn("TTS playback:", e.message);
  });
  audioEl.onended = function () {
    URL.revokeObjectURL(url);
  };
  ttsAudioEl = audioEl;
}

// ---------- 文本编码（UTF-8 → base64）----------

function encodeText(text) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ---------- 合成与播放 ----------

async function speak(text) {
  if (!ttsEnabled) return;
  if (!text || !text.trim()) return;

  try {
    const authUrl = await ttsGetAuthUrl();
    const ws = new WebSocket(authUrl);

    const audioChunks = [];

    ws.onopen = () => {
      const speaker = SPEAKERS[ttsCurrentVoice] || SPEAKERS.female;

      const frame = {
        common: { app_id: _ttsAppId },
        business: {
          aue: "lame",
          sfl: 1,
          vcn: speaker.vcn,
          speed: 50,
          volume: 50,
          pitch: 50,
          tte: "UTF8",
        },
        data: {
          status: 2,
          text: encodeText(text),
        },
      };

      ws.send(JSON.stringify(frame));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.code !== 0) {
          console.error("TTS error:", msg.code, msg.message);
          return;
        }

        if (msg.data && msg.data.audio) {
          audioChunks.push(msg.data.audio);
        }

        // status=2 表示合成结束
        if (msg.data && msg.data.status === 2 && audioChunks.length > 0) {
          ttsPlayAudio(audioChunks);
          ws.close();
        }
      } catch (e) {
        console.error("TTS message parse error:", e);
      }
    };

    ws.onerror = (e) => {
      console.error("TTS WebSocket error:", e);
    };

    ws.onclose = () => {
      console.log("TTS WS closed");
    };
  } catch (e) {
    console.error("TTS speak error:", e);
  }
}

// ---------- 发音人切换 ----------

function setTTSVoice(voice) {
  if (SPEAKERS[voice]) {
    ttsCurrentVoice = voice;
  }
}

function getTTSVoice() {
  return ttsCurrentVoice;
}

function getTTSVoiceLabel() {
  return SPEAKERS[ttsCurrentVoice] ? SPEAKERS[ttsCurrentVoice].label : "女声";
}

