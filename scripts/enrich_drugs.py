#!/usr/bin/env python3
import csv
import json
import os
import re
import time
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "data" / "products.csv"
OUT_PATH = ROOT / "data" / "drug-details.json"
API_URL = "http://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList"


def clean_text(value):
    if not value:
        return ""
    value = re.sub(r"<[^>]+>", "", value)
    value = value.replace("&nbsp;", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def query_terms(name):
    terms = []
    simplified = re.sub(r"\([^)]*\)", " ", name)
    simplified = re.sub(r"\b\d+\s*(매입|개입|정|정입|캡슐|포|포입|ml|mL|g|mg|박스)\b", " ", simplified)
    simplified = re.sub(r"\d+(?:\.\d+)?\s*(매입|개입|정|정입|캡슐|포|포입|ml|mL|g|mg|박스)", " ", simplified)
    simplified = re.sub(r"\s+", " ", simplified).strip()
    first = simplified.split()[0] if simplified else name.split()[0]
    if first and first not in terms:
        terms.append(first)
    first_two = " ".join(simplified.split()[:2]) if simplified else ""
    if first_two and first_two not in terms:
        terms.append(first_two)
    if simplified and simplified not in terms:
        terms.append(simplified)
    if name and name not in terms:
        terms.append(name)
    return terms


def request_items(service_key, item_name):
    params = {
        "serviceKey": service_key,
        "pageNo": "1",
        "numOfRows": "20",
        "type": "json",
        "itemName": item_name,
    }
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as response:
        payload = response.read().decode("utf-8", errors="replace")
    data = json.loads(payload)
    items = data.get("body", {}).get("items", [])
    if isinstance(items, dict):
        items = [items]
    return items or []


def score_match(source_name, item):
    official = item.get("itemName") or ""
    maker = item.get("entpName") or ""
    base = SequenceMatcher(None, source_name, official).ratio()
    if source_name in official or official in source_name:
        base += 0.2
    if maker and maker in source_name:
        base += 0.05
    return base


def build_description(item):
    sections = [
        ("효능", item.get("efcyQesitm")),
        ("사용법", item.get("useMethodQesitm")),
        ("주의사항", item.get("atpnQesitm")),
        ("복용 전 확인", item.get("atpnWarnQesitm")),
        ("상호작용", item.get("intrcQesitm")),
        ("부작용", item.get("seQesitm")),
        ("보관법", item.get("depositMethodQesitm")),
    ]
    chunks = []
    for title, value in sections:
        text = clean_text(value)
        if text:
            chunks.append(f"{title}\n{text}")
    return "\n\n".join(chunks)


def main():
    service_key = os.environ.get("DRB_EASY_DRUG_API_KEY")
    if not service_key:
        raise SystemExit("DRB_EASY_DRUG_API_KEY 환경변수가 필요합니다.")

    with CSV_PATH.open(encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))

    enriched = {}
    misses = []
    cache = {}

    for index, row in enumerate(rows, start=1):
        source_name = row.get("약품명", "").strip()
        if not source_name:
          continue

        candidates = []
        for term in query_terms(source_name):
            if term in cache:
                candidates = cache[term]
            else:
                try:
                    candidates = request_items(service_key, term)
                except Exception as exc:
                    print(f"[WARN] {source_name}: {exc}", flush=True)
                    candidates = []
                cache[term] = candidates
            if candidates:
                break
            time.sleep(0.08)

        if not candidates:
            misses.append(source_name)
            print(f"[MISS] {source_name}", flush=True)
            continue

        best = max(candidates, key=lambda item: score_match(source_name, item))
        score = score_match(source_name, best)
        if score < 0.45:
            misses.append(source_name)
            print(f"[LOW] {source_name} -> {best.get('itemName')} ({score:.2f})", flush=True)
            continue

        product_id = f"drug-{index}"
        enriched[product_id] = {
            "officialName": clean_text(best.get("itemName")),
            "manufacturer": clean_text(best.get("entpName")),
            "description": build_description(best),
            "imageUrl": clean_text(best.get("itemImage")),
            "sourceUrl": "https://www.data.go.kr/data/15075057/openapi.do",
            "sourceName": "식품의약품안전처 의약품개요정보(e약은요)",
            "itemSeq": clean_text(best.get("itemSeq")),
            "matchedScore": round(score, 3),
            "matchedAt": time.strftime("%Y-%m-%d"),
        }
        print(f"[OK] {source_name} -> {enriched[product_id]['officialName']} ({score:.2f})", flush=True)
        time.sleep(0.08)

    OUT_PATH.write_text(
        json.dumps({"items": enriched, "misses": misses}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"saved {len(enriched)} matches, {len(misses)} misses -> {OUT_PATH}")


if __name__ == "__main__":
    main()
