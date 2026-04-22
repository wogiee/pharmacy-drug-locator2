#!/usr/bin/env python3
import json
import os
import urllib.parse
import urllib.request

service_key = os.environ["DRB_EASY_DRUG_API_KEY"]
params = {
    "serviceKey": service_key,
    "pageNo": "1",
    "numOfRows": "3",
    "type": "json",
    "itemName": "안티푸라민",
}
url = "http://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList"
req = urllib.request.Request(f"{url}?{urllib.parse.urlencode(params)}")
with urllib.request.urlopen(req, timeout=20) as response:
    payload = response.read().decode("utf-8", errors="replace")
print(payload[:1200])
try:
    data = json.loads(payload)
    print("keys:", list(data.keys()))
except Exception as exc:
    print("json error:", exc)
