# chat-bot

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
