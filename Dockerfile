FROM node:24-bookworm-slim

# Install build tools for native modules (bcrypt, sqlite3)
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend and frontend
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY instructions.md ./

# Create data directory for SQLite database
RUN mkdir -p /data

# Expose port
EXPOSE 2992

# Set working directory to backend
WORKDIR /app/backend

# Start server
CMD ["node", "server.js"]
