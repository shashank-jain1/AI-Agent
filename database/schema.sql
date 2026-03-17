-- ============================================================
-- VoiceBot RAG — Supabase SQL Schema
-- Run this ENTIRE block in the Supabase SQL Editor
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Documents metadata ──────────────────────────────────────────────────────
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

-- ── Vector chunks ───────────────────────────────────────────────────────────
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

-- ── FAQs ────────────────────────────────────────────────────────────────────
CREATE TABLE faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  embedding vector(1536),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Query logs (analytics) ──────────────────────────────────────────────────
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

-- ── Unified similarity search function ─────────────────────────────────────
-- Searches both document_chunks AND faqs simultaneously
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

-- ── Storage bucket ─────────────────────────────────────────────────────────
-- Run manually in Supabase Dashboard → Storage → New bucket → 'documents' (private)
-- Or via SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
