# Unified bilingual customer confirmation

Prepared for the owner's request on 8 November 2026. Every customer email receives one message containing Arabic followed by English, regardless of the shopping language. Both the HTML message and its plain-text fallback use the same order reference. The HTML uses separate RTL/LTR sections, locally styled text without external assets, and escapes customer names. Manual CliQ guidance appears only for CliQ orders. Product lists, totals and the delivery address remain absent from the customer message. The separate owner notification remains unchanged.

The authenticated bridge health response now reports `orderIdFormat=short4-v1` and `confirmationFormat=bilingual-v2`. Ten email-bridge tests passed, including both languages, one customer send, the short reference, escaping, token protection and quota behavior. Tests used an in-memory MailApp stub and sent no email.

## Deployment pending

The owner explicitly approved Google-account authentication and this update. The signed-out account chooser identified `stpostpo470@gmail.com`. Google rejected the password supplied through the secure credential form. The account therefore still requires successful sign-in before the existing Apps Script project/deployment can be updated. Do not claim the new template is live or activate short order IDs yet.

After sign-in, update the existing project with `integrations/google-apps-script.gs`, retain Script Properties and existing permissions, deploy a new version of the existing web-app deployment, and run `checkMailBridge` (health only). Verify the published authenticated health response reports both format markers, then enable the existing Cloudflare Worker variable `SHORT_ORDER_IDS=true` while retaining all bindings and secrets. Current public links and business records remain unchanged.

Reference: https://developers.google.com/apps-script/reference/mail/mail-app#sendEmail(Object)
