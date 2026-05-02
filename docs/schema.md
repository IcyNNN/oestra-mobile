# Oestra（潮汐）数据库 Schema 文档

| 项目 | 说明 |
|------|------|
| **数据库** | Supabase (PostgreSQL) |
| **Schema 版本** | v2.0 |
| **最后更新** | 2026-05-01 |

---

## 架构总览

数据按分层组织：**账号层**保存身份与档案；**记忆层（L0）**保存用户产生的原始记录与对话；**理解层（L1）**保存 AI 提炼的结构化画像；**输出层**保存面向用户的生成内容；**知识层**保存可供检索的专业知识（非用户私有行）。

### 数据架构分层

**账号层（Account Layer）**

- `profiles` — 用户基础账号信息  
- `hormone_profiles` — 用户健康档案  

**记忆层（Memory Layer）— L0 原始数据**

- `chat_sessions` — 对话会话  
- `chat_messages` — 对话消息（含 AI 提取的 `metadata`）  
- `cycle_logs` — 月经周期记录  
- `symptom_logs` — 多类型日常记录（症状 / 情绪 / 能量 / 睡眠等）  

**理解层（Understanding Layer）— L1 AI 生成的理解**

- `user_insights` — AI 用户画像（周期性更新，版本化管理）  

**输出层（Output Layer）— AI 生成的面向用户的内容**

- `daily_states` — 「今天的你」每日状态卡片  
- `self_book_chapters` — 自我之书章节  
- `ai_proactive_log` — AI 主动关怀记录  

**知识层（Knowledge Layer）**

- `knowledge_base` — RAG 向量知识库  

---

## 表说明

以下 **11 张表**：6 张既有表（含 v2 新增字段）+ 5 张本次新增表。

---

## profiles

**用途：** 与 Supabase Auth 绑定的用户基础资料（邮箱、显示名、密码设置时间等）。  
**数据层：** Account（L0：用户输入 / 系统写入的基础资料）  
**关联表：** `auth.users`（`id` → `auth.users.id`）  
**更新频率：** 注册时创建；资料变更时更新  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | uuid | PK, FK → auth.users(id), NOT NULL | 与登录用户一一对应 |
| email | text | NULLABLE | 邮箱 |
| display_name | text | NULLABLE | 展示名称 |
| password_set_at | timestamptz | NULLABLE | 密码设置时间 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |

---

## hormone_profiles

**用途：** 每位用户一条健康档案（周期习惯、目标、备注及建档扩展字段）。  
**数据层：** Account + Memory（L0：用户填写；扩展字段多为用户产生）  
**关联表：** `auth.users`（`user_id` PK/FK）  
**更新频率：** 建档与编辑时  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| user_id | uuid | PK, FK → auth.users(id), NOT NULL | 用户 |
| birth_year | int4 | NULLABLE | 出生年份 |
| typical_cycle_length_days | int4 | NULLABLE | 典型周期长度（天） |
| typical_period_length_days | int4 | NULLABLE | 典型经期长度（天） |
| goals | text[] | NOT NULL | 目标列表 |
| notes | text | NULLABLE | 备注 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |
| life_stage | text | NULLABLE | 生命阶段：`single` \| `dating` \| `married` \| `ttc` \| `pregnant` \| `postpartum` \| `perimenopausal` \| `unspecified` |
| cycle_regularity | text | NULLABLE | 周期规律性：`regular` \| `irregular` \| `menopausal` \| `unknown` |
| medical_conditions | text[] | NULLABLE | 已诊断状况，如 PCOS、甲减 |
| focus_areas | text[] | NULLABLE | 希望被陪伴的方面 |
| ai_companion_name | text | NULLABLE | 用户给 AI 伙伴起的名字 |
| onboarding_completed | boolean | NOT NULL, DEFAULT false | 建档是否完成 |
| onboarding_completed_at | timestamptz | NULLABLE | 建档完成时间 |

---

## cycle_logs

**用途：** 记录每次月经来潮区间与流量等，用于周期推算与健康追踪。  
**数据层：** Memory（L0）  
**关联表：** `auth.users`（`user_id`）  
**更新频率：** 用户每次记录经期  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | uuid | PK, NOT NULL | 主键 |
| user_id | uuid | FK → auth.users(id), NOT NULL | 用户 |
| period_start | date | NOT NULL | 经期开始日 |
| period_end | date | NULLABLE | 经期结束日 |
| flow_intensity | text | NULLABLE | 流量强度描述 |
| notes | text | NULLABLE | 备注 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |

---

## symptom_logs

