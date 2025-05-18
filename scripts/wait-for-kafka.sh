#!/bin/bash

# wait-for-kafka.sh
echo "Waiting for Kafka to be ready..."

until curl -s http://kafka:9092 >/dev/null 2>&1 || timeout 1 bash -c 'cat /dev/null >/dev/tcp/kafka/9092' >/dev/null 2>&1; do
  echo "Kafka is not ready yet. Waiting..."
  sleep 5
done

echo "Kafka is ready! Starting NestJS application..."
exec "$@"