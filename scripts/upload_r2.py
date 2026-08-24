"""
Upload the generated browser data (web/public/data/**) to the Cloudflare R2
bucket, which the frontend reads from data.unwatched.net.

Env (from GitHub Actions secrets):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
  R2_BUCKET (optional, default "unwatched-data")

Usage:
  python scripts/upload_r2.py               # upload everything (migration)
  python scripts/upload_r2.py san-jose-ca   # a city + the index (after add-city)

Object keys mirror the data dir, so e.g. web/public/data/san-jose-ca/graph.json
-> https://data.unwatched.net/san-jose-ca/graph.json, and cities.json is at the
root -> https://data.unwatched.net/cities.json.
"""
import mimetypes
import os
import sys
from pathlib import Path

import boto3

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "public" / "data"
BUCKET = os.environ.get("R2_BUCKET", "unwatched-data")


def client():
    # tolerate the account id being pasted as a bare id, a hostname, or a full
    # URL — normalize down to just the 32-char account id.
    acct = os.environ["R2_ACCOUNT_ID"].strip()
    acct = acct.replace("https://", "").replace("http://", "").split(".")[0].strip("/")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{acct}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"].strip(),
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"].strip(),
        region_name="auto",
    )


def content_type(path: Path) -> str:
    if path.suffix in (".json", ".geojson"):
        return "application/json"
    return mimetypes.guess_type(str(path))[0] or "application/octet-stream"


def files_for(slugs):
    if not slugs:
        return [p for p in DATA.rglob("*") if p.is_file()]
    out = []
    for slug in slugs:
        out += [p for p in (DATA / slug).rglob("*") if p.is_file()]
    index = DATA / "cities.json"  # always refresh the index so new cities appear
    if index.exists() and index not in out:
        out.append(index)
    return out


def main():
    s3 = client()
    files = files_for(sys.argv[1:])
    for p in files:
        key = str(p.relative_to(DATA))
        # short cache on the small mutable files (index + demographics) so
        # updates show up quickly; long cache on the heavy, stable blobs
        short = {"cities.json", "demographics.json", "redlining.json"}
        cache = "public, max-age=300" if p.name in short else "public, max-age=86400"
        s3.upload_file(str(p), BUCKET, key, ExtraArgs={"ContentType": content_type(p), "CacheControl": cache})
        print(f"  ↑ {key}")
    print(f"uploaded {len(files)} file(s) to r2://{BUCKET}")


if __name__ == "__main__":
    main()
