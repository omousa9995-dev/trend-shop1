# Unified bilingual customer confirmation

Prepared for the owner's request on 8 November 2026. Every customer email receives one message containing Arabic followed by English, regardless of the shopping language. Both the HTML message and its plain-text fallback use the same order reference. The HTML uses separate RTL/LTR sections, locally styled text without external assets, and escapes customer names. Manual CliQ guidance appears only for CliQ orders. Product lists, totals and the delivery address remain absent from the customer message. The separate owner notification remains unchanged.

The authenticated bridge health response now reports `orderIdFormat=short4-v1` and `confirmationFormat=bilingual-v2`. Ten email-bridge tests passed, including both languages, one customer send, the short reference, escaping, token protection and quota behavior. Tests used an in-memory MailApp stub and sent no email.

## Published and activated

Published on 8 November 2026 by updating version 2 of the existing Google Apps Script web-app deployment. The deployment URL, execute-as owner, access setting and Script Properties were retained. No credential value was read or saved in the repository. The saved editor source was compared with the tested source and matched exactly. The owner-only `checkMailBridge` completed successfully with `remainingRecipients=100`, `orderIdFormat=short4-v1` and `confirmationFormat=bilingual-v2`; it sends no email. Google then confirmed that the existing deployment was updated successfully to version 2.

The live store's `/api/mail-health` returned configured/reachable/canSend true after publication. `SHORT_ORDER_IDS=true` was activated through the existing Cloudflare Worker's settings at 16:36:59 UTC. Worker version `1111b562-d1a2-4ec8-9b47-af21ee1f5c1b` serves 100% under deployment `a5b386b6-c3ee-46b5-ae18-fe2d9631ceac`. All D1, media, live-store and four secret bindings were inherited. New orders use four-character references; historical IDs are unchanged. Eight order-management tests and ten mail tests passed. No production order or test email was created during activation.

Reference: https://developers.google.com/apps-script/reference/mail/mail-app#sendEmail(Object)
