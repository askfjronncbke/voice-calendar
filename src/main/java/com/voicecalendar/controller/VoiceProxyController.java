package com.voicecalendar.controller;

import com.voicecalendar.service.IflytekAuthService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@RestController
@RequestMapping("/api/voice-proxy")
public class VoiceProxyController {

    private final IflytekAuthService iflytekAuthService;
    private final RestTemplate restTemplate;

    public VoiceProxyController(IflytekAuthService iflytekAuthService) {
        this.iflytekAuthService = iflytekAuthService;
        this.restTemplate = new RestTemplate();
    }

    private String deepseekApiKey() {
        String key = System.getenv("DEEPSEEK_API_KEY");
        if (key == null || key.isBlank()) {
            throw new RuntimeException("Missing environment variable: DEEPSEEK_API_KEY");
        }
        return key;
    }

    // ---------- DeepSeek 代理 ----------

    @PostMapping("/deepseek")
    public ResponseEntity<?> proxyDeepSeek(@RequestBody Map<String, Object> body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(deepseekApiKey());

            HttpEntity<Map<String, Object>> request =
                    new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    "https://api.deepseek.com/chat/completions", request, String.class);

            return ResponseEntity
                    .status(response.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(response.getBody());
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("error", "DeepSeek proxy error: " + e.getMessage()));
        }
    }

    // ---------- 讯飞语音识别鉴权 ----------

    @GetMapping("/speech-auth")
    public ResponseEntity<?> getSpeechAuth() {
        try {
            Map<String, String> auth = iflytekAuthService.generateSpeechAuth();
            return ResponseEntity.ok(auth);
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Speech auth error: " + e.getMessage()));
        }
    }

    // ---------- 讯飞 TTS 鉴权 ----------

    @GetMapping("/debug/env")
    public ResponseEntity<?> debugEnv() {
        var vars = System.getenv().entrySet().stream()
                .filter(e -> e.getKey().contains("IFLYTEK") || e.getKey().contains("DEEPSEEK"))
                .sorted(Map.Entry.comparingByKey())
                .map(e -> e.getKey() + "=" + (e.getValue().length() > 20 ? e.getValue().substring(0, 20) + "..." : e.getValue()))
                .toList();
        return ResponseEntity.ok(Map.of("count", vars.size(), "vars", vars));
    }

    @GetMapping("/tts-auth")
    public ResponseEntity<?> getTtsAuth() {
        try {
            Map<String, String> auth = iflytekAuthService.generateTtsAuth();
            return ResponseEntity.ok(auth);
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "TTS auth error: " + e.getMessage()));
        }
    }
}
