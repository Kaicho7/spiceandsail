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

3. **Price rulings for services with no catalogue record** (6 services show "price on request"):
   - Stone Town + Spice Farm combo: "Our team will confirm the price"
   - Swimming with horses: "Our team will confirm the price"
   - Quad/buggy: "Our team will confirm the price"
   - Uzi Island: "Our team will confirm the price"
   - Cheetah's Rock VIP: "Our team will confirm the price"
   - Private luxury catamaran: "Our team will confirm the price"

4. **Tour operator licence number**: Owner to provide or remove the "Registered Zanzibar Tour Operator" claim (see claims sweep phase)

5. **Verify $44 insurance and hotel-tax figures**: 
   - Hotel tax: $4-$5 per night - verify current amounts on the official portal
   - Travel insurance: $44 - confirm current rates

6. **PDPA 2022 adviser**: Owner to confirm data protection compliance adviser has been consulted

7. **Cancellation and refund terms**: Owner to provide documented cancellation and refund policy

8. **WhatsApp hours**: Mon-Sat 08:00-18:00 Africa/Dar_es_Salaam; after hours the bot says the team replies when the office opens

9. **The single command to deploy to production after review**: `npx netlify deploy --dir=dist` (manual CLI deploy, not automatic push)

10. **How to roll back**: Use `npx netlify rollback` or redeploy a previous deploy from the Netlify dashboard
