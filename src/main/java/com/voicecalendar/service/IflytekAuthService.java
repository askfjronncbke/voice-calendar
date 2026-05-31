package com.voicecalendar.service;

import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class IflytekAuthService {

    private static final String SPEECH_HOST = "iat-api.xfyun.cn";
    private static final String SPEECH_PATH = "/v2/iat";
    private static final String TTS_HOST = "tts-api.xfyun.cn";
    private static final String TTS_PATH = "/v2/tts";

    public Map<String, String> generateSpeechAuth() {
        return generateAuth(SPEECH_HOST, SPEECH_PATH,
                requireEnv("IFLYTEK_SPEECH_API_KEY"),
                requireEnv("IFLYTEK_SPEECH_API_SECRET"),
                requireEnv("IFLYTEK_SPEECH_APP_ID"));
    }

    public Map<String, String> generateTtsAuth() {
        return generateAuth(TTS_HOST, TTS_PATH,
                requireEnv("IFLYTEK_TTS_API_KEY"),
                requireEnv("IFLYTEK_TTS_API_SECRET"),
                requireEnv("IFLYTEK_TTS_APP_ID"));
    }

    private String requireEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new RuntimeException("Missing environment variable: " + name);
        }
        return value;
    }

    private Map<String, String> generateAuth(String host, String path,
                                              String apiKey, String apiSecret, String appId) {
        try {
            String date = DateTimeFormatter.RFC_1123_DATE_TIME
                    .format(ZonedDateTime.now(ZoneOffset.UTC));

            String signatureOrigin = "host: " + host + "\n"
                    + "date: " + date + "\n"
                    + "GET " + path + " HTTP/1.1";

            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec spec = new SecretKeySpec(
                    apiSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(spec);
            byte[] signatureBytes = mac.doFinal(
                    signatureOrigin.getBytes(StandardCharsets.UTF_8));
            String signature = Base64.getEncoder().encodeToString(signatureBytes);

            String authOrigin = "api_key=\"" + apiKey
                    + "\", algorithm=\"hmac-sha256\""
                    + ", headers=\"host date request-line\""
                    + ", signature=\"" + signature + "\"";
            String authorization = Base64.getEncoder()
                    .encodeToString(authOrigin.getBytes(StandardCharsets.UTF_8));

            String wsUrl = "wss://" + host + path
                    + "?host=" + URLEncoder.encode(host, StandardCharsets.UTF_8)
                    + "&date=" + URLEncoder.encode(date, StandardCharsets.UTF_8)
                    + "&authorization=" + URLEncoder.encode(authorization, StandardCharsets.UTF_8);

            Map<String, String> result = new HashMap<>();
            result.put("url", wsUrl);
            result.put("appId", appId);
            return result;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate iFlytek auth: " + e.getMessage(), e);
        }
    }
}
