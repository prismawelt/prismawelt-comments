# Prismawelt comment actions

This fork keeps the giscus interface and adds a permission-aware ellipsis menu to comments and replies. Signed-in authors and maintainers can edit or delete where GitHub grants the corresponding permission. Deletion requires confirmation, and replies are preserved according to GitHub Discussions semantics. Failed requests leave the existing content in place.

The discussion repository remains `prismawelt/prismawelt.github.io`, category `Announcements`. Korean, English, and Japanese versions continue to share the Korean original path as their strict mapping key. Existing comments remain in the same discussions.

## Validation

```sh
yarn install --frozen-lockfile
yarn test:moderation
yarn build
```

## Deployment

Deploy this repository as a Next.js project on Vercel using Node.js 22. The build succeeds without runtime credentials; commenting requires the GitHub App below.

Register a dedicated GitHub App with Discussions read/write permission and install it only on `prismawelt/prismawelt.github.io`. Set its OAuth callback to `https://SERVICE_HOST/api/oauth/authorized`. Follow the upstream [self-hosting guide](SELF-HOSTING.md); user-token expiration must remain disabled for this version of giscus.

Set these encrypted runtime environment variables in Vercel, never in Git:

- `GITHUB_APP_ID`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_PRIVATE_KEY`
- `ENCRYPTION_PASSWORD` (a fresh random string of at least 64 characters)

Set `NEXT_PUBLIC_GISCUS_APP_HOST=https://SERVICE_HOST` and `ORIGINS=["https://SERVICE_HOST"]`. Supabase and Valkey configuration is optional.

After verifying the deployed widget, point the blog comment loader at `https://SERVICE_HOST`. Keep its current repository, category, strict mapping, language, theme, and reaction settings. The new App requires visitors to sign in again once.
