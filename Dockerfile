FROM oven/bun:1-alpine
ARG GIT_SHA=local
ENV VERSION=$GIT_SHA

RUN mkdir -p /app /data
WORKDIR /app

COPY . /app/.
RUN bun ci

ENV DB_URL="file:/data/local.db"
ENV NODE_ENV="production"

# run the app
# USER bun
ENTRYPOINT [ "bun", "start" ]
