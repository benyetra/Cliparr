# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm install --workspaces

# Copy source
COPY server/ server/
COPY web/ web/

# Build both packages
RUN npm run build --workspace=web
RUN npm run build --workspace=server

# Production stage
FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy built files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server/package.json server/
COPY --from=builder /app/server/dist/ server/dist/
COPY --from=builder /app/server/node_modules/ server/node_modules/
COPY --from=builder /app/web/dist/ web/dist/
COPY --from=builder /app/node_modules/ node_modules/

# Create data directories
RUN mkdir -p /config /clips

ENV NODE_ENV=production
ENV CONFIG_DIR=/config
ENV CLIPS_DIR=/clips
ENV CLIPARR_HOST=0.0.0.0
ENV CLIPARR_PORT=7879

EXPOSE 7879

VOLUME ["/config", "/clips"]

CMD ["node", "server/dist/index.js"]
