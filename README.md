# Oestra Mobile

Oestra (潮汐) mobile app built with Expo and React Native.

## Tech Stack

- Expo
- TypeScript
- NativeWind
- Supabase
- Anthropic API

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

3. Start development server:

```bash
npx expo start
```

### Browser preview (`expo start --web`)

Config comes from project root `.env` via `app.config.ts` → `Constants.expoConfig.extra`. If login shows **Failed to fetch**, stop Metro, confirm `.env` has real Supabase values, then run `npx expo start --web` again.

Some networks block `*.supabase.co`; try another network or VPN if fetch still fails.

## Environment Variables

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key

## Auth / 验证邮件与预览账号

**收不到验证邮件**多半是 Supabase 侧原因，不是前端 bug：默认发信易进垃圾箱、有频率限制；生产环境请在 **Authentication → Emails** 配置 **自定义 SMTP**。

**本地预览最快**：Supabase **Authentication → Providers → Email** 里暂时关闭 **Confirm email**，注册后会直接返回 session，无需收邮件。

**默认测试账号（开发模式）**

1. 在 Supabase **Authentication → Users → Add user** 手动添加用户：
   - Email: `test@oestra.preview`
   - Password: `666666`（平台默认最少 6 位密码；若你改成 4 位，请同步修改 `src/constants/devAuth.ts`）
2. 开发模式下登录页可输入账号 **`test`**、密码 **`6666`**（会自动映射到上述邮箱与 6 位密码），或使用「一键填入测试账号并登录」。

## AI chat (Supabase Edge Function)

The app calls **`supabase.functions.invoke("chat")`**, which validates the user JWT, loads profile/context from Postgres, calls Anthropic on the server, and saves `chat_messages` (including assistant `metadata`). **Do not put Anthropic API keys in `.env`.**

若终端提示 `command not found: supabase`，说明未全局安装 CLI。可直接用 **`npx supabase`**（无需安装），或本项目已加入开发依赖，安装后用 **`npm run deploy:chat`**。

```bash
npm install

npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>
npx supabase secrets set ANTHROPIC_API_KEY=your_real_key
npm run deploy:chat
```

（也可用全局安装：`brew install supabase/tap/supabase`。）

See `supabase/functions/README.md` for curl testing.

## Phase 2 — Apple Health / Android Health Connect

HealthKit 与 Health Connect **不能在 Expo Go 里使用**，需要 **development build**（`expo-dev-client` + `npx expo prebuild` 后 `npx expo run:ios` / `run:android`）。

1. 在 Supabase **SQL Editor** 执行迁移：`supabase/migrations/002_symptom_logs_source.sql`（增加 `source` 列与健康同步唯一索引）。
2. 重新部署 Edge Function **`chat`**（对话上下文中已加入「健康设备数据」段落）：`npm run deploy:chat` 或 `supabase functions deploy chat`。
3. 本地生成原生工程并安装到真机：`npx expo prebuild` → `npx expo run:ios`（HealthKit 需真机）或 `npx expo run:android`（Android 14+ Health Connect）。

在 **我的** 页可「连接健康数据授权」与「同步最近7天到云端」。同步写入 `symptom_logs`（`source` = `healthkit` / `health_connect`）。

## Voice input (speech-to-text)

Chat and daily note fields use `expo-speech-recognition`: **hold the mic**, speak, **release** to stop. Recognition language follows the **device locale** when you do not pass `speechLang` (see `src/utils/speechLocale.ts`).

This package uses native speech APIs and usually requires a **development build**, not Expo Go:

```bash
npx expo run:ios
# or
npx expo run:android
```
