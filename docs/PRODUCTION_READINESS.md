# MKE Magic production readiness and launch guide

This guide prepares the existing app for `https://mkemagic.com`. It does not deploy the app, change hosted database data, or create accounts.

## Readiness status

- The Next.js App Router app uses Supabase's SSR cookie client with the project's publishable key. Server authorization verifies claims, and database policies/RPCs enforce membership and administrator permissions.
- Guests can view the dashboard, player and deck directories/profiles, all game history, analytics, the public Tracking shell, and the public commander lookup endpoints. Public records include member names and IDs, deck/commander names and IDs, public Moxfield URLs, game dates and outcomes, public notes/location, and sanitized guest seats labeled `Guest`.
- Auth UUIDs, membership mappings, audit records, raw historical game rows, original guest names, and private provenance are not in the public views. Guest seats have no player/deck identity in public results. The importer checks historical public notes for known guest names; new notes and locations are public, so never put private guest details there.
- Tracking requires a verified Auth session mapped to an approved member. The database controls game creation and restricts corrections/deletions to approved administrators. Profile/deck Moxfield updates are limited to the mapped owner or an administrator and only grant updates to the URL column. Submission IDs make retries idempotent.
- Public data uses short-lived tagged caches; write actions invalidate the affected tags. Authenticated membership checks and private account data are not placed in the public cache.
- No service-role key is used by the application. The direct database URL is used only by local scripts and must not be configured in Vercel.

The repository cannot determine hosted Auth toggles, SMTP settings, DNS state, Vercel account settings, or member email addresses. Complete the dashboard checks below before launch.

## Application and local checks

The project uses Next.js 16.4.6 and requires Node.js 20.9 or newer ([Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation)). Vercel currently offers Node 24.x, 22.x, and 20.x; choose **24.x** in Project Settings so production builds run on a supported current runtime ([Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)). The `node --experimental-strip-types` test command requires a current Node release (22.6+); Node 24 is suitable for both the app and repository test scripts.

The app reads these two variables at runtime/build time:

| Variable | Vercel scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Existing Supabase project URL. This is public configuration. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production | Existing Supabase publishable key. It is intentionally browser-visible; database RLS protects writes. |

Do **not** add `SUPABASE_DB_URL` to Vercel. It is a privileged direct Postgres connection used only by local historical-import/verification scripts. Do not add a service-role or secret API key to the app or Vercel. The ignored local `.env.local` file must remain untracked.

`next.config.ts` contains a LAN hostname only in Next's `allowedDevOrigins` option for local iPhone testing. Next documents this option as development-only; it does not configure production request origins. Production uses the attached HTTPS domain. The deployed app reads no historical CSV or other local-only data files; all runtime application data comes from safe Supabase projections. Historical CSV files remain local and ignored by Git.

## Invite and password flows

The app now provides:

- A password reset link from the Tracking sign-in form.
- A one-time email confirmation screen for invite and recovery links. The screen requires the user to continue before consuming the link, reducing accidental consumption by email link scanners.
- A password-setting page that handles both a new invitation and a password reset. The user must still be approved and mapped before recording games.
- A server callback for Supabase PKCE authorization codes, with a fixed internal destination and no user-controlled redirect parameter.

No user-facing sign-up flow exists. Keep Supabase self-sign-up disabled for this invite-only group.

## Supabase Auth settings to complete

In Supabase Dashboard for project `tuiripvkrvlfvkgunohu`:

