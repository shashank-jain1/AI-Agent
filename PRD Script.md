# 🚀 VIBE CODING PROMPT — FINAL VERSION (v3)
## RAG-Based Multilingual AI Voice Agent
### Web App (Next.js) + Mobile App (React Native) + Admin Panel + FastAPI Backend

---

## 🎯 PROJECT OVERVIEW

Build a **full-stack, production-ready, bilingual (Hindi + English) RAG AI Voice Chatbot** that runs on:
- **Web** (Next.js — desktop & mobile browser)
- **iOS & Android** (React Native — single codebase)
- **Admin Panel** (Next.js — document & FAQ management)

The AI agent answers questions **strictly from documents uploaded by admins** — no hallucinations, no out-of-scope answers. Voice is handled entirely on the **backend** using self-hosted Whisper (STT) and Edge TTS (TTS), so it works identically on web, iOS, and Android.

---

## 🏗️ FINAL TECH STACK

| Layer | Technology | Reason |
|---|---|---|
| Web Frontend | Next.js 14 (App Router) + Tailwind CSS + shadcn/ui | Web app + Admin panel |
| Mobile App | React Native (Expo) — iOS + Android | Single codebase for both platforms |
| Backend API | Python 3.11 + FastAPI | RAG pipeline + STT/TTS |
| STT | **Whisper `small` model — self-hosted** via `faster-whisper` | Free, Hindi+English, works from any client |
| TTS | **Edge TTS** via `edge-tts` Python library | Free, neural voices, natural Hindi + English |
| LLM | OpenAI GPT-4o (`gpt-4o`) | Answer generation |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dims) | Semantic search |
| Vector Store | Supabase `pgvector` | Vector similarity search |
| Database + Auth + Storage | Supabase (PostgreSQL + Auth + Storage) | Everything data |
| OCR | Tesseract 5.x (`pytesseract`) + `pdf2image` | Scanned image/PDF text extraction |
| PDF Parser | PyMuPDF (`fitz`) | Text PDF extraction |
| PPTX Parser | `python-pptx` | PowerPoint extraction |
| Task Queue | Celery + Redis | Async document ingestion |
| Mobile Audio | `expo-av` + `expo-file-system` | Record + play audio in React Native |
| Deployment | Vercel (web) + Railway (backend + worker + Redis) | Production hosting |

---

## 📁 COMPLETE PROJECT STRUCTURE

```
/
├── frontend/                          # Next.js — Web Agent + Admin Panel
│   ├── app/
│   │   ├── page.tsx                   # AI Voice Agent (web)
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── page.tsx               # Admin login
│   │       ├── dashboard/page.tsx     # Dashboard
│   │       ├── documents/page.tsx     # Document management
│   │       └── faqs/page.tsx          # FAQ management
│   ├── components/
│   │   ├── agent/
│   │   │   ├── VoiceOrb.tsx           # Animated orb UI
│   │   │   ├── ChatThread.tsx         # Message history
│   │   │   ├── MicButton.tsx          # Record button
│   │   │   └── useVoiceAgent.ts       # Main hook — audio record + API calls
│   │   └── admin/
│   │       ├── UploadZone.tsx
│   │       ├── DocumentTable.tsx
│   │       └── FaqManager.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── api.ts                     # All API call functions
│   └── middleware.ts                  # Auth guard for /admin routes
│
├── mobile/                            # React Native Expo App
│   ├── app/
│   │   ├── _layout.tsx                # Root layout + navigation
│   │   ├── index.tsx                  # Voice agent screen (home)
│   │   └── history.tsx                # Chat history screen
│   ├── components/
│   │   ├── VoiceOrb.tsx               # Animated orb (React Native version)
│   │   ├── ChatBubble.tsx             # Message bubble component
│   │   └── LanguageToggle.tsx         # EN / हि toggle
│   ├── hooks/
│   │   └── useVoiceAgent.ts           # Audio record + API + playback hook
│   ├── lib/
│   │   └── api.ts                     # API calls (shared logic with web)
│   ├── app.json
│   └── package.json
│
└── backend/                           # FastAPI
    ├── main.py                        # App entry, CORS, router registration
    ├── routers/
    │   ├── voice.py                   # STT + TTS endpoints
    │   ├── query.py                   # RAG query (text in, text out)
    │   ├── documents.py               # Upload, list, delete, reindex
    │   └── faqs.py                    # FAQ CRUD + embedding
    ├── services/
    │   ├── stt.py                     # Whisper STT service
    │   ├── tts.py                     # Edge TTS service
    │   ├── rag.py                     # RAG pipeline
    │   ├── embedder.py                # OpenAI embeddings
    │   ├── chunker.py                 # Text chunking
    │   ├── ingestion.py               # Document ingestion orchestrator
    │   ├── ocr.py                     # Tesseract OCR
    │   └── parsers/
    │       ├── pdf_parser.py
    │       ├── pptx_parser.py
    │       ├── docx_parser.py
    │       └── image_parser.py
    ├── workers/
    │   └── celery_worker.py
    ├── models/
    │   └── schemas.py
    ├── db/
    │   └── supabase_client.py
    └── requirements.txt
```

---

