#!/bin/bash
set -e
HOST="${MONGO_HOST:-mongo}"
PORT="${MONGO_PORT:-27017}"

echo "Waiting for mongod at ${HOST}:${PORT}..."
for i in $(seq 1 60); do
  if mongosh --host "$HOST" --port "$PORT" --quiet --eval 'db.adminCommand({ ping: 1 })' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Initiating replica set if needed..."
mongosh --host "$HOST" --port "$PORT" --quiet --eval '
try {
  const s = rs.status();
  if (s.ok) {
    print("Replica set already configured");
    quit(0);
  }
} catch (e) {}
rs.initiate({_id: "rs0", members: [{_id: 0, host: "mongo:27017"}]});
print("rs.initiate issued");
'

echo "Waiting for primary..."
for i in $(seq 1 60); do
  if mongosh --host "$HOST" --port "$PORT" --quiet --eval 'quit(rs.isMaster().ismaster ? 0 : 1)' 2>/dev/null; then
    echo "Replica set ready"
    exit 0
  fi
  sleep 1
done
echo "Replica set init timed out" >&2
exit 1
