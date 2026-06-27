import os
from pathlib import Path

import chromadb
from chromadb.config import Settings

CHROMA_DIR = Path(__file__).parent / "chroma_db"
COLLECTION_NAME = "farmdesk_knowledge"

_client = None
_collection = None


def _get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False),
        )
    return _client


def _get_collection():
    global _collection
    if _collection is None:
        client = _get_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def add_chunks(chunks: list[str], metadatas: list[dict] | None = None, ids: list[str] | None = None):
    collection = _get_collection()
    if ids is None:
        start = collection.count()
        ids = [f"chunk_{start + i}" for i in range(len(chunks))]
    collection.add(documents=chunks, metadatas=metadatas, ids=ids)


def query(query_text: str, n_results: int = 5) -> list[str]:
    collection = _get_collection()
    if collection.count() == 0:
        return []
    results = collection.query(query_texts=[query_text], n_results=n_results)
    if not results["documents"] or not results["documents"][0]:
        return []
    return results["documents"][0]


def count() -> int:
    return _get_collection().count()
