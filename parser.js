// ============================================
// DeepSeek API 自然语言解析
// - 输入：语音识别文本
// - 输出：结构化意图 { action, date, time, title }
// - action: "add" | "query" | "delete"
// - 支持日期表达：明天/后天/大后天/这周X/下周X/这周末
// ============================================

const DEEPSEEK_KEY = "sk-6352b099114240fe9968455267ba6947";

// ---------- 日期工具 ----------

function fmtDateISO(year, month, day) {
  return (
    String(year).padStart(4, "0") +
    "-" +
    String(month + 1).padStart(2, "0") +
    "-" +
    String(day).padStart(2, "0")
  );
}

function buildDateContext() {
  const now = new Date();
  const today = fmtDateISO(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];

  const addDays = (d, n) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };

  const tomorrow = addDays(now, 1);
  const dayAfter = addDays(now, 2);
  const day3 = addDays(now, 3);

  // 使用 ISO 周历（周一为每周第一天），中文习惯以此计算"这周X"
  // getDay() 返回 0=Sun..6=Sat，转换为 isoDay 0=Mon..6=Sun
  const isoDay = (now.getDay() + 6) % 7;

  const thisWeek = {};
  const weekLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  for (let i = 0; i < 7; i++) {
    const offset = i - isoDay;
    const d = addDays(now, offset);
    thisWeek[weekLabels[i]] = fmtDateISO(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const nextWeek = {};
  for (let i = 0; i < 7; i++) {
    const offset = i - isoDay + 7;
    const d = addDays(now, offset);
    nextWeek[weekLabels[i]] = fmtDateISO(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // 这周末 = 本周六 + 本周日
  const weekendStart = thisWeek["周六"];
  const weekendEnd = thisWeek["周日"];

  const thisMonth = fmtDateISO(now.getFullYear(), now.getMonth(), 1).slice(0, 7); // "YYYY-MM"

  // 下周范围（周一到周日）
  const nextWeekStart = nextWeek["周一"];
  const nextWeekEnd = nextWeek["周日"];

  return {
    today,
    todayWeekday: "周" + dayOfWeek,
    tomorrow: fmtDateISO(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()),
    dayAfter: fmtDateISO(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate()),
    day3: fmtDateISO(day3.getFullYear(), day3.getMonth(), day3.getDate()),
    thisWeek,
    nextWeek,
    weekendStart,
    weekendEnd,
    thisMonth,
    nextWeekStart,
    nextWeekEnd,
  };
}

// ---------- DeepSeek API 调用 ----------

async function callDeepSeek(systemPrompt, userMessage) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + DEEPSEEK_KEY,
    },
    body: JSON.stringify({
      model: "deepseek-v4-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw new Error("DeepSeek API error: " + response.status);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ---------- 构建提示词 ----------

function buildSystemPrompt() {
  const ctx = buildDateContext();

  // 构建下周日期表（只列7天，用的时候就知道）
  const nextWeekTable = Object.entries(ctx.nextWeek)
    .map(([k, v]) => k + " = " + v)
    .join("，");

  return `你是语音日历解析器。根据用户语音输入返回一个 JSON。

=== 第一步：判断意图 action（最重要！必须严格执行！）===

按以下规则判断，按顺序匹配，命中即停止：

规则1 - 如果用户话里包含以下任一词语或句式 → action = "query"
  查询词/句式：
    有什么、有什么事、有什么安排、查一下、看一下、告诉我
    有空吗、有时间吗、忙不忙、怎么样、如何
    以"吗"结尾的疑问句（如"今天我有空吗"、"明天忙吗"）
    以"呢"结尾的疑问句（如"这个月还有什么事呢"）
    "这个月"/"本月" → 月份查询
  示例：
    "我明天有什么安排" → query
    "今天我有空吗" → query（以"吗"结尾）
    "这周五忙不忙" → query（含"忙不忙"）

规则2 - 如果用户话里包含以下任一词语 → action = "delete"
  删除词：删除、删掉、取消、去掉、移除
  示例："删除明天的开会" → delete

规则3 - 以上都不匹配 → action = "add"（默认！）
  注意：描述一件事、一个计划、一个安排，全都是 add
  示例："明天下午三点上课" → add（不是query！不含查询词！）
  示例："后天开会" → add
  示例："周五聚餐" → add

=== 第二步：提取信息 ===

当前日期：${ctx.today}（${ctx.todayWeekday}）
当前月份：${ctx.thisMonth}

日期映射（直接复制，不要自己算！表中每个日期都是正确的）：
今天=${ctx.today}  明天=${ctx.tomorrow}  后天=${ctx.dayAfter}  大后天=${ctx.day3}
这周一=${ctx.thisWeek.周一}  这周二=${ctx.thisWeek.周二}  这周三=${ctx.thisWeek.周三}
这周四=${ctx.thisWeek.周四}  这周五=${ctx.thisWeek.周五}  这周六=${ctx.thisWeek.周六}  这周日=${ctx.thisWeek.周日}
这周末=${ctx.weekendStart}~${ctx.weekendEnd}（周六和周日，共两天）
下周：${nextWeekTable}
（重要："这周X"用的是中文习惯以周一为每周第一天，例如"这周日"一定是未来的那个周日，绝不会是过去日期）
（date 字段必须是 YYYY-MM-DD 格式，或查询月份时用 YYYY-MM 格式，或周末查询时用 "weekend"，或下周查询时用 "next_week"。禁止返回其他格式！）

时间转换（必须严格转换）：
下午X点 → (X+12):00  （下午三点=15:00、下午3点=15:00、下午五点=17:00）
上午X点 → XX:00      （上午九点=09:00）
晚上X点 → (X+12):00  （晚上八点=20:00）
X点半 → XX:30        （下午三点半=15:30）
无时间 → ""

标题提取：
去掉日期词和时间词，只保留事件内容。
"明天下午三点上课" → 日期=明天, 时间=下午三点, 标题=上课

=== JSON 格式 ===
add: {"action":"add","date":"日期","time":"时间","title":"标题"}
query: 查单天 → {"action":"query","date":"日期"}
       查月份 → {"action":"query","date":"月份"}（格式："${ctx.thisMonth}"，即YYYY-MM）
       查下周 → {"action":"query","date":"next_week","week_start":"${ctx.nextWeekStart}","week_end":"${ctx.nextWeekEnd}"}
       查周末 → {"action":"query","date":"weekend","weekend_start":"${ctx.weekendStart}","weekend_end":"${ctx.weekendEnd}"}
       （用户说"这周末有什么安排"时，必须用 weekend 格式）
       （用户说"这个月有什么事"/"本月有什么安排"时，必须用月份格式 date="${ctx.thisMonth}"）
       （用户说"下周有什么安排"/"下个星期有什么事"时，必须用 next_week 格式，week_start="${ctx.nextWeekStart}"，week_end="${ctx.nextWeekEnd}"）
delete: {"action":"delete","date":"日期","keywords":"关键词"}
  （keywords 是从用户话里提取的、用于匹配事件标题的具体内容词）
  （重要！禁止使用泛指词：安排、日程、事情、事项、事件、计划——这些不是事件标题，不能作为keywords）
  （用户说"取消这周日的安排" → date=这周日，keywords=""，因为"安排"是泛指词）
  （用户说"删除明天的开会" → date=明天，keywords=开会，因为"开会"是具体内容）
  （用户没指定具体哪个事件时，keywords=""，此时删除该日期全部事件）

只返回 JSON，不要任何解释。

最后几个例子，确保你理解：
- 输入："明天下午三点上课"
  输出：{"action":"add","date":"${ctx.tomorrow}","time":"15:00","title":"上课"}
- 输入："删除明天的开会"
  输出：{"action":"delete","date":"${ctx.tomorrow}","keywords":"开会"}
- 输入："取消这周日的安排"
  输出：{"action":"delete","date":"${ctx.thisWeek.周日}","keywords":""}
  说明："安排"是泛指词，不能作为keywords，所以keywords为空，将删除这周日全部事件
- 输入："这周末有什么安排"
  输出：{"action":"query","date":"weekend","weekend_start":"${ctx.weekendStart}","weekend_end":"${ctx.weekendEnd}"}
  注意：周末必须用 weekend 格式，同时查周六和周日两天。
- 输入："这个月还有什么事呢"
  输出：{"action":"query","date":"${ctx.thisMonth}"}
  注意：月份查询用YYYY-MM格式，不要用YYYY-MM-DD。
- 输入："我下周有什么安排"
  输出：{"action":"query","date":"next_week","week_start":"${ctx.nextWeekStart}","week_end":"${ctx.nextWeekEnd}"}
  注意：下周必须用 next_week 格式，同时查周一至周日全部七天。`;
}

// ---------- 日期显示格式化 ----------

function fmtDisplay(dateStr) {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return parts[0] + "年" + parts[1] + "月" + parts[2] + "日";
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return parts[0] + "年" + parts[1] + "月";
  }
  return dateStr;
}

// ---------- 语音播报文本格式化 ----------

function fmtSpokenDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length >= 3) {
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return m + "月" + d + "日";
  }
  return dateStr;
}

function fmtSpokenTime(timeStr) {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (m === 0) return h + "点";
  return h + "点" + m + "分";
}

// ---------- 事件排序与格式化 ----------

function sortEvents(events) {
  return events.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const ta = a.time || "00:00";
    const tb = b.time || "00:00";
    return ta.localeCompare(tb);
  });
}

