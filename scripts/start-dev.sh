#!/bin/bash
# docker compose script for development environment
docker compose -f docker-compose.dev.yml up -d           
# Ensure PORT is set
export PORT=${PORT:-3000}

# Echo environment information
echo "Starting development environment with PORT=$PORT"

# Run docker compose
docker compose -f docker-compose.dev.yml up -d

# Show running containers
echo "Containers now running:"
docker ps