## 🗄️ DATABASE SETUP

Run this entire SQL block in the Supabase SQL editor before writing any code:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents metadata table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'pptx', 'docx', 'image')),
  storage_path TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (
    status IN ('queued','processing','ocr_processing','embedding','indexed','failed')
  ),
  page_count INT DEFAULT 0,
  chunk_count INT DEFAULT 0,
  ocr_used BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector chunks table
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  page_number INT DEFAULT 1,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- IVFFlat index for fast cosine similarity search
CREATE INDEX ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- FAQs table
CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  embedding vector(1536),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query logs (analytics)
CREATE TABLE query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  language TEXT,
  response_text TEXT,
  chunks_used INT DEFAULT 0,
  response_time_ms INT,
  client_type TEXT DEFAULT 'web',  -- 'web' or 'mobile'
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Similarity search function (searches both doc chunks and FAQs)
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  page_number INT,
  similarity FLOAT,
  metadata JSONB,
  filename TEXT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    dc.metadata,
    d.original_name AS filename
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE d.status = 'indexed'
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  UNION ALL
  SELECT
    f.id,
    NULL AS document_id,
    (f.question || ' ' || f.answer) AS content,
    1 AS page_number,
    1 - (f.embedding <=> query_embedding) AS similarity,
    '{}'::jsonb AS metadata,
    'FAQ' AS filename
  FROM faqs f
  WHERE f.is_active = TRUE
    AND 1 - (f.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
```

---

## ⚙️ ENVIRONMENT VARIABLES

### `frontend/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### `mobile/.env`
```env
EXPO_PUBLIC_API_URL=http://your-backend-url:8000
```

### `backend/.env`
```env
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
REDIS_URL=redis://localhost:6379
WHISPER_MODEL=small
MAX_CHUNK_SIZE=900
CHUNK_OVERLAP=100
SIMILARITY_THRESHOLD=0.75
TOP_K_CHUNKS=8
```

---

## 🔧 BACKEND — BUILD EVERY FILE EXACTLY AS DESCRIBED

---

### `backend/services/stt.py` — Whisper Speech-to-Text

```python
# Self-hosted Whisper STT using faster-whisper (CTranslate2 optimized)
# faster-whisper is 4x faster than original whisper on CPU

# On startup: load model ONCE into memory (expensive operation)
# model = WhisperModel("small", device="cpu", compute_type="int8")
# Use int8 quantization for CPU — halves memory, minimal quality loss

# Function: transcribe_audio(audio_path: str, language: str = None) -> dict
#   Input: path to audio file (supports mp4, m4a, webm, wav, mp3, ogg)
#   If language is 'hi': force language='hi' in whisper
#   If language is 'en': force language='en'
#   If language is 'auto' or None: let Whisper auto-detect (it's very good)
#   
#   segments, info = model.transcribe(audio_path, language=language, beam_size=5)
#   full_text = " ".join([seg.text for seg in segments]).strip()
#   
#   Return: {
#     text: str,                    # transcribed text
#     language: str,                # detected/forced language code ('hi' or 'en')
#     language_probability: float   # confidence of language detection
#   }
#
# Function: convert_audio_to_wav(input_path: str, output_path: str)
#   Use ffmpeg via subprocess to convert any audio format to 16kHz mono WAV
#   Command: ffmpeg -i input -ar 16000 -ac 1 -f wav output -y
#   Whisper works best on 16kHz mono WAV regardless of input format
```

---

### `backend/services/tts.py` — Edge TTS Text-to-Speech

```python
# Microsoft Edge TTS — completely free, neural quality voices
# Python library: edge-tts (pip install edge-tts)
# No API key needed — uses the same engine as Microsoft Edge browser's read-aloud

# Voice mapping:
VOICES = {
    'hi': 'hi-IN-SwaraNeural',    # Hindi female — natural, clear
    'en': 'en-IN-NeerjaNeural',   # Indian English female — great for India context
}
# Alternative English voice if Indian accent not preferred: 'en-US-JennyNeural'

# Function: synthesize_speech(text: str, language: str, output_path: str) -> str
#   voice = VOICES.get(language, VOICES['en'])
#   communicate = edge_tts.Communicate(text, voice)
#   await communicate.save(output_path)   # saves as MP3
#   Return: output_path
#
# Function: text_to_speech_bytes(text: str, language: str) -> bytes
#   Save to a temp file using tempfile.NamedTemporaryFile
#   Call synthesize_speech()
#   Read bytes from file, delete temp file
#   Return raw MP3 bytes
#
# Note: edge-tts is async — use asyncio.run() or await depending on call context
# For FastAPI async endpoints, use await directly
```

---

### `backend/services/embedder.py` — OpenAI Embeddings

```python
# OpenAI text-embedding-3-small — 1536 dimensions
# 
# Function: generate_embedding(text: str) -> list[float]
#   Clean text: strip, normalize whitespace, max 8000 chars
#   Call: client.embeddings.create(model="text-embedding-3-small", input=text)
#   Return: response.data[0].embedding
#   Retry with tenacity: wait_exponential(min=1, max=30), stop_after_attempt(4)
#
# Function: generate_embeddings_batch(texts: list[str]) -> list[list[float]]
#   Split into batches of 100
#   Call API for each batch
#   Flatten and return all embeddings in original order
```

---

### `backend/services/chunker.py` — Text Chunking

```python
# Token-aware text chunker using tiktoken
# Encoding: cl100k_base (same as GPT-4)
#
# Function: chunk_text(text: str, page_number: int = 1) -> list[dict]
#   1. Split text on double newlines (\n\n) to get paragraphs
#   2. Accumulate paragraphs into a chunk until MAX_CHUNK_SIZE tokens reached
#   3. When limit reached: save chunk, start new chunk with last CHUNK_OVERLAP tokens
#   4. Each chunk: {text, chunk_index, page_number}
#   Return list of chunks
#
# Function: chunk_pages(pages: list[dict]) -> list[dict]
#   Input: list of {page_number, text}
#   For each page: call chunk_text(text, page_number)
#   Return all chunks flattened with correct page_number per chunk
```

---

### `backend/services/ocr.py` — Tesseract OCR

```python
# SYSTEM DEPENDENCY — install before running:
#   apt-get install tesseract-ocr tesseract-ocr-hin poppler-utils ffmpeg
#
# Function: is_pdf_scanned(pdf_path: str) -> bool
#   Open with PyMuPDF, sample first 3 pages
#   Count extractable text chars per page
#   If average < 50 chars/page → True (it's a scanned/image PDF)
#
# Function: extract_text_from_image(image_path: str) -> str
#   Open with Pillow
#   Convert to RGB, resize to ensure min 300 DPI equivalent
#   Convert to grayscale
#   Run: pytesseract.image_to_string(img, lang='eng+hin', config='--psm 6')
#   Post-process: normalize whitespace, remove lines with < 3 chars
#   Return cleaned text
#
# Function: ocr_pdf_pages(pdf_path: str) -> list[dict]
#   Convert PDF to images: pdf2image.convert_from_path(pdf_path, dpi=300)
#   For each page image: run extract_text_from_image()
#   Return: [{page_number, text}]
```

---

### `backend/services/parsers/pdf_parser.py`

```python
# Function: extract_pdf_text(file_path: str) -> tuple[list[dict], bool]
#   Returns: (pages, ocr_used)
#   pages = [{page_number, text}]
#
#   1. Try PyMuPDF text extraction first
#   2. Call is_pdf_scanned() — if True, call ocr_pdf_pages() instead
#   3. Clean all text: normalize unicode (unicodedata.normalize NFKC), strip excessive whitespace
```

---

### `backend/services/parsers/pptx_parser.py`

```python
# Function: extract_pptx_text(file_path: str) -> list[dict]
#   For each slide (use python-pptx):
#     Extract: title shape + all text frames + all table cells + speaker notes
#     Join all text with \n
#   Return: [{page_number: slide_number, text}]
#   Skip empty slides
```

---

### `backend/services/parsers/docx_parser.py`

```python
# Function: extract_docx_text(file_path: str) -> list[dict]
#   Use python-docx
#   Extract all paragraphs and table cells in order
#   Treat whole document as page 1 (docx has no native pages in python-docx)
#   Return: [{page_number: 1, text: full_document_text}]
```

---

### `backend/services/parsers/image_parser.py`

```python
# Function: extract_image_text(file_path: str) -> list[dict]
#   Calls ocr.extract_text_from_image()
#   Return: [{page_number: 1, text: ocr_result, is_ocr: True}]
```

---

### `backend/services/ingestion.py` — Document Pipeline Orchestrator

```python
# Function: ingest_document(document_id: str, storage_path: str, file_type: str)
#
# Full pipeline:
#   1. Download file from Supabase Storage to /tmp/{document_id}/{filename}
#   2. Update DB status → 'processing'
#   3. Route to parser:
#      - 'pdf'   → pdf_parser.extract_pdf_text()
#      - 'pptx'  → pptx_parser.extract_pptx_text()
#      - 'docx'  → docx_parser.extract_docx_text()
#      - 'image' → image_parser.extract_image_text()
#   4. If OCR was used: update status → 'ocr_processing' (then continue)
#   5. Chunk all pages: chunker.chunk_pages(pages)
#   6. Update status → 'embedding'
#   7. Extract text from all chunks, generate embeddings in batch
#   8. Insert all chunks into document_chunks table with embeddings
#   9. Update document: status='indexed', chunk_count, page_count, ocr_used
#  10. Clean up /tmp files
#
# On ANY exception:
#   Update document: status='failed', error_message=str(exception)
#   Re-raise for Celery to log
```

---

### `backend/services/rag.py` — RAG Pipeline

```python
# Function: answer_query(query: str, language: str, session_id: str, client_type: str) -> dict
#
# FALLBACK MESSAGES (use these exact strings):
FALLBACK = {
    'en': "I'm sorry, I couldn't find relevant information in the available documents. Please try rephrasing your question or contact support.",
    'hi': "मुझे खेद है, उपलब्ध दस्तावेज़ों में आपके प्रश्न से संबंधित जानकारी नहीं मिली। कृपया अपना प्रश्न दोबारा पूछें या सहायता से संपर्क करें।"
}
#
# Pipeline:
#   1. start_time = time.time()
#   2. Generate query embedding
#   3. Call Supabase RPC match_chunks(query_embedding, threshold, top_k)
#   4. If no results: return {answer: FALLBACK[language], sources: [], chunks_used: 0, ...}
#   5. Build context:
#      For each chunk: "Source: {filename} (Page {page_number})\n{content}\n---"
#      Join all chunks into one context string
#   6. Build messages for GPT-4o:
#
#      SYSTEM: """You are a helpful assistant. Answer the user's question using ONLY the
#      document context provided. Do not use any outside knowledge whatsoever.
#      If the answer is not in the context, say you couldn't find it — don't guess.
#      Respond in the SAME language as the user's question:
#      - If the question is in Hindi → answer in Hindi
#      - If the question is in English → answer in English
#      After your answer, on a new line write: 'Sources: [list the document names used]'
#      Keep your response concise and helpful."""
#
#      USER: f"Context:\n{context}\n\nQuestion: {query}"
#
#   7. Call GPT-4o: model="gpt-4o", max_tokens=1024, temperature=0.1
#   8. Calculate response_time_ms
#   9. Log to query_logs asynchronously (don't block the response)
#  10. Return: {
#        answer: str,
#        language: str,
#        sources: [{filename, page_number, similarity}],
#        chunks_used: int,
#        response_time_ms: int
#      }
```

---

### `backend/routers/voice.py` — STT + TTS Endpoints

```python
# This is the KEY router — handles all audio in/out for both web and mobile

# POST /api/voice/transcribe
#   Content-Type: multipart/form-data
#   Fields:
#     - audio: UploadFile (audio file — m4a, webm, wav, mp3, ogg all accepted)
#     - language: str = "auto"  ('hi', 'en', or 'auto')
#   
#   Steps:
#     1. Save uploaded audio to /tmp/{uuid}_audio.{ext}
#     2. Convert to 16kHz mono WAV using stt.convert_audio_to_wav()
#     3. Call stt.transcribe_audio(wav_path, language)
#     4. Delete temp files
#     5. Return: {text, language, language_probability}

# POST /api/voice/synthesize
#   Content-Type: application/json
#   Body: {text: str, language: str}  ('hi' or 'en')
#   
#   Steps:
#     1. Validate text length (max 2000 chars — split longer text on frontend)
#     2. Call tts.text_to_speech_bytes(text, language)
#     3. Return StreamingResponse with media_type="audio/mpeg"
#        Include header: X-Language: {language}

# POST /api/voice/query  ← THE MAIN UNIFIED ENDPOINT
#   Content-Type: multipart/form-data
#   Fields:
#     - audio: UploadFile
#     - language: str = "auto"
#     - session_id: str
#     - client_type: str = "web"  ('web' or 'mobile')
#     - tts: str = "true"  (whether to return audio or just text)
#   
#   Steps:
#     1. Transcribe audio → get query text + detected language
#     2. Call rag.answer_query(query, detected_language, session_id, client_type)
#     3. If tts="true": synthesize answer audio
#        Return multipart response with both JSON metadata and audio
#        OR: Return JSON with answer text + base64-encoded audio
#     4. If tts="false": return JSON only (text answer + sources)
#   
#   Return (when tts=true):
#   {
#     query: str,          # what user said (transcribed)
#     answer: str,         # AI text answer
#     language: str,       # detected language
#     sources: [...],      # document citations
#     audio: str,          # base64-encoded MP3 audio of the answer
#     audio_format: "mp3"
#   }
```

---

### `backend/routers/query.py` — Text-Only Query

```python
# POST /api/query
#   For text input (no audio) — used when user types instead of speaking
#   Body: {query: str, language: str, session_id: str, client_type: str}
#   Returns: {answer, language, sources, chunks_used, response_time_ms}
#   Rate limit: 15 requests/minute per IP (slowapi)

# POST /api/query/tts
#   For getting TTS of any text (used after text query for voice response)
#   Body: {text: str, language: str}
#   Returns: StreamingResponse (audio/mpeg)
```

---

### `backend/routers/documents.py`

```python
# POST /api/documents/upload (requires auth JWT)
#   Multipart: file (UploadFile) 
#   Validate: MIME type + extension (pdf, pptx, docx, png, jpg, jpeg, tiff, webp)
#   Validate: size <= 50MB
#   Sanitize filename: slugify, replace spaces with underscores
#   Upload to Supabase Storage: bucket='documents', path='{uuid}/{filename}'
#   Insert into documents table: status='queued'
#   Trigger Celery: ingest_document.delay(document_id, storage_path, file_type)
#   Return: {document_id, filename, status: 'queued'}

# GET /api/documents (requires auth JWT)
#   Optional query params: ?status=indexed&search=report
#   Return: list of documents with all metadata

# GET /api/documents/{id}/status
#   Return: {status, chunk_count, page_count, ocr_used, error_message, updated_at}
#   (Public — used for polling from admin panel)

# DELETE /api/documents/{id} (requires auth JWT)
#   Delete chunks (CASCADE handles DB), delete from Storage, delete record

# POST /api/documents/{id}/reindex (requires auth JWT)
#   Delete existing chunks, reset status='queued', re-trigger Celery task
```

---

### `backend/routers/faqs.py`

```python
# POST /api/faqs (requires auth JWT)
#   Body: {question: str, answer: str}
#   Combine: text = f"Q: {question}\nA: {answer}"
#   Generate embedding for combined text
#   Insert into faqs table with embedding
#   Return created FAQ

# GET /api/faqs (public — needed by agent for display)
#   Return: list of active FAQs

# PUT /api/faqs/{id} (requires auth JWT)
#   Update question/answer, regenerate embedding

# DELETE /api/faqs/{id} (requires auth JWT)
#   Soft delete: set is_active=FALSE (preserve for analytics)
```

---

### `backend/workers/celery_worker.py`

```python
# Celery app setup
# broker_url = REDIS_URL
# result_backend = REDIS_URL
#
# @celery.task(bind=True, max_retries=2, default_retry_delay=30, time_limit=600)
# def ingest_document_task(self, document_id, storage_path, file_type):
#   try:
#     ingestion.ingest_document(document_id, storage_path, file_type)
#   except Exception as exc:
#     self.retry(exc=exc)
#
# Run in dev: celery -A workers.celery_worker worker --loglevel=info --concurrency=2
```

---

### `backend/main.py`

```python
# FastAPI app setup:
# - CORS: allow origins ["*"] in dev, set specific domains in prod
# - Include all routers with prefix /api
# - On startup: load Whisper model into memory (so first request isn't slow)
#   @app.on_event("startup") async def startup(): stt.load_model()
# - Health check: GET /health → {status: "ok", whisper_loaded: bool}
# - Global exception handler for clean error responses
```

---

### `backend/requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
python-multipart==0.0.9
pydantic==2.7.1
pydantic-settings==2.3.0
openai==1.35.0
supabase==2.5.0
faster-whisper==1.0.1
edge-tts==6.1.9
PyMuPDF==1.24.5
python-pptx==0.6.23
python-docx==1.1.2
pytesseract==0.3.10
pdf2image==1.17.0
Pillow==10.3.0
tiktoken==0.7.0
celery==5.4.0
redis==5.0.6
tenacity==8.3.0
python-dotenv==1.0.1
httpx==0.27.0
slowapi==0.1.9
python-slugify==8.0.4
```

---

## 🌐 WEB FRONTEND — NEXT.JS

### `frontend/components/agent/useVoiceAgent.ts`

```typescript
// Main hook for the web voice agent
// Uses MediaRecorder API to capture audio, then sends to backend

export function useVoiceAgent(language: 'en' | 'hi') {
  // STATE
  // - status: 'idle' | 'listening' | 'processing' | 'speaking'
  // - transcript: string     (shown while processing — the transcribed text)
  // - messages: Message[]    (full chat history)
  // - sessionId: string      (generated once on mount: crypto.randomUUID())

  // RECORDING with MediaRecorder
  // startRecording():
  //   1. navigator.mediaDevices.getUserMedia({ audio: true })
  //   2. new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
  //   3. Collect chunks in ondataavailable
  //   4. Set status = 'listening'
  //
  // stopRecording():
  //   1. mediaRecorder.stop() → triggers onstop
  //   2. In onstop: create Blob from chunks, call sendVoiceQuery(blob)

  // sendVoiceQuery(audioBlob: Blob):
  //   1. Set status = 'processing'
  //   2. Add user message placeholder to messages (with spinner)
  //   3. POST to /api/voice/query:
  //      FormData: { audio: audioBlob, language, session_id, client_type: 'web', tts: 'true' }
  //   4. Parse JSON response: {query, answer, audio, language, sources}
  //   5. Update user message with actual transcribed query text
  //   6. Add AI message with answer + sources
  //   7. Play audio: decode base64 → AudioContext → play
  //   8. Set status = 'speaking', on audio end → status = 'idle'

  // sendTextQuery(text: string):
  //   1. POST to /api/query: {query: text, language, session_id, client_type: 'web'}
  //   2. Get back {answer, sources}
  //   3. POST to /api/query/tts: {text: answer, language}
  //   4. Get back audio blob, play it
  //   5. Add messages to history

  // playAudioBase64(base64: string):
  //   const bytes = atob(base64)
  //   const buffer = new ArrayBuffer(bytes.length)
  //   ... fill buffer ...
  //   const audioCtx = new AudioContext()
  //   const decoded = await audioCtx.decodeAudioData(buffer)
  //   const source = audioCtx.createBufferSource()
  //   source.buffer = decoded
  //   source.connect(audioCtx.destination)
  //   source.start()
  //   source.onended = () => setStatus('idle')

  return { status, transcript, messages, startRecording, stopRecording, sendTextQuery }
}
```

---

### Main Agent Page (`frontend/app/page.tsx`)

**Visual Design: Dark futuristic, premium feel**
- Background: `#070710` — near black with subtle blue tint
- Primary: `#3B82F6` (electric blue)
- Accent: `#8B5CF6` (violet)
- Font: Import `Syne` from Google Fonts (futuristic, geometric)
- Subtle animated starfield or grain texture in background (CSS only)

**Layout:**
```
┌──────────────────────────────────────────┐
│  ◈ VoiceBot              [EN | हि]  [≡] │  ← Header
│─────────────────────────────────────────│
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Chat messages scroll here         │  │  ← Scrollable, flex-col-reverse
│  │  [User bubble right]               │  │
│  │  [AI bubble left + sources below]  │  │
│  └────────────────────────────────────┘  │
│                                          │
│            ╔═══════════╗                 │
│            ║  VOICE    ║  ← Animated     │
│            ║   ORB     ║    orb          │
│            ╚═══════════╝                 │
│                                          │
│    [transcript or "Tap mic to speak"]    │
│                                          │
│              [ 🎤 ]                      │  ← Big mic button
│                                          │
│         ─── or type below ───            │
│  [____________________________] [Send →] │
└──────────────────────────────────────────┘
```

**Orb animation states:**
- `idle`: slow breathing glow, pulse scale 1.0→1.08→1.0 over 3s ease-in-out infinite
- `listening`: 3 concentric rings expand outward with opacity fade, bright blue, staggered 0.5s delay each
- `processing`: rotating conic-gradient border, violet+blue, 1.5s linear infinite
- `speaking`: 5 vertical bars with bounce animation at different heights and speeds (equalizer effect), green color

**Chat messages:**
- User bubble: right side, `bg-blue-600`, rounded-2xl, rounded-tr-sm
- AI bubble: left side, `bg-white/5 border border-white/10`, rounded-2xl, rounded-tl-sm
- Source chips below AI bubble: `📄 filename · Page N` in small gray pills
- Smooth scroll to bottom on each new message (useEffect + scrollIntoView)
- Typing indicator: 3 bouncing dots while waiting for response

**Language toggle:**
- Pill style: `[EN] [हि]` — active side has blue background
- On switch: update language in hook, show brief transition

---

## 📱 MOBILE APP — REACT NATIVE (EXPO)

### Setup

```bash
npx create-expo-app mobile --template blank-typescript
cd mobile
npx expo install expo-av expo-file-system expo-constants
npm install @react-navigation/native @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
```

### `mobile/hooks/useVoiceAgent.ts`

```typescript
// Mobile voice agent hook using expo-av for audio recording + playback

import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system'

export function useVoiceAgent(language: 'en' | 'hi') {
  // STATE: same as web — status, transcript, messages, sessionId

  // PERMISSIONS (call once on mount)
  // await Audio.requestPermissionsAsync()
  // await Audio.setAudioModeAsync({
  //   allowsRecordingIOS: true,
  //   playsInSilentModeIOS: true,  // CRITICAL for iOS — plays even on silent mode
  // })

  // RECORDING
  // startRecording():
  //   const recording = new Audio.Recording()
  //   await recording.prepareToRecordAsync({
  //     android: {
  //       extension: '.m4a',
  //       outputFormat: Audio.AndroidOutputFormat.MPEG_4,
  //       audioEncoder: Audio.AndroidAudioEncoder.AAC,
  //       sampleRate: 16000,
  //       numberOfChannels: 1,
  //       bitRate: 128000,
  //     },
  //     ios: {
  //       extension: '.m4a',
  //       outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
  //       audioQuality: Audio.IOSAudioQuality.HIGH,
  //       sampleRate: 16000,
  //       numberOfChannels: 1,
  //       bitRate: 128000,
  //     },
  //     web: {}
  //   })
  //   await recording.startAsync()
  //   setRecording(recording)
  //   setStatus('listening')

  // stopRecording():
  //   await recording.stopAndUnloadAsync()
  //   const uri = recording.getURI()   // local file path on device
  //   sendVoiceQuery(uri)

  // sendVoiceQuery(audioUri: string):
  //   setStatus('processing')
  //   const response = await FileSystem.uploadAsync(
  //     `${API_URL}/api/voice/query`,
  //     audioUri,
  //     {
  //       httpMethod: 'POST',
  //       uploadType: FileSystem.FileSystemUploadType.MULTIPART,
  //       fieldName: 'audio',
  //       parameters: { language, session_id: sessionId, client_type: 'mobile', tts: 'true' }
  //     }
  //   )
  //   const data = JSON.parse(response.body)
  //   // data = { query, answer, audio (base64 mp3), language, sources }
  //
  //   Add messages to state
  //   playAudioBase64(data.audio)

  // playAudioBase64(base64Audio: string):
  //   const audioPath = FileSystem.cacheDirectory + 'response.mp3'
  //   await FileSystem.writeAsStringAsync(audioPath, base64Audio, {
  //     encoding: FileSystem.EncodingType.Base64
  //   })
  //   const { sound } = await Audio.Sound.createAsync({ uri: audioPath })
  //   await sound.playAsync()
  //   setStatus('speaking')
  //   sound.setOnPlaybackStatusUpdate((s) => {
  //     if (s.isLoaded && s.didJustFinish) setStatus('idle')
  //   })

  // sendTextQuery(text: string): same pattern — POST to /api/query, then /api/query/tts

  return { status, transcript, messages, startRecording, stopRecording, sendTextQuery }
}
```

---

### `mobile/app/index.tsx` — Main Voice Screen

**Design: Match the web design but native**
- Dark background `#070710`
- Use React Native Animated API for the orb animations
- SafeAreaView wrapping everything

**Layout (React Native):**
```tsx
<SafeAreaView style={styles.container}>
  {/* Header */}
  <View style={styles.header}>
    <Text style={styles.logo}>◈ VoiceBot</Text>
    <LanguageToggle language={language} onChange={setLanguage} />
  </View>

  {/* Chat Thread — FlatList, inverted */}
  <FlatList
    data={messages}
    inverted                          {/* Newest at bottom, auto-scrolls */}
    renderItem={({ item }) => <ChatBubble message={item} />}
    keyExtractor={item => item.id}
    style={styles.chatList}
  />

  {/* Voice Orb */}
  <VoiceOrb status={status} />

  {/* Transcript text */}
  <Text style={styles.transcript}>
    {transcript || (status === 'idle' ? 'Tap the mic to speak' : '')}
  </Text>

  {/* Mic Button */}
  <TouchableOpacity
    onPress={status === 'listening' ? stopRecording : startRecording}
    style={[styles.micButton, status === 'listening' && styles.micActive]}
  >
    <MicIcon color={status === 'listening' ? '#EF4444' : '#3B82F6'} size={32} />
  </TouchableOpacity>

  {/* Text Input fallback */}
  <View style={styles.textInput}>
    <TextInput
      placeholder={language === 'hi' ? 'यहाँ टाइप करें...' : 'Type your question...'}
      placeholderTextColor="#555"
      onSubmitEditing={(e) => sendTextQuery(e.nativeEvent.text)}
    />
  </View>
</SafeAreaView>
```

---

### `mobile/components/VoiceOrb.tsx`

```tsx
// Animated orb using React Native Animated API
// Props: status: 'idle' | 'listening' | 'processing' | 'speaking'
//
// idle: Animated.loop — scale 1.0 → 1.08 → 1.0, duration 3000ms
//
// listening: 3 Animated.View rings positioned absolutely around orb center
//   Each ring: scale 1 → 2.5, opacity 0.8 → 0, duration 1500ms
//   Stagger delays: 0ms, 500ms, 1000ms
//   All in Animated.loop
//
// processing: rotate animation 0deg → 360deg, duration 1200ms, linear, loop
//   Applied to a gradient ring around the orb using react-native-linear-gradient
//   or just a border with borderStyle: 'dashed' that rotates
//
// speaking: 5 bars (View) with height animation
//   Each bar height oscillates between 8 and 32, different durations (300-600ms)
//   Color: #22C55E (green)
//
// Center of orb: solid circle with glow shadow
//   shadowColor: '#3B82F6', shadowRadius: 20, shadowOpacity: 0.8
```

---

### `mobile/components/ChatBubble.tsx`

```tsx
// Props: message: { role: 'user' | 'ai', text: string, sources?: Source[] }
//
// User: alignSelf='flex-end', backgroundColor='#2563EB', borderRadius: 18, borderBottomRightRadius: 4
// AI: alignSelf='flex-start', backgroundColor='#1a1a2e', borderColor='#333', borderWidth: 1,
//     borderRadius: 18, borderBottomLeftRadius: 4
//
// Sources (below AI bubble):
//   Row of small chips: "📄 filename · Page N"
//   backgroundColor: '#1e1e3a', borderRadius: 100, padding: 4 8
```

---

### `mobile/app.json`

```json
{
  "expo": {
    "name": "VoiceBot",
    "slug": "voicebot-rag",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "backgroundColor": "#070710"
    },
    "ios": {
      "supportsTablet": false,
      "infoPlist": {
        "NSMicrophoneUsageDescription": "VoiceBot needs microphone access to listen to your questions."
      }
    },
    "android": {
      "permissions": ["RECORD_AUDIO"],
      "package": "com.yourname.voicebot"
    }
  }
}
```

---

## 🚦 IMPLEMENTATION ORDER (follow this exactly)

### Phase 1 — Backend Foundation (Days 1–2)
1. Run the Supabase SQL schema
2. Create `documents` storage bucket in Supabase (set to private)
3. Set up Supabase Auth — create one admin user manually
4. Build and test `embedder.py` in isolation with a test script
5. Build and test `chunker.py` with sample text
6. Install system deps: `apt-get install tesseract-ocr tesseract-ocr-hin poppler-utils ffmpeg`
7. Build and test `ocr.py` with a sample scanned image
8. Build all 4 parsers, test each with a real file
9. Build `ingestion.py` and test the full pipeline end-to-end with a sample PDF

### Phase 2 — Backend API (Days 3–4)
10. Build `stt.py` — download Whisper small model, test transcription in English and Hindi
11. Build `tts.py` — test Edge TTS generating Hindi and English MP3
12. Build `rag.py` — test with pre-indexed data
13. Build all routers: `voice.py`, `query.py`, `documents.py`, `faqs.py`
14. Build `main.py` with CORS and startup Whisper preload
15. Set up Celery + Redis, test async ingestion pipeline
16. Full end-to-end API test with curl/Postman:
    - Upload PDF → wait for indexing → POST voice query → get back audio response

### Phase 3 — Admin Panel (Days 5–6)
17. Admin login with Supabase Auth
18. Dashboard with stats cards
19. Document upload with drag-and-drop + progress bars + real-time status polling
20. FAQ manager with add/edit/delete

### Phase 4 — Web Voice Agent (Days 7–8)
21. Build `useVoiceAgent.ts` hook — test recording, API call, audio playback
22. Build VoiceOrb with all 4 animation states
23. Build ChatThread with messages and source chips
24. Wire everything together on the main page
25. Test full web voice flow: speak → transcribe → answer → hear response

### Phase 5 — Mobile App (Days 9–11)
26. Set up Expo project, install dependencies
27. Build `useVoiceAgent.ts` mobile hook — test recording and playback on device
28. Build VoiceOrb component with React Native Animated
29. Build ChatBubble component
30. Build main voice screen
31. Test on Android emulator + iOS simulator
32. Fix any platform-specific issues (especially iOS silent mode)

### Phase 6 — Polish + Deploy (Days 12–13)
33. Error boundaries, loading states, empty states everywhere
34. Rate limiting validation
35. Mobile: test on real physical devices (both Android and iPhone)
36. Deploy backend to Railway (set env vars, Whisper model downloads on first start)
37. Deploy web frontend to Vercel
38. Submit mobile app build: `npx expo build` or EAS Build

---

## 🔐 SECURITY

- Admin panel: Next.js middleware checks Supabase session, redirects to `/admin` if not authenticated
- Mutation endpoints (`/documents`, `/faqs` POST/PUT/DELETE): require `Authorization: Bearer {supabase_jwt}` header, verify with Supabase admin client
- Public endpoints (`/api/voice/query`, `/api/query`): rate limited — 10 req/min per IP via slowapi
- Never send `SUPABASE_SERVICE_ROLE_KEY` to any client — backend only
- Validate file MIME type by reading file magic bytes (not just extension)
- Sanitize all filenames, reject path traversal attempts (`../` in filename)
- Audio files in /tmp: always delete after processing, never store permanently

---

## ✅ DEFINITION OF DONE

**Backend:**
- [ ] Upload a text PDF → indexed in < 60 seconds
- [ ] Upload a scanned image → OCR extracts text, gets indexed
- [ ] Upload a PPTX → each slide chunked and indexed
- [ ] POST voice query with Hindi audio → correct Hindi text answer + Hindi MP3 back
- [ ] POST voice query with English audio → correct English answer + English MP3 back
- [ ] When no relevant docs: returns fallback message (not hallucinated answer)
- [ ] FAQ added via API → immediately searchable

**Web:**
- [ ] Admin can login, upload docs, see real-time indexing status
- [ ] User can speak English question → hear English answer
- [ ] User can speak Hindi question → hear Hindi answer  
- [ ] User can type question → hear and read answer
- [ ] Sources cited below every AI response

**Mobile:**
- [ ] App builds for Android (APK/AAB)
- [ ] App builds for iOS (IPA)
- [ ] Voice recording works on Android physical device
- [ ] Voice recording works on iPhone (including with phone on silent)
- [ ] Audio response plays correctly on both platforms
- [ ] Hindi and English both work end-to-end

---

## 💡 CRITICAL IMPLEMENTATION NOTES

**Whisper:**
1. Use `faster-whisper` not `openai-whisper` — it's 4x faster on CPU, same quality
2. Load model ONCE on FastAPI startup using `@app.on_event("startup")` — cold loading takes 5–15 seconds, you don't want it per-request
3. Whisper `small` model is ~460MB — it downloads automatically on first run via `faster_whisper.WhisperModel("small")`
4. Always convert audio to 16kHz mono WAV before sending to Whisper — use ffmpeg. Mobile sends m4a, web sends webm, Whisper prefers WAV
5. For Hindi, Whisper `small` works well. If you find quality lacking, upgrade to `medium` (1.5GB) — still runs on CPU

**Edge TTS:**
6. `edge-tts` is async — all functions must be awaited. In FastAPI async routes, use `await` directly
7. `hi-IN-SwaraNeural` is the best Hindi voice. Test it — it's genuinely good, not robotic
8. For long answers (> 500 chars), Edge TTS may timeout. Split on sentence boundaries and synthesize chunks, then concatenate MP3 bytes

**Mobile Audio:**
9. iOS CRITICAL: `playsInSilentModeIOS: true` in `Audio.setAudioModeAsync()` — without this, audio won't play when iPhone is on silent mode
10. iOS CRITICAL: `allowsRecordingIOS: true` must be set before starting any recording session
11. On Android, M4A format works best with AAC encoder. Don't use OGG on Android — compatibility issues
12. `FileSystem.uploadAsync` is the right way to upload audio from React Native — don't use fetch with FormData for binary files

**Shared:**
13. Return audio as base64 in JSON response (not streaming) — simpler to handle in both web (AudioContext) and mobile (FileSystem.writeAsStringAsync)
14. Session ID: generate with `crypto.randomUUID()` on web, `expo-crypto` or a simple UUID library on mobile. Keep in memory (state), not storage
15. The `client_type` field in logs lets you analyze web vs mobile usage separately later
