// ============================================
// 讯飞语音合成（流式版）WebSocket API
// - 文字转语音播放
// - 支持发音人切换（男声/女声）
// ============================================

const TTS_APP_ID = "b6427154";
const TTS_API_KEY = "4e1ff88bf9216fac771776a3f6bdc379";
const TTS_API_SECRET = "NTEyNDJiNjJjODRlZDM3YWQ5OTBmMGVh";
const TTS_WS_URL = "wss://tts-api.xfyun.cn/v2/tts";

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

// ---------- 鉴权（复用讯飞 HMAC-SHA256 签名） ----------

function ttsGetRFC1123Date() {
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

async function ttsHmacSha256(message, secret) {
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

async function ttsGetAuthUrl() {
  const url = new URL(TTS_WS_URL);
  const host = url.host;
  const date = ttsGetRFC1123Date();
  const path = url.pathname;

  const signatureOrigin =
    "host: " + host + "\n" +
    "date: " + date + "\n" +
    "GET " + path + " HTTP/1.1";

  const signature = await ttsHmacSha256(signatureOrigin, TTS_API_SECRET);

  const authOrigin =
    'api_key="' + TTS_API_KEY +
    '", algorithm="hmac-sha256"' +
    ', headers="host date request-line"' +
    ', signature="' + signature + '"';

  const authorization = btoa(authOrigin);

  url.searchParams.set("host", host);
  url.searchParams.set("date", date);
  url.searchParams.set("authorization", authorization);

  return url.toString();
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

  const blob = new Blob([bytes.buffer], { type: "audio/mp3" });
  const url = URL.createObjectURL(blob);

  var audioEl = window._sharedAudio || new Audio();
  // 共享 Audio 元素被移除时回退到新建
  if (!audioEl || !document.contains(audioEl)) {
    audioEl = new Audio();
  }
  audioEl.pause();
  if (audioEl.src) {
    URL.revokeObjectURL(audioEl.src);
  }
  audioEl.src = url;
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
        common: { app_id: TTS_APP_ID },
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

