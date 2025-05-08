
#!/bin/bash

# Ensure PORT is set
export PORT=${PORT:-3000}

# Echo environment information
echo "Starting production environment with PORT=$PORT"

# Run docker compose for production
docker compose -f docker-compose.prod.yml up -d

# Show running containers
echo "Containers now running:"
docker ps