# Owner Actions Required for Spice & Sail Concierge

1. **Rotate BUILD_TOKEN, then purge it from git history**:
   - The repository previously had `BUILD_TOKEN` committed at the root. It has now been untracked (`git rm --cached`) and ignored.
   - The token should be rotated immediately on whatever service it authenticates.
   - Once rotated and approved by the repository owner, a history purge (e.g. `git-filter-repo` or BFG) should be performed to permanently excise the historical commits containing the token string.

2. **Set Netlify environment variables**:
   - `GEMINI_API_KEY` - from the shell environment (owner generates and sets this)
   - `STAFF_PASSCODE` - a generated random passcode (store ONLY in `~/spiceandsail_owner_secrets.txt`, chmod 600, outside the repo)
   - `ALLOWED_ORIGINS` - comma-separated list of allowed origins (e.g. `https://spiceandsail.com,https://preview-url`)
   - Which alert webhooks exist: `WHATSAPP_OPS_WEBHOOK_URL`, `OPS_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, `SLACK_WEBHOOK_URL` - owner to confirm which are configured in production
   - If any alert webhook is unconfigured, leads are still saved and retrievable through the staff endpoint

3. **Price rulings for services with no catalogue record** (7 services show "price on request"):
   - Swimming with horses: "Our team will confirm the price"
   - Quad/buggy: "Our team will confirm the price"
   - Uzi Island: "Our team will confirm the price"
   - Cheetah's Rock VIP: "Our team will confirm the price"
   - Private luxury catamaran: "Our team will confirm the price"
   - Stone Town + Spice Farm combo: "Our team will confirm the price"

4. **Tour operator licence number**: Owner to provide or remove the "Registered Zanzibar Tour Operator" claim. The registry-style claim text is now gone from all pages; if a licence number exists, add it to about.njk, otherwise leave the softened wording in place.

4b. **Turtle sanctuary & PADI scuba cards (experiences page)**: these two have no catalogue record and display "Price on request — our team will confirm". Add catalogue entries if the team decides on fixed planning ranges; owner must confirm the team will actually quote them rather than fall back to old card prices.

4c. **"Captains are certified" line (about.njk)**: not a banned phrase but an unverifiable claim; owner should either confirm certification documents exist or have the line softened.

4d. **Group-van and round-trip transfer rates (airport-to-nungwi page)**: catalogue only covers the 1–4-pax private minivan ($50–$60 planning range). The 5–8-pax van and the round-trip pass cards show "Our team will confirm the price". Owner to ratify fixed planning ranges or keep team-confirm wording.

5. **Verify $44 insurance and hotel-tax figures**: 
   - Hotel tax: $4-$5 per night - verify current amounts on the official portal
   - Travel insurance: $44 - confirm current rates

6. **PDPA 2022 adviser**: Owner to confirm data protection compliance adviser has been consulted

7. **Cancellation and refund terms**: Owner to provide documented cancellation and refund policy

8. **WhatsApp hours**: Mon-Sat 08:00-18:00 Africa/Dar_es_Salaam; after hours the bot says the team replies when the office opens

9. **The single command to deploy to production after review**: `npx netlify deploy --dir=dist` (manual CLI deploy, not automatic push)

10. **How to roll back**: Use `npx netlify rollback` or redeploy a previous deploy from the Netlify dashboard

11. **netlify dev needs a `[dev]` section** (local use only): `npx netlify dev` hung >3 min with no listener because the build command (`npm install && npm run build`) runs first and no `[dev]` block overrides it. Add e.g.
```toml
[dev]
  command = "npm run build"
  targetPort = 3000
  autoLaunch = false
```
Function-level flow was verified without netlify dev (see live-e2e.txt).

12. **Business hours are single-source in concierge-catalogue.json**: `config.replyWindow` ("within a few hours during business hours (Mon-Sat, 08:00-18:00 EAT)") and `config.businessHours` (days/hours used by `isWithinBusinessHours`). The widget success line shows `replyWindow` from GET /quote; the chat endpoint already uses it. Owner to ratify these hours and confirm the staffed WhatsApp window matches; any change is one config edit, no code deploy.