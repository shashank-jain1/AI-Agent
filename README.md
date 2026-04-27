# 🤖 VoiceBot — Multilingual RAG AI Voice Agent

A full-stack, production-ready bilingual (Hindi + English) RAG AI chatbot with voice I/O.

## 📁 Project Structure

```
AI Agent/
├── backend/          # FastAPI — RAG pipeline + STT/TTS
├── frontend/         # Next.js 14 — Web Agent + Admin Panel
├── mobile/           # React Native Expo — iOS + Android
└── database/
    └── schema.sql    # Run this first in Supabase SQL Editor
```

---

## ⚡ Quick Start

### Step 1 — Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run the entire contents of `database/schema.sql`
3. Go to **Storage** → Create a bucket named `documents` (set to **Private**)
4. Go to **Authentication** → Create an admin user (Email + Password)

### Step 2 — Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**System dependencies required:**
- **Windows:** [Tesseract](https://github.com/UB-Mannheim/tesseract/wiki) + [ffmpeg](https://ffmpeg.org/download.html) + [Poppler](https://github.com/oschwartz10612/poppler-windows/releases)
- **Linux (Ubuntu/WSL):** `apt-get install tesseract-ocr tesseract-ocr-hin poppler-utils ffmpeg`

> Add Tesseract install path to `backend/.env` as `TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe` on Windows.

**Start the Celery worker (in a separate terminal):**
```bash
cd backend
celery -A workers.celery_worker:celery_app worker --loglevel=info --concurrency=2
```
> On Windows, prefer adding `--pool=solo`.
> Redis must be running locally. [Download for Windows](https://github.com/microsoftarchive/redis/releases) or run in WSL.

### Step 3 — Frontend (Web + Admin)

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — Voice Agent  
Open [http://localhost:3000/admin](http://localhost:3000/admin) — Admin Panel

### Step 4 — Mobile App (Optional)

```bash
cd mobile
cp .env.example .env
# Edit EXPO_PUBLIC_API_URL to point to your backend
npm install
npx expo start
```

---

## 🔑 Environment Variables

### `backend/.env`
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
REDIS_URL=redis://localhost:6379
WHISPER_MODEL=small
TESSERACT_CMD=           # Windows only: path to tesseract.exe
```

### `frontend/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🗄️ Architecture

```
User speaks/types
      │
      ▼
Next.js (Web) / Expo (Mobile)
      │  audio blob / text
      ▼
FastAPI Backend
  ├── Whisper STT  ──────────► transcribed text
  ├── OpenAI Embeddings ─────► query vector [1536-d]
  ├── Supabase pgvector RPC ──► top-K relevant chunks
  ├── GPT-4o ─────────────────► grounded answer
  └── Edge TTS ───────────────► MP3 audio (base64)
      │
      ▼
User hears answer + sees sources
```

---

## 📋 Admin Panel Features

- **Dashboard** — Stats: total docs, indexed, FAQs, queries today
- **Documents** — Drag-and-drop upload, real-time indexing status, delete, reindex
- **FAQs** — Add/edit/delete Q&A pairs, auto-embedded on save

---

## 🔒 Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` is backend-only (never sent to browsers)
- Admin mutations require valid Supabase JWT in `Authorization: Bearer` header
- Public voice/query endpoints are rate-limited (10 req/min per IP)
- All uploaded files are sanitized and validated by MIME type + extension

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Web Frontend | Next.js 14, Tailwind CSS |
| Mobile | React Native (Expo) |
| Backend API | Python 3.11, FastAPI |
| STT | faster-whisper (Whisper small, CPU) |
| TTS | edge-tts (Hindi + Indian English neural voices) |
| LLM | OpenAI GPT-4o |
| Embeddings | OpenAI text-embedding-3-small (1536-d) |
| Vector Store | Supabase pgvector |
| OCR | Tesseract 5 (eng+hin) |
| Task Queue | Celery + Redis |
