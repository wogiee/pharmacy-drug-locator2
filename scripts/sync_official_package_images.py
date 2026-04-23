import json
import re
import urllib.parse
import urllib.request
from pathlib import Path


SUPABASE_URL = "https://ulmwnhzxuchreyyizazi.supabase.co"
SUPABASE_KEY = "sb_publishable_4QXydl9WrLiJUem__dVJPA_IwVVAUlT"
ROOT = Path(__file__).resolve().parents[1]


def normalize(text: str) -> str:
    return re.sub(r"[\s()\[\]{}·ㆍ\-/]", "", (text or "").lower())


def is_official_image(url: str) -> bool:
    return isinstance(url, str) and url.startswith("https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def request_json(method: str, path: str, body=None):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=minimal"
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(f"{SUPABASE_URL}{path}", method=method, headers=headers, data=data)
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else None


def patch_product_image(product_id: str, image_url: str):
    query_id = urllib.parse.quote(product_id, safe="")
    request_json("PATCH", f"/rest/v1/products?id=eq.{query_id}", {"image_url": image_url})


def build_image_maps():
    seed_products = read_json(ROOT / "data" / "seed-products.json")
    details = read_json(ROOT / "data" / "drug-details.json").get("items", {})

    by_id = {}
    by_name = {}
    by_official_name = {}

    for row in seed_products:
      image_url = row.get("image_url", "")
      if not is_official_image(image_url):
          continue
      product_id = row.get("id", "")
      name = row.get("name", "")
      official_name = row.get("official_name", "")
      if product_id:
          by_id[product_id] = image_url
      if name:
          by_name[normalize(name)] = image_url
      if official_name:
          by_official_name[normalize(official_name)] = image_url

    for product_id, detail in details.items():
        image_url = detail.get("imageUrl", "")
        if not is_official_image(image_url):
            continue
        official_name = detail.get("officialName", "")
        if product_id:
            by_id[product_id] = image_url
        if official_name:
            by_official_name[normalize(official_name)] = image_url

    return by_id, by_name, by_official_name


def pick_image(product, by_id, by_name, by_official_name):
    product_id = product.get("id", "")
    if product_id in by_id:
        return by_id[product_id]

    official_name = normalize(product.get("official_name", ""))
    if official_name and official_name in by_official_name:
        return by_official_name[official_name]

    name = normalize(product.get("name", ""))
    if name and name in by_name:
        return by_name[name]

    return ""


def main():
    by_id, by_name, by_official_name = build_image_maps()
    products = request_json("GET", "/rest/v1/products?select=id,name,official_name,image_url")

    # First clear every registered image reference.
    request_json("PATCH", "/rest/v1/products?id=not.is.null", {"image_url": ""})

    updated = 0
    for product in products:
        image_url = pick_image(product, by_id, by_name, by_official_name)
        if not image_url:
            continue
        patch_product_image(product["id"], image_url)
        updated += 1

    print(json.dumps({"total_products": len(products), "official_package_images_applied": updated}, ensure_ascii=False))


if __name__ == "__main__":
    main()
