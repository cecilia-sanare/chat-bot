**This repository has moved to https://codeberg.org/ribbon-studios/chat-bot**

# chat-bot

## Prerequisites

- [Bun](https://bun.sh/)

## Quick Start (Shell)

### Shell

This should primarily be used for local development.

```sh
bun ci
bun dev
```

### Discord, Fluxer, etc.

Based on the tokens you have set it'll automatically determine which platforms to setup!

```sh
# .env
DISCORD_BOT_TOKEN="<your-token-here>"
FLUXER_BOT_TOKEN="<your-token-here>"
SONARR_URL="..."
SONARR_API_KEY="..."
RADARR_URL="..."
RADARR_API_KEY="..."
DB_URL=file:local.db
```

```sh
bun ci
bun start
```

### Docker Compose

```yml
services:
  chat-bot:
    container_name: chat-bot
    image: ghcr.io/cecilia-sanare/chat-bot:main
    restart: unless-stopped
    environment:
      # Your Fluxer Bot Token (Optional)
      FLUXER_BOT_TOKEN: ...
      # Your Discord Bot Token (Optional)
      DISCORD_BOT_TOKEN: ...
      # Sonarr Base URL (Optional)
      SONARR_URL: ...
      # Sonarr API Key (Optional)
      SONARR_API_KEY: ...
      # Radarr Base URL (Optional)
      RADARR_URL: ...
      # Radarr API Key (Optional)
      RADARR_API_KEY: ...
    volumes:
      # SQLite Database
      - ./data:/data
```
