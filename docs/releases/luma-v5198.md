# Luma 5.19.8

Live verification of 5.19.7 completed a multi-step reply but exposed an empty-card false success: a product action whose IDs were rejected could still emit its claimed care plan and finish as if cards had been displayed. This release returns that empty selection to the model as bounded validation feedback with current affordable catalog IDs. No plan or product event is displayed until the server has at least one canonical product. Repair steps stay within the existing five rounds, two attempts per round and shared request deadline.

When a JSON action provides exact product IDs in selections but omits the parallel productIds list, the adapter preserves those IDs for normal server validation. It never invents IDs or bypasses stock, area, existing cart, ingredient or delivery/budget checks. Explicit productIds remain authoritative. The response contract now states that an empty selection is not a successful display.

Regression coverage includes selection-only actions and an invalid live selection corrected before any customer-visible plan/cards. The existing successful audio-file transcription/automatic submission test is retained. Cloud-browser microphone capture reported no available microphone; physical iPhone audio capture and acoustic output remain unverified.
