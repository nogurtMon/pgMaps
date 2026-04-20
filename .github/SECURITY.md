# Security Policy

## Supported versions

Only the latest release on `main` is actively maintained.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, email **montierthn@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

You'll receive a response within 72 hours. If the issue is confirmed, a fix will be released as quickly as possible and you'll be credited in the release notes (unless you prefer to stay anonymous).

## Security model

- Database connection strings are AES-256-GCM encrypted at rest using `DSN_ENCRYPTION_KEY`
- The server resolves all PostGIS connections server-side — clients never receive raw DSNs
- Share links expose data from the server's PostGIS connection; use a read-only Postgres role for connections you don't fully control
- `APP_PASSWORD` protects the main app; share links at `/share/[id]` are intentionally public
