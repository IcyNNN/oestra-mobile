/**
 * Oestra（潮汐）— Supabase / PostgreSQL 表结构与 JSON 载荷的 TypeScript 类型。
 *
 * 用法：在 Repository、API 层或与 `@supabase/supabase-js` 的 `Database` 泛型对齐时引用；
 * `UserInsightData` / `MessageMetadata` 用于约束 `jsonb` 列的结构。
 *
 * @module types/database
 */

/** 日常记录类型（symptom_logs.log_type） */
export type LogType =
  | 'symptom'
  | 'mood'
  | 'energy'
  | 'sleep'
  | 'exercise'
  | 'diet'
  | 'other';

/** 周期阶段（daily_states.cycle_phase） */
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

/** 生命阶段（hormone_profiles.life_stage） */
export type LifeStage =
  | 'single'
  | 'dating'
  | 'married'
  | 'ttc'
  | 'pregnant'
  | 'postpartum'
  | 'perimenopausal'
  | 'unspecified';

/** 会话类型（chat_sessions.session_type） */
export type SessionType = 'chat' | 'onboarding' | 'proactive';

/** AI 主动关怀触发类型（ai_proactive_log.trigger_type） */
export type ProactiveTriggerType =
  | 'silence_3days'
  | 'low_energy_streak'
  | 'pms_incoming'
  | 'followup'
  | 'milestone_unlock'
  | 'cycle_prediction';

/** 知识库大类（knowledge_base.category） */
export type KnowledgeCategory =
  | 'pms'
  | 'pcos'
  | 'menstrual_cycle'
  | 'hormones'
  | 'fertility'
  | 'menopause'
  | 'mental_health'
  | 'nutrition'
  | 'exercise'
  | 'sleep'
  | 'general';

/** chat_messages.metadata / AI 侧结构化抽取 */
export interface MessageMetadata {
  /** 从消息中识别的情绪标签 */
  extracted_mood?: string;
  /** 能量等级 1–5 */
  extracted_energy?: number;
  /** 提到的症状列表 */
  extracted_symptoms?: string[];
  /** 是否标记为「顿悟」时刻 */
  is_aha_moment?: boolean;
  /** 话题标签 */
  topics?: string[];
  /** 发送消息时推断的周期第几天 */
  cycle_day_at_message?: number;
}

/** user_insights.insight_data — 周更用户画像 JSON */
export interface UserInsightData {
  cycle_characteristics?: {
    average_length?: number;
    regularity_score?: number;
    common_premenstrual_symptoms?: string[];
    worst_pms_days?: string;
    flow_pattern?: string;
  };
  emotional_patterns?: {
    high_energy_phase?: string;
    low_energy_phase?: string;
    emotional_triggers?: string[];
    coping_strategies_observed?: string[];
  };
  communication_preferences?: {
    preferred_tone?: string;
    preferred_response_length?: string;
    language?: string;
    topics_to_avoid?: string[];
    responds_well_to?: string;
  };
  key_relationships?: {
    partner_status?: string;
    partner_dynamics_observed?: string;
  };
  key_moments?: Array<{
    date?: string;
    type?: string;
    description?: string;
  }>;
  current_focus?: string[];
  health_summary?: string;
}

