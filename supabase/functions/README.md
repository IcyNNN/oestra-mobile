# Supabase Edge Functions

## `chat`（主路径）

完整对话后端：**JWT 校验 → 会话与用户消息落库 → 并行加载画像/周期/症状/历史 → 组装 system prompt → Anthropic → 保存 assistant + `metadata`。**

### Secrets（Dashboard → Edge Functions → Secrets）

- **`ANTHROPIC_API_KEY`** — 必填  
- **`ANTHROPIC_MODEL`** — 可选，默认 `claude-sonnet-4-5-20250929`

`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 由平台注入，一般无需手动添加。

### 部署

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy chat
```

或一次性指定项目：

```bash
supabase functions deploy chat --project-ref <PROJECT_REF>
```

### 本地 curl 测试

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/chat' \
  -H 'Authorization: Bearer <用户 access_token JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"message": "你好"}'
```

客户端使用 `supabase.functions.invoke("chat", { body: { session_id?, message } })`，会自动带上当前会话的 `Authorization`。

---

## 已移除 `anthropic-proxy`

旧版仅转发 Anthropic、不读写数据库。逻辑已合并进 **`chat`**，避免重复维护与误部署。
