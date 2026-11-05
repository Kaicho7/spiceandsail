# Local preview — Spice & Sail (concierge bot included)

Run the site locally with the real Netlify function handlers, no deploy:

```
npm run preview:local
```

This builds `dist/` and starts `scripts/local-preview-server.js` on
`http://localhost:8888`. Routes `/.netlify/functions/*` (quote, lead,
chat, admin-leads) go to the real handlers in `netlify/functions/`.

## Environment (local only, never committed)

`package.json` reads the untracked `.env.local` (gitignored via
`.env.*`):

```
ALLOWED_ORIGINS=http://localhost:8888
STAFF_PASSCODE=test-passcode-local-only
```

Create `.env.local` yourself if you change anything — it is not in the
repository.

## What you can test locally

1. **Homepage:** open `http://localhost:8888/` — the site loads.
2. **Launcher:** every rendered page that includes the widget footer
   shows exactly one `sns-concierge-trigger` button. Click it; the
   concierge modal opens and the service grid is populated from
   `/.netlify/functions/quote` (catalogue-backed, no client pricing).
3. **Chat:** open the widget, switch to chat, send a message —
   `/.netlify/functions/chat` replies without an LLM key.
4. **Lead submit:** fill the 3-step form (service, date/travelers,
   name, WhatsApp, consent) and submit. A real `SP-YYYY-NNNNNN`
   reference appears, returned by `/.netlify/functions/lead`.
5. **Admin read-back:** call the staff endpoint with the test passcode:

```
curl -s -H "Authorization: Bearer test-passcode-local-only" \
  http://localhost:8888/.netlify/functions/admin-leads
```

The submitted lead appears in the list, retrievable by its reference.

## Stop the server

Press `Ctrl+C` in the terminal where `npm run preview:local` is running.

## Notes

- `dist/` is rebuilt by the command, so you can re-run after edits.
- The server is a local development stand-in for `netlify dev`; it does
  not reproduce Netlify's edge environment. Production env vars and the
  Netlify CLI deploy path are not tested here.
