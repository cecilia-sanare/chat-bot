FROM oven/bun:1-slim
ENV PATH="/root/.local/bin:$PATH" \
    DB_URL="file:/data/local.db" \
    NODE_ENV="production"

# System deps first — these change least often
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip pipx ffmpeg \
  && pipx install tiddl \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app /data
WORKDIR /app

# Copy lockfile + package.json first so this layer is cached unless deps change
COPY package.json bun.lock* /app/
# Copy only package.json files from each workspace
COPY packages/core/package.json /app/packages/core/
COPY packages/demo/package.json /app/packages/demo/
COPY packages/discord/package.json /app/packages/discord/
COPY packages/fluxer/package.json /app/packages/fluxer/

RUN bun ci

# Now copy source and build
COPY . /app/
RUN bun run build

ARG GIT_SHA=local
ENV VERSION=$GIT_SHA

# run the app
# USER bun
ENTRYPOINT [ "bun", "start" ]
