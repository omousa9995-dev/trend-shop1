# Luma 5.19.7

An action turn now retains the model and API that completed its previous catalog step. If the first Interactions request failed and generateContent recovered, the remaining steps start on that working API instead of re-probing the failed endpoint each time. Every round still has at most two provider attempts and shares the existing 65-second overall deadline.

Provider events identify only the API, model, round, attempt and controlled result categories. The widget keeps at most twelve such records in an ephemeral DOM attribute, reset for each request. No customer text, images, audio or keys are included. This makes a live failure distinguishable from a long multi-step continuation without creating a public diagnostic endpoint or database of conversations.

The previous 5.19.6 deployment was confirmed active and passed 465 tests plus CI. A real uploaded synthetic audio file was transcribed, submitted automatically once, and answered about delivery; no second customer send was needed. The general multi-product routine still encountered upstream HTTP 503, so live product verification remains necessary for this release. Native physical iPhone capture and device speech have not been hardware-tested.

The new regression covers an unavailable Interactions request, a successful generateContent catalog lookup, and completion on the same working model/API, with exactly three calls and one reserved customer request. Store entry, bindings, data, secret handling, placement and recording behavior remain unchanged.
