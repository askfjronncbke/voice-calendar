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

// ---------- 音频播放 ----------

function ttsPlayAudio(base64Audio) {
  // 将 base64 转为 Blob 并通过 Audio 元素播放
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes.buffer], { type: "audio/mp3" });
  const url = URL.createObjectURL(blob);

  if (ttsAudioEl) {
    ttsAudioEl.pause();
    URL.revokeObjectURL(ttsAudioEl.src);
  }

  ttsAudioEl = new Audio(url);
  ttsAudioEl.play().catch((e) => console.warn("TTS playback:", e.message));

  ttsAudioEl.onended = () => URL.revokeObjectURL(url);
}

// ---------- 合成与播放 ----------

async function speak(text) {
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
          vcn: speaker.vcn,
          speed: 50,
          volume: 50,
          pitch: 50,
          tte: "UTF8",
        },
        data: {
          status: 2,
          text: btoa(unescape(encodeURIComponent(text))),
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
          const fullAudio = audioChunks.join("");
          ttsPlayAudio(fullAudio);
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

// ---------- 初始化 ----------

function initTTS() {
  const toggle = document.getElementById("voiceToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      ttsCurrentVoice = ttsCurrentVoice === "female" ? "male" : "female";
      toggle.textContent = getTTSVoiceLabel();
    });
  }
}

document.addEventListener("DOMContentLoaded", initTTS);
