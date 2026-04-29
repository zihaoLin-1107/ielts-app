# IELTS Vocab PWA

一个极简但可扩展的雅思备考初期英语学习 PWA。第一版只做词库导入、每日抽词、复习、Prompt 导出和训练包导入，不调用任何 AI API。

## 技术方案概述

- Next.js App Router + TypeScript
- Tailwind CSS 手机优先样式
- Supabase Auth + Postgres + RLS
- 前端只使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Vercel 部署
- `manifest.json` + Service Worker 提供基础 PWA 支持

## 项目目录结构

```text
app/
  login/
  dashboard/
  vocabulary/
  daily-words/
  review/
  generate-prompt/
  import-pack/
  training-packs/
components/
lib/
public/
  manifest.json
  sw.js
  icons/
sql/
  schema.sql
```

## Supabase SQL

SQL 在 `sql/schema.sql`，包含 `vocabulary_bank`、`user_words`、`daily_training_packs`、更新时间触发器、索引和 RLS policy。

核心数据流：

1. 用户在 `/vocabulary/import` 粘贴 CSV / JSON / Markdown 导入总词库。
2. `/daily-words` 从 `vocabulary_bank` 抽取尚未进入 `user_words` 的单词。
3. 复习、Prompt 导出都只读取 `user_words`。
4. 旧 `/words` 路径仅重定向，不再读写旧 `words` 表。

## 本地运行

1. 在 Supabase 新建项目。
2. 在 SQL Editor 执行 `sql/schema.sql`。
3. 复制环境变量：

```bash
cp .env.local.example .env.local
```

4. 填入 Supabase Project URL 和 anon key。
5. 安装依赖并启动：

```bash
npm install
npm run dev
```

6. 打开 `http://localhost:3000`。

## Vercel 部署

1. 推送代码到 GitHub。
2. Vercel 导入仓库。
3. 添加环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 部署。
5. 在 Supabase Auth URL Configuration 中加入 Vercel 域名。

## 手机使用

- iPhone Safari 打开站点，点击分享，选择“添加到主屏幕”。
- Android Chrome 打开站点，菜单选择“添加到主屏幕”。
- 离线支持是基础缓存，登录和数据库读写仍需要网络。

## 后续扩展

- AI 自动生成训练包
- 听力 TTS
- 难度自适应
- 学习数据分析