**用途：** 按日记录症状、情绪、能量、睡眠等多类型日志（通过 `log_type` 区分）。  
**数据层：** Memory（L0）  
**关联表：** `auth.users`（`user_id`）  
**更新频率：** 用户每次打卡  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | uuid | PK, NOT NULL | 主键 |
| user_id | uuid | FK → auth.users(id), NOT NULL | 用户 |
| logged_on | date | NOT NULL | 记录日期 |
| symptom | text | NOT NULL | 症状或描述性文本（按类型可表示情绪、运动内容等） |
| severity | int4 | NULLABLE | 严重度或等级（如情绪 1–5、能量 1–5） |
| notes | text | NULLABLE | 备注 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |
| log_type | text | NOT NULL, DEFAULT `'symptom'` | `symptom` \| `mood` \| `energy` \| `sleep` \| `exercise` \| `diet` \| `other` |

---

## chat_sessions

**用途：** 对话会话容器，区分普通聊天、建档对话、主动关怀触发的会话等。  
**数据层：** Memory（L0：会话元数据由用户与产品行为产生）  
**关联表：** `auth.users`（`user_id`）；被 `chat_messages`、`ai_proactive_log` 引用  
**更新频率：** 每次新建会话；标题或类型变更时更新  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | uuid | PK, NOT NULL | 主键 |
| user_id | uuid | FK → auth.users(id), NOT NULL | 用户 |
| title | text | NOT NULL | 会话标题 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| updated_at | timestamptz | NOT NULL | 更新时间 |
| session_type | text | NOT NULL, DEFAULT `'chat'` | `chat` \| `onboarding` \| `proactive` |

---

## chat_messages

**用途：** 会话中的每条消息；可附带 AI 从消息中抽取的结构化 `metadata`，以及是否为主动消息。  
**数据层：** Memory（L0：用户消息为用户产生；AI 消息与 `metadata` 为 **L1 输出** 附着在 L0 行上）  
**关联表：** `chat_sessions`（`session_id`），`auth.users`（`user_id`）  
**更新频率：** 每条发送实时写入  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | uuid | PK, NOT NULL | 主键 |
| session_id | uuid | FK → chat_sessions(id), NOT NULL | 所属会话 |
| user_id | uuid | FK → auth.users(id), NOT NULL | 用户 |
| role | text | NOT NULL | 角色（如 user / assistant / system） |
| content | text | NOT NULL | 正文 |
| created_at | timestamptz | NOT NULL | 创建时间 |
| metadata | jsonb | NULLABLE | AI 抽取的结构化信息（情绪、症状、话题、周期日等）— **L1** |
| is_proactive | boolean | NOT NULL, DEFAULT false | 是否 AI 主动发起 |

---

## daily_states

**用途：** 每日「今天的你」主屏卡片文案与周期上下文；每用户每天至多一行。  
**数据层：** Output（**L1**：由模型/管道基于 L0+L1 生成）  
**关联表：** `auth.users`（`user_id`）  
**更新频率：** 每日或按需重新生成  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主键 |
| user_id | uuid | FK → auth.users(id) ON DELETE CASCADE, NOT NULL | 用户 |
| date | date | NOT NULL | 卡片日期 |
| cycle_day | int4 | NULLABLE | 周期第几天（从月经第一天计） |
| cycle_phase | text | NULLABLE | `menstrual` \| `follicular` \| `ovulation` \| `luteal` |
| energy_prediction | int4 | NULLABLE | 预测能量 1–5 |
| state_text | text | NOT NULL | 主屏短文案（建议约 50 字内） |
| generated_at | timestamptz | NOT NULL, DEFAULT now() | 生成时间 |
| viewed_at | timestamptz | NULLABLE | 用户首次看到该卡片的时间 |

唯一约束：`UNIQUE (user_id, date)`。

---

## user_insights

**用途：** 周期性汇总的用户结构化画像（JSON），版本化管理；当前版本注入 system prompt。  
**数据层：** Understanding（**L1**：AI 生成，可重算、多版本）  
**关联表：** `auth.users`（`user_id`）；可为 `self_book_chapters.based_on_insight_version` 提供逻辑关联  
**更新频率：** 每周或后台任务触发  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主键 |
| user_id | uuid | FK → auth.users(id) ON DELETE CASCADE, NOT NULL | 用户 |
| version | int4 | NOT NULL, DEFAULT 1 | 版本号 |
| insight_data | jsonb | NOT NULL | 结构化画像（周期特征、情绪模式、沟通偏好等） |
| data_sources_summary | text | NULLABLE | 数据来源摘要 |
| generated_at | timestamptz | NOT NULL, DEFAULT now() | 生成时间 |
| is_current | boolean | NOT NULL, DEFAULT true | 是否为当前生效版本 |