/** 登录用户基础资料（public.profiles） */
export interface Profile {
  /** 主键，等同 auth.users.id */
  id: string;
  /** 邮箱 */
  email: string | null;
  /** 展示名 */
  display_name: string | null;
  /** 密码设置时间 */
  password_set_at: string | null;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 用户激素健康档案，一对一 profiles（public.hormone_profiles） */
export interface HormoneProfile {
  /** 用户 ID，主键 */
  user_id: string;
  /** 出生年份 */
  birth_year: number | null;
  /** 典型周期长度（天） */
  typical_cycle_length_days: number | null;
  /** 典型经期长度（天） */
  typical_period_length_days: number | null;
  /** 目标列表 */
  goals: string[];
  /** 备注 */
  notes: string | null;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
  /** 生命阶段 */
  life_stage: string | null;
  /** 周期规律性 */
  cycle_regularity: string | null;
  /** 已诊断状况 */
  medical_conditions: string[] | null;
  /** 希望被陪伴的方面 */
  focus_areas: string[] | null;
  /** AI 伙伴称呼 */
  ai_companion_name: string | null;
  /** 建档是否完成 */
  onboarding_completed: boolean;
  /** 建档完成时间 */
  onboarding_completed_at: string | null;
}

/** 月经周期记录（public.cycle_logs） */
export interface CycleLog {
  /** 主键 */
  id: string;
  /** 所属用户 */
  user_id: string;
  /** 经期开始日 */
  period_start: string;
  /** 经期结束日 */
  period_end: string | null;
  /** 流量强度描述 */
  flow_intensity: string | null;
  /** 备注 */
  notes: string | null;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/** 症状 / 情绪 / 能量等多类型日常记录（public.symptom_logs） */
export interface SymptomLog {
  /** 主键 */
  id: string;
  /** 所属用户 */
  user_id: string;
  /** 记录日期 */
  logged_on: string;
  /** 症状或描述（按 log_type 语义变化） */
  symptom: string;
  /** 严重度或等级 */
  severity: number | null;
  /** 备注 */
  notes: string | null;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
  /** 记录类型 */
  log_type: LogType | string;
  /** 数据来源：手动 / Apple Health / Health Connect */
  source: SymptomLogSource | string;
}

/** symptom_logs.source */
export type SymptomLogSource = "manual" | "healthkit" | "health_connect";

/** 对话会话（public.chat_sessions） */
export interface ChatSession {
  /** 主键 */
  id: string;
  /** 所属用户 */
  user_id: string;
  /** 会话标题 */
  title: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
  /** 会话类型：普通 / 建档 / 主动关怀 */
  session_type: SessionType | string;
}

/** 对话消息（public.chat_messages） */
export interface ChatMessage {
  /** 主键 */
  id: string;
  /** 所属会话 */
  session_id: string;
  /** 所属用户 */
  user_id: string;
  /** 角色，如 user / assistant / system */
  role: string;
  /** 正文 */
  content: string;
  /** 创建时间 */
  created_at: string;
  /** AI 抽取的结构化信息 */
  metadata: MessageMetadata | null;
  /** 是否 AI 主动发送 */
  is_proactive: boolean;
}

/** 「今天的你」每日卡片（public.daily_states） */
export interface DailyState {
  /** 主键 */
  id: string;
  /** 所属用户 */
  user_id: string;
  /** 卡片日期 */
  date: string;
  /** 周期第几天 */
  cycle_day: number | null;
  /** 周期阶段 */
  cycle_phase: string | null;
  /** 预测能量 1–5 */
  energy_prediction: number | null;
  /** 主屏短文案 */
  state_text: string;
  /** 生成时间 */
  generated_at: string;
  /** 用户首次查看时间 */
  viewed_at: string | null;
}

/** 版本化用户画像（public.user_insights） */
export interface UserInsight {
  /** 主键 */
  id: string;
  /** 所属用户 */
  user_id: string;
  /** 版本号 */
  version: number;
  /** 结构化画像 JSON */
  insight_data: UserInsightData;
  /** 数据来源摘要 */
  data_sources_summary: string | null;
  /** 生成时间 */
  generated_at: string;
  /** 是否为当前生效版本 */
  is_current: boolean;
}

/** 自我之书章节（public.self_book_chapters） */
export interface SelfBookChapter {
  /** 主键 */
  id: string;
  /** 所属用户 */
  user_id: string;
  /** 章节序号 */
  chapter_number: number;
  /** 章节标题 */
  chapter_title: string;
  /** 正文 */
  content: string;
  /** 解锁触发类型 */
  triggered_by: string;
  /** 基于哪一版 user_insights.version */
  based_on_insight_version: number | null;
  /** 生成时间 */
  generated_at: string;
  /** 是否已解锁 */
  is_unlocked: boolean;
  /** 解锁时间 */
  unlocked_at: string | null;
  /** 用户首次阅读时间 */
  user_viewed_at: string | null;
}

/** AI 主动关怀发送记录（public.ai_proactive_log） */
export interface AiProactiveLog {
  /** 主键 */
  id: string;
  /** 所属用户 */
  user_id: string;
  /** 触发类型 */
  trigger_type: ProactiveTriggerType | string;
  /** 触发上下文 */
  trigger_context: Record<string, unknown> | null;
  /** 消息正文 */
  message_content: string;
  /** 投递渠道 */
  delivery_channel: string;
  /** 计划发送时间 */
  scheduled_for: string;
  /** 实际发送时间 */
  sent_at: string | null;
  /** 用户是否回应 */
  user_responded: boolean | null;
  /** 回应时间 */
  response_at: string | null;
  /** 关联会话（若用户进入对话） */
  linked_session_id: string | null;
  /** 记录创建时间 */
  created_at: string;
}

/** RAG 知识片段（public.knowledge_base） */
export interface KnowledgeBase {
  /** 主键 */
  id: string;
  /** 来源标识 */
  source: string;
  /** 大类 */
  category: KnowledgeCategory | string;
  /** 子类 */
  subcategory: string | null;
  /** 标题 */
  title: string;
  /** 正文片段 */
  content: string;
  /** Token 数估算 */
  content_tokens: number | null;
  /** 向量嵌入（1536 维，存库为字符串或 number[] 依客户端而定） */
  embedding: string | null;
  /** 审核人 */
  reviewed_by: string | null;
  /** 审核时间 */
  reviewed_at: string | null;
  /** 是否启用 */
  is_active: boolean | null;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}
