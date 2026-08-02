# CareerTwin Opportunity Capture

This unpacked Chrome/Chromium Manifest V3 extension sends the current page only after an
explicit button press. It does not crawl, auto-apply, monitor browsing, or keep a CareerTwin
password.

1. In CareerTwin, open **Pipeline > Connections** and issue a browser credential.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select this `extension/` directory, enter the deployed or local CareerTwin URL, and paste the
   credential exactly once.
4. Open a job page and press **Capture this job page**.

Revoke the credential from CareerTwin if the browser profile or device is lost. The production
and localhost origins are declared explicitly in `manifest.json`; self-hosters must add their own
HTTPS origin before loading the extension.