function formatEventList(events) {
  return sortEvents(events)
    .map((e) => e.date + " " + (e.time ? e.time + " " : "") + e.title)
    .join("；");
}

// ---------- 执行操作 ----------

function executeAdd(parsed) {
  const ev = addEvent(parsed.date, parsed.time || "", parsed.title);
  voiceResult.textContent = "已添加：" + ev.title;
  voiceError.textContent = "";
  speak("已添加，" + fmtSpokenDate(ev.date) + (ev.time ? "，" + fmtSpokenTime(ev.time) : "") + "，" + ev.title);
  renderCalendar();
  selectedDate = parsed.date;
  renderCalendar();
  showEventPanel(parsed.date);
}

function executeQuery(parsed) {
  voiceError.textContent = "";

  // 周末查询：合并周六和周日的事件
  if (parsed.date === "weekend" && parsed.weekend_start && parsed.weekend_end) {
    const satEvents = getEventsByDate(parsed.weekend_start);
    const sunEvents = getEventsByDate(parsed.weekend_end);
    const allEvents = satEvents.concat(sunEvents);

    if (allEvents.length === 0) {
      voiceResult.textContent = "周末暂无安排";
      speak("周末暂无安排");
    } else {
      voiceResult.textContent = "周末 共 " + allEvents.length + " 个事件：\n" + formatEventList(allEvents);
      speak("周末共" + allEvents.length + "个事件，" + sortEvents(allEvents).map((e) => (e.time ? fmtSpokenTime(e.time) + "，" : "") + e.title).join("，"));
    }

    // 显示周六的事件面板
    selectedDate = parsed.weekend_start;
    renderCalendar();
    showEventPanel(parsed.weekend_start);
    return;
  }

  // 下周查询：合并周一到周日的事件
  if (parsed.date === "next_week" && parsed.week_start && parsed.week_end) {
    const allEvents = getAllEvents().filter(
      (e) => e.date >= parsed.week_start && e.date <= parsed.week_end
    );
    const startDisplay = parsed.week_start.replace(/^\d+-/, "").replace("-", "月") + "日";
    const endDisplay = parsed.week_end.replace(/^\d+-/, "").replace("-", "月") + "日";

    if (allEvents.length === 0) {
      voiceResult.textContent = "下周（" + startDisplay + "-" + endDisplay + "）暂无安排";
      speak("下周暂无安排");
    } else {
      voiceResult.textContent = "下周（" + startDisplay + "-" + endDisplay + "）共 " + allEvents.length + " 个事件：\n" + formatEventList(allEvents);
      speak("下周共" + allEvents.length + "个事件，" + sortEvents(allEvents).map((e) => fmtSpokenDate(e.date) + "，" + (e.time ? fmtSpokenTime(e.time) + "，" : "") + e.title).join("，"));
    }

    selectedDate = parsed.week_start;
    renderCalendar();
    showEventPanel(parsed.week_start);
    return;
  }

  // 月份查询：查该月所有事件
  if (/^\d{4}-\d{2}$/.test(parsed.date)) {
    const monthPrefix = parsed.date;
    const allEvents = getAllEvents().filter((e) => e.date.startsWith(monthPrefix));
    if (allEvents.length === 0) {
      voiceResult.textContent = fmtDisplay(monthPrefix) + " 暂无安排";
      speak(fmtDisplay(monthPrefix) + "暂无安排");
    } else {
      voiceResult.textContent = fmtDisplay(monthPrefix) + " 共 " + allEvents.length + " 个事件：\n" + formatEventList(allEvents);
      speak(fmtDisplay(monthPrefix) + "共" + allEvents.length + "个事件，" + sortEvents(allEvents).map((e) => fmtSpokenDate(e.date) + "，" + (e.time ? fmtSpokenTime(e.time) + "，" : "") + e.title).join("，"));
    }
    return;
  }

  // 单日查询
  const events = sortEvents(getEventsByDate(parsed.date));
  if (events.length === 0) {
    voiceResult.textContent = fmtDisplay(parsed.date) + " 暂无安排";
    speak(fmtDisplay(parsed.date) + "暂无安排");
  } else {
    const list = events.map((e) => (e.time ? e.time + " " : "") + e.title).join("；");
    voiceResult.textContent = fmtDisplay(parsed.date) + " 有 " + events.length + " 个事件：" + list;
    speak(fmtDisplay(parsed.date) + "有" + events.length + "个事件，" + events.map((e) => (e.time ? fmtSpokenTime(e.time) + "，" : "") + e.title).join("，"));
  }
  selectedDate = parsed.date;
  renderCalendar();
  showEventPanel(parsed.date);
}