1. **Authentication → URL Configuration**
   - Set Site URL to `https://mkemagic.com` (no trailing slash).
   - Add the exact production Redirect URLs `https://mkemagic.com/auth/confirm` and `https://mkemagic.com/auth/callback`.
   - For local testing, add `http://localhost:3000/auth/confirm` and `http://localhost:3000/auth/callback`.
   - Do not add a broad Vercel preview wildcard for production auth. If previews are needed, protect them and add a specific temporary preview URL only when appropriate. Supabase recommends exact production redirect paths; see [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

2. **Authentication → Sign In / Providers**
   - Keep Email enabled and email confirmation enabled.
   - Disable **Allow new users to sign up**. The five accounts should be invited by an administrator, not self-created from a public form.
   - Set the minimum password length to at least 8 characters.
   - Set the email OTP/link expiry to 3600 seconds or lower.

3. **Authentication → Emails → SMTP Settings**
   - Configure custom SMTP before sending invitations. Supabase's built-in sender is best-effort, limits delivery to project-team addresses, and currently has a 2-email-per-hour limit; it is not suitable for five group members. See [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
   - Use a transactional provider such as Resend, Postmark, or Amazon SES. Configure its SMTP host, port, username, password, sender name, and sender address in Supabase Auth settings only. Do not put SMTP credentials in Vercel.
   - A separate sender such as `no-reply@auth.mkemagic.com` is a clean choice. Verify the sender domain and publish the provider's SPF/DKIM records and a DMARC policy. Preserve any existing Porkbun MX/TXT records when adding website DNS records.
   - Disable click tracking/link rewriting for authentication messages if the provider offers it.

4. **Authentication → Email Templates**
   - In the **Invite user** template, link directly to the app's confirmation screen using the token hash:

     ```html
     <h2>You've been invited to MKE Magic</h2>
     <p>Accept your invitation to set up your playgroup account.</p>
     <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite">Accept invitation</a></p>
     ```

   - In the **Reset password** template, use the redirect passed by the app and append the recovery token:

     ```html
     <h2>Reset your MKE Magic password</h2>
     <p>Continue to choose a new password.</p>
     <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a></p>
     ```

   The reset form passes the exact `/auth/confirm` redirect path. The email URL carries the one-time token; the app strips it from the browser address bar before the user confirms. Supabase's custom token-hash template pattern is documented in its [email template guide](https://supabase.com/docs/guides/auth/auth-email-templates).

## Safely invite and map the five members

The database schema uses `private.user_memberships(auth_user_id, player_id, role, approval_status)`. `auth_user_id` is the primary key and `player_id` is unique, so an Auth account and a playgroup player cannot be mapped more than once. Only privileged database administration can write this private table; ordinary users cannot claim identities by choosing a display name.

For each member—Nelson (`nelson`), Manfred (`manfred`), Josh (`josh`), Sam (`sam`), and Keenan (`keenan`)—repeat this process:

1. Confirm the member's email address with them directly.
2. In **Authentication → Users**, choose **Add user → Send invitation**. Do not share an administrator password or create a public sign-up path.
3. Copy the invited user's Auth UUID from the Users list. Match it to the email you just invited; do not infer the player from the invitee's chosen display name.
4. In the Supabase SQL Editor for the same project, run the following once for that member. Replace the UUID placeholder and player key. The block refuses duplicate/conflicting mappings rather than overwriting them.

   ```sql
   begin;

   do $$
   declare
     invited_auth_id uuid := 'REPLACE_WITH_AUTH_USER_UUID'::uuid;
     member_key text := 'nelson'; -- nelson, manfred, josh, sam, or keenan
     member_player_id uuid;
   begin
     select id into member_player_id
     from public.players
     where historical_player_key = member_key;

     if member_player_id is null then
       raise exception 'No existing player matches the selected member key.';
     end if;

     if exists (
       select 1
       from private.user_memberships
       where auth_user_id = invited_auth_id or player_id = member_player_id
     ) then
       raise exception 'The Auth user or player is already mapped. Review the existing mapping; do not overwrite it.';
     end if;

     insert into private.user_memberships (auth_user_id, player_id, role, approval_status)
     values (invited_auth_id, member_player_id, 'member', 'approved');
   end
   $$;

   commit;
   ```

5. Verify that Auth UUID maps to the expected existing player and that role/status are `member`/`approved`. If the insert raises a duplicate/conflict error, stop and inspect the current membership row; do not use `ON CONFLICT DO UPDATE`.
6. Ask the member to open the invitation, confirm the link, set their own password, and sign in at Tracking. If they opened the invitation before the mapping was inserted, their account still has no game-writing permission; map it and have them reload or sign out/in.
7. If the email already has an Auth user, do not invite a duplicate. Verify the identity with the member, use the existing Auth UUID, and send a password reset if needed; then follow the same mapping checks.

After each member signs in, verify the Tracking page shows the matching player name and “Approved playgroup member.” They should be able to submit a game, but correction/deletion controls remain administrator-only. Verify Moxfield edits work for their own profile/decks and are rejected for other members' records. The app does not expose membership administration.

## GitHub and Vercel setup (no remote is currently configured)

The local repository is on `master`, has a clean base commit before these preparation changes, and has no Git remote. All app code and five SQL migrations are tracked. `.env.local`, private historical CSVs, `.next`, `node_modules`, `.vercel`, TypeScript build info, and common local secrets are ignored. There is no GitHub repository linked from this checkout.

After reviewing this change set and approving source upload:

1. In GitHub, create a **private** repository (for example `mke-magic`). Leave “Add a README,” `.gitignore`, and license unchecked so GitHub does not create a conflicting initial commit.
2. In this project folder, connect the repository and push the reviewed branch:

   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_NAME/mke-magic.git
   git push -u origin master
   ```

3. In Vercel, choose **Add New → Project**, import the private GitHub repository, keep the detected Next.js framework and project root, and use `npm run build` (the existing package build script). Set `master` as the Production Branch, matching this checkout's current branch. Vercel's [Git deployment flow](https://vercel.com/docs/git) imports a repository through **New Project**.
4. Select Node.js **24.x** in Project Settings → Build and Deployment.
5. Add only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the **Production** environment. Vercel applies environment variables on new deployments, not existing ones ([environment variable scopes](https://vercel.com/docs/environment-variables)). Keep preview deploys disabled or password-protected; if they need the production public variables to build, treat the preview as production-data-connected and test only with database permissions in mind.
6. Add `mkemagic.com` and `www.mkemagic.com` in Project Settings → Domains. Set `mkemagic.com` as primary and configure `www.mkemagic.com` as a redirect to it.
7. Wait for the first successful deployment before switching DNS. In Porkbun → Domain Management → `mkemagic.com` → DNS, enter the exact values Vercel displays. Vercel's current generic values are an apex A record `@ → 76.76.21.21` and a `www` CNAME to `cname.vercel-dns-0.com`; use project-specific dashboard values if they differ. Remove only conflicting web A/AAAA/CNAME records for `@` or `www`. Keep email MX/TXT records and any provider records intact.
8. Wait until Vercel reports the domain and certificate as valid. Confirm `https://www.mkemagic.com` redirects to `https://mkemagic.com` and both resolve over HTTPS. Vercel documents domain setup and the exact records in its [custom domain guide](https://vercel.com/docs/domains/set-up-custom-domain).

Vercel builds each production branch push. Do not push this repository or deploy until the owner approves those external changes.

## Post-deployment checklist

- Open the dashboard, Players, Decks, Games, Analytics, Tracking, and Play pages in a signed-out private browser. Confirm public data loads, guest seats say `Guest`, and private account/guest-source values do not appear in page payloads.
- Use an approved member account to sign in, submit a temporary test game only when explicitly approved, and confirm the database/RLS rejects a signed-out or unmapped submission. Never test an admin deletion on a historical record.
- Confirm a member can save their own Moxfield links but cannot change another member's links or any player/deck identity fields.
- Confirm Will can correct/delete only with the administrator account and that corrections require a reason and produce private audit rows.
- On a 375–430px iPhone Safari viewport, verify the navigation, auth forms, dashboard charts, Games, Tracking, and Play. Verify invitation and recovery emails arrive, confirm links work once, password updates succeed, and expired/reused links show a recovery path.
- In Supabase, confirm game, member, and deck counts and migration history remain unchanged by the launch. Re-run historical/statistical checks after any approved new games using the established baseline plus new records.

## Known review boundaries

- Supabase hosted Auth toggles, SMTP credentials/templates, email delivery, Porkbun DNS, Vercel settings, and the members' email addresses are account-level settings and require owner action; they were not changed by this project work.
- Real invite/recovery email delivery cannot be fully exercised until custom SMTP is configured. No member accounts or hosted records were created for this preparation.
- `/play` is gated by a server-verified approved membership. Its life state is browser-local by design; this readiness review does not add cloud persistence.