部分唯一索引：每个 `user_id` 至多一行 `is_current = true`。

---

## self_book_chapters

**用途：** 「自我之书」散文章节，按里程碑解锁，内容由 AI 生成。  
**数据层：** Output（**L1**：AI 生成）  
**关联表：** `auth.users`（`user_id`）  
**更新频率：** 里程碑到达时生成 / 解锁  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主键 |
| user_id | uuid | FK → auth.users(id) ON DELETE CASCADE, NOT NULL | 用户 |
| chapter_number | int4 | NOT NULL | 章节序号（如 1=Day7…） |
| chapter_title | text | NOT NULL | 章节标题 |
| content | text | NOT NULL | 正文 |
| triggered_by | text | NOT NULL | `day_7` \| `day_30` \| `day_90` \| `day_180` \| `birthday` \| `annual` |
| based_on_insight_version | int4 | NULLABLE | 对应 `user_insights.version` |
| generated_at | timestamptz | NOT NULL, DEFAULT now() | 生成时间 |
| is_unlocked | boolean | NOT NULL, DEFAULT false | 是否已解锁 |
| unlocked_at | timestamptz | NULLABLE | 解锁时间 |
| user_viewed_at | timestamptz | NULLABLE | 用户首次阅读时间 |

唯一约束：`UNIQUE (user_id, chapter_number)`。

---

## ai_proactive_log

**用途：** 记录每一次 AI 主动关怀的发送、渠道与是否回应，用于效果分析。  
**数据层：** Output（元数据与文案为 **L1**；用户是否回应为行为数据，可归为 L0 交互结果）  
**关联表：** `auth.users`（`user_id`），`chat_sessions`（`linked_session_id`，可选）  
**更新频率：** 每次计划/发送/回应时更新  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主键 |
| user_id | uuid | FK → auth.users(id) ON DELETE CASCADE, NOT NULL | 用户 |
| trigger_type | text | NOT NULL | 见枚举：`silence_3days` 等 |
| trigger_context | jsonb | NULLABLE | 触发上下文 JSON |
| message_content | text | NOT NULL | 发送文案 |
| delivery_channel | text | NOT NULL, DEFAULT `'in_app'` | `in_app` \| `push` \| `email` |
| scheduled_for | timestamptz | NOT NULL | 计划发送时间 |
| sent_at | timestamptz | NULLABLE | 实际发送时间 |
| user_responded | boolean | DEFAULT false | 用户是否回应 |
| response_at | timestamptz | NULLABLE | 回应时间 |
| linked_session_id | uuid | FK → chat_sessions(id), NULLABLE | 若形成会话则关联 |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 记录创建时间 |

---

## knowledge_base

**用途：** 女性激素健康相关的知识片段与向量，用于 RAG；非用户私有数据。  
**数据层：** Knowledge（策展内容；**非** L0/L1 用户数据）  
**关联表：** 无外键到用户表  
**更新频率：** 运营/医学顾问更新；与嵌入重建  

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | uuid | PK, DEFAULT gen_random_uuid() | 主键 |
| source | text | NOT NULL | 如 `WHO_guidelines`、`ACOG`、`expert_review` 等 |
| category | text | NOT NULL | 大类（PMS、PCOS、周期等） |
| subcategory | text | NULLABLE | 子类 |
| title | text | NOT NULL | 标题 |
| content | text | NOT NULL | 片段正文（约 200–500 字） |
| content_tokens | int4 | NULLABLE | Token 数，便于控制上下文 |
| embedding | vector(1536) | NULLABLE | 向量（如 text-embedding-3-small） |
| reviewed_by | text | NULLABLE | 审核人 |
| reviewed_at | timestamptz | NULLABLE | 审核时间 |
| is_active | boolean | DEFAULT true | 是否启用（软删除） |
| created_at | timestamptz | NOT NULL, DEFAULT now() | 创建时间 |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | 更新时间 |

---

## L0 / L1 归类小结

| 层级 | 含义 | 涉及表 / 字段 |
|------|------|----------------|
| **L0** | 用户产生的原始数据或可明确归因于用户的输入 | `profiles`（基础资料）、`hormone_profiles`（用户填写）、`cycle_logs`、`symptom_logs`、`chat_sessions`、`chat_messages` 的正文与角色边界内的用户消息侧 |
| **L1** | AI 生成的理解、摘要、抽取与面向用户的生成物 | `chat_messages.metadata`、`user_insights`、`daily_states`、`self_book_chapters`、`ai_proactive_log` 中的文案与触发策略输出 |
| **知识库** | 策展专业知识，非个人画像 | `knowledge_base` |