function executeDelete(parsed) {
  const dateEvents = getEventsByDate(parsed.date);
  voiceError.textContent = "";

  if (dateEvents.length === 0) {
    voiceResult.textContent = "";
    voiceError.textContent = fmtDisplay(parsed.date) + " 没有事件";
    speak(fmtDisplay(parsed.date) + "没有事件");
    renderCalendar();
    return;
  }

  // keywords 为空 → 删除该日期全部事件
  if (!parsed.keywords || !parsed.keywords.trim()) {
    dateEvents.forEach((e) => deleteEvent(e.id));
    voiceResult.textContent =
      "已删除：" + fmtDisplay(parsed.date) + " 全部 " + dateEvents.length + " 个事件";
    speak("已删除，" + fmtDisplay(parsed.date) + "全部" + dateEvents.length + "个事件");
    renderCalendar();
    return;
  }

  // 单个事件直接删除
  if (dateEvents.length === 1) {
    const ev = dateEvents[0];
    deleteEvent(ev.id);
    voiceResult.textContent = "已删除：" + ev.date + " " + ev.title;
    speak("已删除，" + ev.title);
    renderCalendar();
    selectedDate = parsed.date;
    renderCalendar();
    showEventPanel(parsed.date);
    return;
  }

  // 多个事件，关键词模糊匹配
  const matches = dateEvents.filter((e) => e.title.includes(parsed.keywords));
  if (matches.length > 0) {
    const target = matches[matches.length - 1];
    deleteEvent(target.id);
    voiceResult.textContent = "已删除：" + target.date + " " + target.title;
    speak("已删除，" + target.title);
    renderCalendar();
    selectedDate = parsed.date;
    renderCalendar();
    showEventPanel(parsed.date);
  } else {
    voiceResult.textContent = "";
    voiceError.textContent =
      parsed.date + " 未找到包含「" + parsed.keywords + "」的事件";
    speak("未找到匹配的事件");
    renderCalendar();
  }
}

// ---------- 主入口 ----------

async function parseAndExecute(text) {
  if (!text || !text.trim()) return;

  voiceResult.textContent = "正在理解...";
  voiceError.textContent = "";

  try {
    const systemPrompt = buildSystemPrompt();
    console.log("=== System Prompt ===");
    console.log(systemPrompt);
    console.log("=== User Input ===");
    console.log("用户说：" + text);

    const raw = await callDeepSeek(systemPrompt, "用户说：" + text);
    console.log("=== DeepSeek Response ===");
    console.log(raw);

    const parsed = JSON.parse(raw);
    console.log("=== Parsed ===", parsed);

    switch (parsed.action) {
      case "add":
        executeAdd(parsed);
        break;
      case "query":
        executeQuery(parsed);
        break;
      case "delete":
        executeDelete(parsed);
        break;
      default:
        voiceResult.textContent = "";
        voiceError.textContent = "无法理解，请重新说一遍";
        speak("没听清，请重新说一遍");
    }
  } catch (e) {
    console.error("Parse error:", e);
    voiceResult.textContent = "";
    voiceError.textContent = "解析失败，请重新说一遍";
    speak("没听清，请重新说一遍");
  }
}
