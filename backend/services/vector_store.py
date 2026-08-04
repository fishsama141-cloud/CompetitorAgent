"""ChromaDB vector store — chunk, embed, index & search.

Uses local sentence-transformers (BAAI/bge-small-zh-v1.5) for embeddings.
No API key required — runs entirely offline.
"""

from __future__ import annotations

import uuid
from typing import List

import chromadb
import os

from sentence_transformers import SentenceTransformer

from backend.config import settings

# ── Singletons ──────────────────────────────────────────────
_chroma_client: chromadb.PersistentClient | None = None
_collection: chromadb.Collection | None = None
_embed_model: SentenceTransformer | None = None

COLLECTION_NAME = "competitor_docs"
CHUNK_SIZE = 400
CHUNK_OVERLAP = 50
EMBED_MODEL_NAME = "all-MiniLM-L6-v2"  # 384-dim, fast, good multilingual support


def _get_chroma() -> chromadb.Collection:
    global _chroma_client, _collection
    if _collection is None:
        _chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
        _collection = _chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _get_embedder() -> SentenceTransformer:
    global _embed_model
    if _embed_model is None:
        # Use HF mirror for faster downloads in China
        if settings.hf_endpoint:
            os.environ["HF_ENDPOINT"] = settings.hf_endpoint
        _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
    return _embed_model


# ── Chunking ─────────────────────────────────────────────────

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Sliding-window split (400 chars / 50 overlap)."""
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = start + size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = end - overlap
    return chunks


# ── Ingest ───────────────────────────────────────────────────

def ingest(
    text: str,
    competitor_id: str,
    source_url: str,
    source_type: str,
) -> int:
    """Chunk text → embed locally → upsert into ChromaDB.  Returns chunk count."""
    if not text.strip():
        return 0

    chunks = chunk_text(text)
    if not chunks:
        return 0

    model = _get_embedder()
    collection = _get_chroma()

    embeddings = model.encode(chunks, normalize_embeddings=True).tolist()

    ids = [f"{competitor_id}_{uuid.uuid4().hex[:10]}" for _ in chunks]
    metadatas = [
        {
            "competitor_id": competitor_id,
            "source_url": source_url,
            "source_type": source_type,
            "chunk_index": i,
        }
        for i in range(len(chunks))
    ]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas,
    )

    return len(chunks)


# ── Search ───────────────────────────────────────────────────

def search(
    query: str,
    competitor_id: str,
    top_k: int = 5,
) -> List[dict]:
    """Embed query → ChromaDB cosine search → list of {chunk_id, content, source, similarity_score}."""
    model = _get_embedder()
    collection = _get_chroma()

    q_embedding = model.encode([query], normalize_embeddings=True).tolist()[0]

    results = collection.query(
        query_embeddings=[q_embedding],
        n_results=top_k,
        where={"competitor_id": competitor_id},
        include=["documents", "metadatas", "distances"],
    )

    ids_list = results.get("ids", [[]])[0]
    docs_list = results.get("documents", [[]])[0]
    metas_list = results.get("metadatas", [[]])[0]
    distances_list = results.get("distances", [[]])[0]

    output: List[dict] = []
    for i in range(len(ids_list)):
        distance = distances_list[i] if i < len(distances_list) else 0.0
        similarity = 1.0 - min(distance / 2.0, 1.0)

        meta = metas_list[i] if i < len(metas_list) else {}
        output.append({
            "chunk_id": ids_list[i],
            "content": docs_list[i] if i < len(docs_list) else "",
            "source": meta.get("source_url", ""),
            "similarity_score": round(similarity, 4),
        })

    return output