---

## ER 关系图（Mermaid）

```mermaid
erDiagram
  AUTH_USERS ||--o| PROFILES : "id"
  AUTH_USERS ||--o| HORMONE_PROFILES : "user_id"
  AUTH_USERS ||--o{ CYCLE_LOGS : "user_id"
  AUTH_USERS ||--o{ SYMPTOM_LOGS : "user_id"
  AUTH_USERS ||--o{ CHAT_SESSIONS : "user_id"
  AUTH_USERS ||--o{ CHAT_MESSAGES : "user_id"
  AUTH_USERS ||--o{ DAILY_STATES : "user_id"
  AUTH_USERS ||--o{ USER_INSIGHTS : "user_id"
  AUTH_USERS ||--o{ SELF_BOOK_CHAPTERS : "user_id"
  AUTH_USERS ||--o{ AI_PROACTIVE_LOG : "user_id"

  CHAT_SESSIONS ||--o{ CHAT_MESSAGES : "session_id"
  CHAT_SESSIONS ||--o{ AI_PROACTIVE_LOG : "linked_session_id"

  AUTH_USERS {
    uuid id PK
  }
  PROFILES {
    uuid id PK_FK
  }
  HORMONE_PROFILES {
    uuid user_id PK_FK
  }
  CYCLE_LOGS {
    uuid id PK
    uuid user_id FK
  }
  SYMPTOM_LOGS {
    uuid id PK
    uuid user_id FK
  }
  CHAT_SESSIONS {
    uuid id PK
    uuid user_id FK
  }
  CHAT_MESSAGES {
    uuid id PK
    uuid session_id FK
    uuid user_id FK
  }
  DAILY_STATES {
    uuid id PK
    uuid user_id FK
  }
  USER_INSIGHTS {
    uuid id PK
    uuid user_id FK
  }
  SELF_BOOK_CHAPTERS {
    uuid id PK
    uuid user_id FK
  }
  AI_PROACTIVE_LOG {
    uuid id PK
    uuid user_id FK
    uuid linked_session_id FK
  }
  KNOWLEDGE_BASE {
    uuid id PK
  }
```

> 说明：`auth.users` 在 Supabase 中为认证 schema；图中 `AUTH_USERS` 表示与其的一对多关系。`knowledge_base` 无用户外键。

---

## 数据流（产品主路径）

1. **注册 → 建档对话 → 写入路径**  
   用户注册后写入 `profiles`；建档对话创建 `chat_sessions`（`session_type = onboarding`）与 `chat_messages`；用户填写的周期与目标进入 `hormone_profiles`，并可同步 `cycle_logs` / `symptom_logs`。

2. **日常对话 → AI 提取 → L0 存储 → 周期提炼 → L1 更新**  
   消息进入 `chat_messages`；抽取结果写入 `metadata`；周期与症状类记录持续积累在 `cycle_logs`、`symptom_logs`。后台任务聚合生成新的 `user_insights` 行，旧版本 `is_current = false`，新版本 `is_current = true`。

3. **L1 画像 → system prompt**  
   当前版本的 `user_insights.insight_data` 注入模型 system 侧，使回复个性化且一致。

4. **L0 + L1 → 今日卡片与自我之书**  
   管道结合记录与画像生成 `daily_states`；里程碑到达时生成并解锁 `self_book_chapters`。

5. **用户提问 → RAG**  
   查询嵌入检索 `knowledge_base` 中 `is_active` 的片段，注入上下文后回答专业问题。

---

## 设计原则

- **L0（用户产生）**在业务上视为原始事实来源，不以删改掩盖历史；需求变更通过新行或新字段扩展，而非篡改语义。  
- **L1（AI 生成理解）**可随模型与管道升级重算；通过 `user_insights` 的版本与 `is_current` 保留演进轨迹。  
- **输出层**（今日卡片、自我之书、主动关怀文案）是面向用户的生成物，可重建，依赖 L0+L1 与知识库。  
- **RLS**：用户数据表启用行级安全，用户仅能访问 `user_id = auth.uid()` 的行；`knowledge_base` 对认证用户开放只读（活跃条目）。  
- **时间**：业务时间戳统一 **timestamptz**。  
- **主键**：业务表统一 **uuid** 主键（与 Supabase 惯例一致）。
