# Miracle reminder worker

This Worker delivers opt-in installed-PWA reminders from the shared `miracle-db` D1 database. It runs every 15 minutes in UTC, converts each subscription to its stored IANA time zone, respects quiet hours, and deduplicates each reminder by device, local date, and kind.

Required production secrets:

```powershell
npx web-push generate-vapid-keys
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
```

Apply the root D1 migrations before deploying this Worker. The public key must also be configured as `VAPID_PUBLIC_KEY` on the Pages project so `/notifications/vapid-key` can return it to authenticated clients.
