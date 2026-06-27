import os
import re
from pathlib import Path

from . import vector_store

DOCUMENTS_DIR = Path(__file__).parent / "documents"


def _chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    paragraphs = re.split(r"\n\s*\n", text.strip())
    chunks = []
    buffer = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(buffer) + len(para) < chunk_size:
            buffer += para + "\n"
        else:
            if buffer:
                chunks.append(buffer.strip())
            buffer = para + "\n"
    if buffer:
        chunks.append(buffer.strip())

    if len(chunks) < 2:
        return chunks

    merged = []
    for i, chunk in enumerate(chunks):
        if i > 0 and len(chunk) < chunk_size // 3:
            merged[-1] += "\n" + chunk
        else:
            merged.append(chunk)
    return merged


def load_file(filepath: str) -> int:
    path = Path(filepath)
    text = path.read_text(encoding="utf-8")
    chunks = _chunk_text(text)
    source_name = path.stem
    metadatas = [{"source": source_name} for _ in chunks]
    ids = [f"{source_name}_{i}" for i in range(len(chunks))]
    vector_store.add_chunks(chunks, metadatas=metadatas, ids=ids)
    return len(chunks)


def load_all():
    total = 0
    for fpath in sorted(DOCUMENTS_DIR.glob("*.txt")):
        total += load_file(str(fpath))
    return total


if __name__ == "__main__":
    count = load_all()
    print(f"Loaded {count} chunks from {DOCUMENTS_DIR}")
