# 语音日历 (Voice Calendar)

通过语音交互管理日程安排的 Web 应用。说出你的计划，日历自动帮你记录。

[▶ 点击观看演示视频](https://b23.tv/8Znf1hZ)

## 线上地址

| 模块 | 地址 |
|------|------|
| 前端 | [https://askfjronncbke.github.io/voice-calendar/](https://askfjronncbke.github.io/voice-calendar/) |
| 后端 API | `https://voice-calendar-production.up.railway.app` |

## 功能

### 语音交互

| 功能 | 示例 | 说明 |
|------|------|------|
| 添加事件 | "明天下午三点开会" | NLP 解析日期/时间/标题，自动存入日历 |
| 查询事件 | "我明天有什么安排" / "这周末有什么事" | 语音播报查询结果 |
| 删除事件 | "删除明天的开会" / "清除下周的事件" | 支持关键词匹配或清空全天/整周 |
| 修改事件 | "把明天的会议推迟到 4 点" | 修改已有事件的时间 |
| 语音播报 | 页面加载时自动播报 | 云朵问候 + TTS 播报今日事件和星期 |

### 日历界面

- 月视图日历，星空主题背景（深色/浅色切换）
- 事件小圆点标记 + 日记铅笔图标
- 点击日期展开事件列表，点击空白自动收起
- 跨月日期点击自动跳转到对应月份
- 事件按时间排序显示

### 日记

- 每日日记，自动保存（localStorage）
- 迷你日历弹窗快速切换日期
- 语音输入追加到日记内容
- 拖拽调整日记框高度

### 麦克风按钮

- 点击录音 / 再次点击停止
- 长按拖拽可自由移动位置（位置自动保存）
- 录音乐动波纹动画
- 浅色模式下拖拽光晕为红色

### 设置

- 发音人选择（男声/女声）
- 语音播报开关
- 主题模式（深色/浅色/跟随时间）
- 大字号模式
- 支持的语音指令帮助弹窗

### 日程管理

- 新增事件冲突检测与确认
- 删除事件二次确认弹窗
- 语音删除前确认弹窗
- 云朵今日播报 8 秒自动关闭

## 技术架构

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  GitHub Pages   │────▶│   Railway (SB)   │────▶│  DeepSeek   │
│  (前端静态页面)  │     │  (API 代理后端)   │     │  (NLP 解析)  │
└─────────────────┘     └────────┬─────────┘     └─────────────┘
                                 │                ┌─────────────┐
                                 └────────────────│  讯飞 IAT    │
                                                  │  (语音识别)   │
                                                  ├─────────────┤
                                                  │  讯飞 TTS    │
                                                  │  (语音合成)   │
                                                  └─────────────┘
```

| 模块 | 技术 | 说明 |
|------|------|------|
| 前端 | 原生 HTML/CSS/JS | 无框架依赖，星空主题 |
| 后端 | Spring Boot 3.2.5 / Java 21 | API 代理层，密钥安全隔离 |
| 部署 | GitHub Pages + Railway | 纯静态托管 + Spring Boot 容器 |
| NLP | DeepSeek API | 自然语言日期/意图解析 |
| 语音识别 | 讯飞语音听写 WebSocket API | 流式识别，PCM 16kHz |
| 语音合成 | 讯飞 TTS API | 事件播报 + 操作反馈 |
| 存储 | localStorage | 事件 + 日记 + 设置 + 按钮位置 |

## 本地开发

### 前端

```bash
# 用任意静态服务器打开，例如 VS Code Live Server
# 默认运行在 http://127.0.0.1:5500
```

### 后端

```bash
# 需要 JDK 21
set JAVA_HOME=<JDK 21 路径>

# 使用 Maven Wrapper 启动（无需全局安装 Maven）
.\mvnw.cmd spring-boot:run
# 默认运行在 http://localhost:8080
```

### 配置

复制 `src/main/resources/application.properties.example` 为 `application.properties`，填入 API 密钥：

```properties
iflytek.speech.appid=<你的讯飞 App ID>
iflytek.speech.apikey=<你的讯飞 API Key>
iflytek.speech.apisecret=<你的讯飞 API Secret>
iflytek.tts.appid=<你的讯飞 App ID>
iflytek.tts.apikey=<你的讯飞 API Key>
iflytek.tts.apisecret=<你的讯飞 API Secret>
deepseek.api.key=<你的 DeepSeek API Key>
```

或通过环境变量设置（Railway 部署方式）：

```
IFLYTEK_SPEECH_APPID
IFLYTEK_SPEECH_APIKEY
IFLYTEK_SPEECH_APISECRET
IFLYTEK_TTS_APPID
IFLYTEK_TTS_APIKEY
IFLYTEK_TTS_APISECRET
DEEPSEEK_API_KEY
```

## 后端 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/voice-proxy/deepseek` | POST | DeepSeek NLP 解析代理 |
| `/api/voice-proxy/speech-auth` | GET | 讯飞语音识别鉴权 |
| `/api/voice-proxy/tts-auth` | GET | 讯飞 TTS 鉴权 |

所有端点已配置 CORS，允许以下来源跨域访问：
- `https://askfjronncbke.github.io`
- `http://127.0.0.1:5500`
- `http://localhost:5500`

## 语音指令参考

| 用户说 | 系统动作 |
|--------|----------|
| "明天下午三点开会" | 添加事件：明天 15:00 开会 |
| "周五聚餐" | 添加事件：周五全天 聚餐 |
| "我明天有什么安排" | 语音播报明天所有事件 |
| "这周末有什么事" | 查询周六+周日事件 |
| "这个月还有什么安排" | 查询本月所有事件 |
| "我下周有什么安排" | 查询下周一到周日事件 |
| "删除明天的开会" | 删除匹配事件，二次确认 |
| "取消这周日的安排" | 删除该日全部事件 |
| "清除下周的事件" | 删除下周全部事件 |
| "把明天的会议推迟到 4 点" | 修改事件时间为 16:00 |

## 已知限制

- 语音识别需要 Chrome 浏览器、麦克风权限、网络连接
- 讯飞 API 免费额度有限（每日 500 次）
- 数据仅存储在本地浏览器，清除缓存会丢失
- V1 不支持：用户登录、云同步、重复事件、iCal 导入导出
