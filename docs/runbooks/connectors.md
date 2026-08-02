# Personal connector operations

## OAuth registration

Register separate web OAuth applications in Google Cloud and Microsoft Entra. Use the exact public
redirect URIs below, replacing the example origin with the deployed HTTPS origin:

```text
https://careertwin.example/api/connectors/oauth/google/callback
https://careertwin.example/api/connectors/oauth/microsoft/callback
```

Set the client identifiers and secrets only in the ignored deployment `.env` or an equivalent secret
store. Google consent needs Calendar event access and read-only Gmail only when those services are
selected. Microsoft consent needs `Calendars.ReadWrite` and `Mail.Read`, plus `offline_access` and
`User.Read`. Do not add mailbox write/send or directory-wide application permissions.

```dotenv
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
MICROSOFT_OAUTH_CLIENT_ID=
MICROSOFT_OAUTH_CLIENT_SECRET=
MICROSOFT_OAUTH_TENANT=common
CONNECTOR_SYNC_TIMEOUT_SECONDS=30
EMAIL_RETENTION_DAYS=365
```

Restart app and worker, sign in, open **Pipeline > Connections**, and confirm that only configured
providers are enabled. Complete consent with a synthetic operator account, synchronize a bounded
calendar window and email set, then verify disconnect and provider-side revocation.

## Extension

Download the authenticated ZIP from **Pipeline > Connections**, extract it, and load the directory
from `chrome://extensions` with Developer mode enabled. The packaged manifest admits only the public
CareerTwin origin and localhost. A self-hoster must review and add its own HTTPS origin before loading.

Issue a browser credential in the same panel, copy it once, and paste it into the extension. Verify
one explicit capture, pending-to-ready extraction, and immediate rejection after revocation. Never put
the credential into Git, a screenshot, an issue, or shared browser profile.

## Incident and rotation

- Lost device: revoke every browser credential issued for it.
- Suspected OAuth grant exposure: disconnect, revoke provider consent, rotate the OAuth client secret,
  and inspect redacted audit events.
- Connector encryption-key rotation: retain the old key until all ciphertext has been re-encrypted and
  a restore has succeeded. CareerTwin 0.2.0 has one active connector key and does not silently guess.
- Provider errors are sanitized. Reproduce with a synthetic account; do not attach upstream bodies
  that can contain mail, events, or tokens.
