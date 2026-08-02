# ADR 0024: Consent-bound personal calendar, email, and browser connectors

## Status

Accepted for 0.2.0.

## Decision

Google and Microsoft integrations use OAuth 2.0 authorization code flow with PKCE, one-time hashed
state, explicit service selection, and the narrow delegated scopes needed for calendar events and
read-only mail. Refresh tokens are AES-256-GCM encrypted with workspace, provider, and purpose-bound
authenticated data. The browser and API never receive stored refresh tokens or OAuth client secrets.

Calendar synchronization is user-triggered and bidirectional for the selected time window.
CareerTwin event identifiers make retries update instead of duplicate. Email synchronization is
read-only, keyword-bounded, excerpt-only, capped per run, and subject-linked to a tenant-owned
application only when identifiable. It can create a private follow-up reminder but never send or
draft a reply automatically. Imported thread data expires according to `EMAIL_RETENTION_DAYS`.

The optional Chromium Manifest V3 extension has no background crawler. A user action extracts the
visible page and sends it to one HTTPS/localhost CareerTwin origin with a high-entropy, revocable
credential. The server stores only the credential digest and processes the capture through the same
private ingestion queue as uploaded job documents.

## Consequences

- An operator must register OAuth applications and set redirect URIs outside Git before the provider
  appears as available.
- Disconnecting removes CareerTwin's encrypted grant; users can also revoke consent at the provider.
- Browser credentials are displayed once and must be revoked after device loss.
- There is no mailbox write scope, automated outreach, auto-apply, or unrestricted browsing.

## Evidence

- [Google Calendar authorization scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Gmail thread API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get)
- [Microsoft Graph calendar overview](https://learn.microsoft.com/en-us/graph/api/resources/calendar-overview?view=graph-rest-1.0)
- [Chrome extension Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
