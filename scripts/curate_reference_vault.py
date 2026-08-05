"""Curate a small, deduplicated, review-ready reference set from docs/examples.

The source images remain untouched. This creates a canonical public preview set
for the in-app reference vault and a manifest used by the Supabase importer.
References are advisory inspiration only; they never provide dimensions.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "examples"
OUT = ROOT / "apps" / "web" / "public" / "reference-vault"
MANIFEST = ROOT / "docs" / "reference-vault-manifest.json"

ROOM_RULES = [
    ("kitchen", ("kitchen", "chimney", "hob", "sink", "utility")),
    ("bedroom", ("bedroom", "wardrobe", "closet", "master")),
    ("living", ("living", "tv", "media", "sofa")),
    ("pooja", ("pooja", "shrine", "prayer", "temple", "altar")),
    ("dining", ("dining", "crockery")),
    ("study", ("study", "desk", "office", "workspace")),
    ("bathroom", ("bathroom", "wet-room", "cistern")),
    ("foyer", ("foyer", "hallway", "entrance", "entry")),
    ("ceiling", ("ceiling", "false-ceiling")),
]
FAMILY_BY_ROOM = {"kitchen": "kitchen", "bedroom": "wardrobe", "living": "tv-unit", "pooja": "pooja", "dining": "crockery", "study": "study", "bathroom": "bathroom", "foyer": "storage", "ceiling": "ceiling"}


def dhash(image: Image.Image) -> int:
    gray = image.convert("L").resize((17, 16))
    bits = 0
    for y in range(16):
        for x in range(16):
            bits = (bits << 1) | int(gray.getpixel((x, y)) > gray.getpixel((x + 1, y)))
    return bits


def ahash(image: Image.Image) -> int:
    gray = image.convert("L").resize((16, 16))
    pixels = list(gray.getdata())
    average = sum(pixels) / len(pixels)
    bits = 0
    for pixel in pixels:
        bits = (bits << 1) | int(pixel > average)
    return bits


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def classify(name: str) -> tuple[str, str, str, list[str]]:
    n = name.lower()
    room = "interior"
    for candidate, words in ROOM_RULES:
        if any(word in n for word in words):
            room = candidate
            break
    style = "luxury" if any(word in n for word in ("luxury", "premium", "elegant")) else "scandinavian" if any(word in n for word in ("scandi", "scandinavian")) else "modern-minimal"
    tags = [room, FAMILY_BY_ROOM.get(room, "interior"), style]
    for word in ("wood", "walnut", "sage", "beige", "grey", "purple", "fluted", "glass", "arched", "loft", "open-shelf", "warm-lighting", "elevation", "photorealistic"):
        if word.replace("-", " ") in n or word in n:
            tags.append(word)
    return room, FAMILY_BY_ROOM.get(room, "interior"), style, sorted(set(tags))


def score(path: Path, width: int, height: int) -> float:
    n = path.stem.lower()
    if width < 800 or height < 600:
        return -1
    value = min(width * height / 1_000_000, 12)
    value += sum(4 for word in ("kitchen", "wardrobe", "tv", "crockery", "pooja", "study", "bedroom", "living", "dining", "render", "elevation") if word in n)
    value += sum(2 for word in ("modern", "minimal", "premium", "luxury", "professional", "photorealistic") if word in n)
    if "copy" not in n:
        value += 3
    return value


def main() -> None:
    records = []
    seen_sha = set()
    for path in sorted(SOURCE.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        raw = path.read_bytes()
        sha = hashlib.sha256(raw).hexdigest()
        if sha in seen_sha:
            continue
        seen_sha.add(sha)
        try:
            with Image.open(path) as image:
                width, height = image.size
                fingerprint = dhash(image)
                average_fingerprint = ahash(image)
        except Exception:
            continue
        rating = score(path, width, height)
        if rating < 0:
            continue
        room, family, style, tags = classify(path.name)
        records.append({"source": path, "sha256": sha, "width": width, "height": height, "fingerprint": fingerprint, "average_fingerprint": average_fingerprint, "score": rating, "room": room, "family": family, "style": style, "tags": tags})

    # Keep visually distinct images, preferring named, high-resolution renders.
    records.sort(key=lambda row: (-row["score"], str(row["source"])))
    chosen = []
    for row in records:
        if any(hamming(row["fingerprint"], existing["fingerprint"]) <= 8 or hamming(row["average_fingerprint"], existing["average_fingerprint"]) <= 10 for existing in chosen):
            continue
        chosen.append(row)
    # Guarantee broad furniture coverage, then fill to 60 for future review.
    by_room: dict[str, list[dict]] = defaultdict(list)
    for row in chosen:
        by_room[row["room"]].append(row)
    balanced = []
    for room in ("kitchen", "bedroom", "living", "dining", "pooja", "study", "foyer", "ceiling", "bathroom", "interior"):
        balanced.extend(by_room.get(room, [])[:6])
    for row in chosen:
        if row not in balanced:
            balanced.append(row)
    chosen = balanced[:60]
    if len(chosen) < 50:
        raise SystemExit(f"Only {len(chosen)} distinct references qualified; refusing to create an undersized vault.")

    if OUT.exists():
        for old in OUT.iterdir():
            if old.is_file():
                old.unlink()
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for index, row in enumerate(chosen, start=1):
        ext = row["source"].suffix.lower()
        filename = f"{index:03d}-{row['sha256'][:12]}{ext}"
        shutil.copy2(row["source"], OUT / filename)
        manifest.append({
            "id": f"ref-curated-{index:03d}",
            "title": re.sub(r"\s+", " ", row["source"].stem.replace("-", " ")).strip(),
            "source_path": row["source"].relative_to(ROOT).as_posix(),
            "preview_path": f"/reference-vault/{filename}",
            "sha256": row["sha256"],
            "byte_size": row["source"].stat().st_size,
            "width": row["width"],
            "height": row["height"],
            "room": row["room"],
            "module_family": row["family"],
            "style": row["style"],
            "tags": row["tags"],
            "viewpoint": "render",
            "provenance": "internal_reference",
            "license_state": "internal_only",
            "review_state": "approved",
            "metadata": {"previewPath": f"/reference-vault/{filename}", "curation": "curated-v1", "dimensionsAdvisory": True},
        })
    MANIFEST.write_text(json.dumps({"version": "curated-v1", "source_count": len(records), "selected_count": len(manifest), "entries": manifest}, indent=2) + "\n", encoding="utf-8")
    print(f"Selected {len(manifest)} distinct references from {len(records)} eligible images")


if __name__ == "__main__":
    main()
