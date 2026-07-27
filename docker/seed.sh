#!/bin/sh
set -eu

RDBMS_URL="${RDBMS_URL:-https://raw.githubusercontent.com/kaansoral/adventureland-appserver/main/storage/db.rdbms}"
RDBMS_PATH="${RDBMS_PATH:-/tmp/db.rdbms}"
MONGO_URI="${MONGO_URI:-mongodb://mongo:27017/adventureland?replicaSet=rs0}"
MONGO_DB="${MONGO_DB:-adventureland}"

echo "Waiting for Mongo replica set..."
i=0
while [ "$i" -lt 60 ]; do
  if node -e "
    const {MongoClient}=require('mongodb');
    (async()=>{
      const c=new MongoClient(process.env.MONGO_URI||'${MONGO_URI}');
      await c.connect();
      const hi=await c.db('admin').command({hello:1});
      if(!hi.isWritablePrimary && !hi.ismaster) process.exit(2);
      await c.close();
    })().catch(()=>process.exit(1));
  "; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ ! -f "$RDBMS_PATH" ]; then
  echo "Fetching db.rdbms from ${RDBMS_URL}"
  mkdir -p "$(dirname "$RDBMS_PATH")"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$RDBMS_PATH" "$RDBMS_URL"
  else
    node -e "
      const fs=require('fs'); const https=require('https'); const http=require('http');
      const url=process.env.RDBMS_URL||'${RDBMS_URL}';
      const out=process.env.RDBMS_PATH||'${RDBMS_PATH}';
      const lib=url.startsWith('https')?https:http;
      lib.get(url,res=>{
        if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){
          lib.get(res.headers.location,r=>{const f=fs.createWriteStream(out); r.pipe(f); f.on('finish',()=>f.close());});
          return;
        }
        if(res.statusCode!==200){ console.error('HTTP',res.statusCode); process.exit(1);} 
        const f=fs.createWriteStream(out); res.pipe(f); f.on('finish',()=>f.close());
      }).on('error',e=>{console.error(e); process.exit(1);});
    "
  fi
fi

export RDBMS_PATH MONGO_URI MONGO_DB
export TARGET=

echo "Running RDBMS → Mongo migrate..."
cd /app/agentic
python3 -m pip install --break-system-packages -q pymongo 2>/dev/null || python3 -m pip install -q pymongo
python3 _migrate_rdbms.py

echo "Importing design/maps JSON (community fork maps)..."
cd /app
node scripts/import_design_maps.js

echo "Clearing SR_* online flags after seed..."
node -e "
  const {MongoClient}=require('mongodb');
  (async()=>{
    const uri=process.env.MONGO_URI||'${MONGO_URI}';
    const dbn=process.env.MONGO_DB||'${MONGO_DB}';
    const c=new MongoClient(uri);
    await c.connect();
    const r=await c.db(dbn).collection('server').updateMany({},{\$set:{online:false}});
    console.log('cleared online on', r.modifiedCount, 'servers');
    await c.close();
  })().catch(e=>{console.error(e); process.exit(1);});
"

echo "Running precompute_bfs..."
cd /app/node
if node precompute_bfs.js; then
  mkdir -p /shared/precomputed
  cp -f /app/node/precomputed_map_data.js /shared/precomputed/precomputed_map_data.js
  echo "Published precomputed_map_data.js to shared volume"
else
  echo "precompute_bfs warning (continuing; gameserver may use image-baked data)" >&2
fi

echo "Seed complete"
touch /app/.seed_complete
