"""ChromaDB vector store — chunk, embed, index & search."""

from __future__ import annotations

import uuid
from typing import List

import chromadb
from openai import OpenAI

from backend.config import settings


# ── Singletons (lazy init on first use) ──────────────────────
_chroma_client: chromadb.PersistentClient | None = None
_collection: chromadb.Collection | None = None
_openai_client: OpenAI | None = None

COLLECTION_NAME = "competitor_docs"
CHUNK_SIZE = 400
CHUNK_OVERLAP = 50


def _get_chroma() -> chromadb.Collection:
    global _chroma_client, _collection
    if _collection is None:
        _chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
        _collection = _chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _get_openai() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )
    return _openai_client


# ── Chunking ──────────────────────────────────────────────────

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Sliding-window split.  Each chunk is ~400 chars with 50-char overlap."""
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


# ── Ingest ────────────────────────────────────────────────────

def ingest(
    text: str,
    competitor_id: str,
    source_url: str,
    source_type: str,
) -> int:
    """Chunk text, embed each chunk, and upsert into ChromaDB.

    Returns number of chunks created.
    """
    if not text.strip():
        return 0

    chunks = chunk_text(text)
    if not chunks:
        return 0

    openai = _get_openai()
    collection = _get_chroma()

    # Batch-embed all chunks at once for speed
    resp = openai.embeddings.create(
        model="text-embedding-3-small",
        input=chunks,
    )
    embeddings = [d.embedding for d in resp.data]

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


# ── Search ────────────────────────────────────────────────────

def search(
    query: str,
    competitor_id: str,
    top_k: int = 5,
) -> List[dict]:
    """Semantic search: embed the query → retrieve top_k from ChromaDB.

    Returns list of dicts: { chunk_id, content, source, similarity_score }
    """
    openai = _get_openai()
    collection = _get_chroma()

    q_embedding = (
        openai.embeddings.create(model="text-embedding-3-small", input=[query])
        .data[0]
        .embedding
    )

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
        # ChromaDB returns L2 or cosine distance depending on config;
        # we store with cosine space, so convert distance → similarity
        distance = distances_list[i] if i < len(distances_list) else 0.0
        similarity = 1.0 - min(distance / 2.0, 1.0)  # cosine sim from cosine distance

        meta = metas_list[i] if i < len(metas_list) else {}
        output.append({
            "chunk_id": ids_list[i],
            "content": docs_list[i] if i < len(docs_list) else "",
            "source": meta.get("source_url", ""),
            "similarity_score": round(similarity, 4),
        })

    return output
