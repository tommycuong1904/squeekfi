# SqueekFi

A lightweight, read-only dashboard for Squeekchain's public Sepolia data.

## Data sources

The dashboard calls the public Squeekchain API directly from the browser:

- `/v1/status`
- `/v1/core`
- `/v1/economy/state`
- `/v1/events`

No wallet connection, API key, or server-side secrets are required.

## Local preview

Serve the `dist/` directory with any static web server, for example:

```bash
npx serve dist
```

## Deployment

Vercel serves `dist/` as the static output directory, configured by `vercel.json`.
