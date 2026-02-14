FROM oven/bun:1-alpine

RUN mkdir -p /app /data
WORKDIR /app

COPY . /app/.
RUN bun ci

ENV DB_URL="file:/data/local.db"

# run the app
# USER bun
ENTRYPOINT [ "bun", "start" ]
