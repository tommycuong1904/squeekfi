# SqueekFi

A read-only Hamster-to-Holder Console for Squeekchain's public Sepolia data.

SqueekFi makes the system legible: it separates hardware telemetry, Oracle acceptance, Ethereum-settled work, mining checkpoints, and the holder-facing reward state. It never asks for a wallet connection, signature, private key, or API key.

## What it does

- Shows a four-stage work journey: hardware → Oracle → settled → checkpointed.
- Tracks certified Squeek block milestones using only safe-chain data.
- Lets visitors inspect a public account’s Squeeks, power, claimable SQK and, when configured, Genesis receipts.
- Watches Genesis launch readiness without treating an unavailable launch as a zero-value launch.
- Offers a compact Stream Mode for use alongside a Squeekchain broadcast.

## Data sources

The dashboard calls the public Squeekchain API directly from the browser:

- `/v1/status`
- `/v1/core`
- `/v1/economy/state`
- `/v1/settlements?range=24h`
- `/v1/genesis-launch`
- `/v1/accounts/{address}`
- `/v1/genesis-launch/wallet/{address}`

No wallet connection, API key, or server-side secrets are required.

## Local preview

Serve the `dist/` directory with any static web server, for example:

```bash
npx serve dist
```

## Deployment

Vercel serves `dist/` as the static output directory, configured by `vercel.json`.
