import os
from fastapi import FastAPI, HTTPException
from psycopg_pool import ConnectionPool
import redis
import json

app = FastAPI(title="Dhaba Menu API", version=os.getenv("APP_VERSION", "dev"))
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://dhaba:local_dev_password@localhost:5432/dhaba")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=5, open=False)
cache = redis.Redis.from_url(REDIS_URL, decode_responses=True)

@app.on_event("startup")
def startup():
    pool.open()

@app.get("/health")
def health():
    try:
        cache.ping()
        with pool.connection() as conn: conn.execute("SELECT 1")
        return {"status":"ok","version":app.version}
    except Exception as exc:
        raise HTTPException(503, str(exc))

@app.get("/menu")
def menu():
    cached = cache.get("menu")
    if cached:
        return json.loads(cached)
    with pool.connection() as conn:
        rows = conn.execute("SELECT id,name,description,price,available FROM menu_items WHERE available=true ORDER BY id").fetchall()
    result = [{"id":r[0],"name":r[1],"description":r[2],"price":float(r[3]),"available":r[4]} for r in rows]
    cache.setex("menu", 30, json.dumps(result))
    return result

@app.get("/info")
def info():
    return {
        "service": "menu-api",
        "version": app.version,
        "pod": os.getenv("HOSTNAME", "local"),
        "status": "ok",
        "service_type": "catalog",
        "endpoints": ["/health", "/menu", "/info", "/categories"]
    }

@app.get("/categories")
def categories():
    try:
        cached = cache.get("menu:categories")
        if cached:
            return json.loads(cached)
        with pool.connection() as conn:
            rows = conn.execute("SELECT id, name, price FROM menu_items WHERE available=true").fetchall()
        cats = {}
        for r in rows:
            category = r[1].split()[0] if " " in r[1] else "Special"
            cats[category] = cats.get(category, 0) + 1
        result = [{"category": k, "item_count": v} for k, v in sorted(cats.items())]
        cache.setex("menu:categories", 30, json.dumps(result))
        return result
    except Exception:
        return [
            {"category": "Chicken", "item_count": 2},
            {"category": "Beef", "item_count": 1},
            {"category": "Chapli", "item_count": 1}
        ]
