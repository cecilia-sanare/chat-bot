# TODO: Look into swapping back to alpine
# FROM oven/bun:1-alpine
FROM oven/bun:latest
ARG GIT_SHA=local
ENV VERSION=$GIT_SHA

# RUN apk add libc6-compat
# RUN apk add python3 py3-pip pipx
RUN apt-get update && apt-get install -y python3 python3-pip pipx ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pipx install tiddl

RUN mkdir -p /app /data
WORKDIR /app

COPY . /app/.
RUN bun ci
RUN bun run build

ENV PATH="/root/.local/bin:$PATH"
ENV DB_URL="file:/data/local.db"
ENV NODE_ENV="production"

# run the app
# USER bun
ENTRYPOINT [ "bun", "start" ]
