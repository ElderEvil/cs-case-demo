FROM docker.io/oven/bun:1-slim

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY static ./static

ENV NODE_ENV=production
EXPOSE 8000

CMD ["bun", "run", "src/index.ts"]
