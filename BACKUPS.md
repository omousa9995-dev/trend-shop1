# النسخة 1.8.0 قبل إصلاح البحث والمشاركة — 26 أكتوبر 2026

- الفرع: [`backup/v1.8.0-before-search-share-2026-10-26`](https://github.com/omousa9995-dev/trend-shop1/tree/backup/v1.8.0-before-search-share-2026-10-26).
- Commit: `e24cfb8b7e60c1581976be3d68161358bad969d9`.
- Worker: `f4476924-ec88-4aaf-bd91-5508d5307034`.
- قاعدة البيانات والمخزون والطلبات والبريد لا تتغير في 1.8.1. لا تشغّل seed أو ترقية مخزون عند الرجوع.

# نسخ الرجوع المحفوظة

## الإصدار 5.4.0 — قبل تطوير اكتشاف المنتجات، 7 نوفمبر 2026

- الفرع: `backup/v5.4.0-before-glowy-2026-11-07`.
- المصدر: `dbe4f97501848f0703b51d83f85071f5db7c8bfe`.
- نسخة Worker: `c61c3d71-469c-4822-b0a3-9e87e6ecb0d7`، والنشر `9c018a7b-5c2c-4714-b08e-b8d8118db208`.
- أُرسلت للمالك قبل التعديل نسخة ZIP خاصة بالمصدر ولقطة البيانات ووسائط المتجر، مع فحص سلامة الأرشيف وقاعدة البيانات وبصمات 1,223 ملف وسائط.
- الرجوع إلى الواجهة يحافظ على قاعدة البيانات والمخزون والطلبات والتعديلات والوسائط الأحدث. لا تسترجع لقطة البيانات أو تشغّل seed لمجرد الرجوع إلى التصميم. تفاصيل النطاق في `docs/product-discovery-v55.md`.

## الإصدار 1.7.0 — قبل وضوح الصور والعروض والتوصيل الثابت

- الفرع: [`backup/v1.7.0-before-commerce-upgrade-2026-10-26`](https://github.com/omousa9995-dev/trend-shop1/tree/backup/v1.7.0-before-commerce-upgrade-2026-10-26).
- Commit: `fa800e40a0d65f487d1cab9f62862185b9c492ef`.
- Worker: `0289962c-bfeb-454c-a7fc-b7c0ff4ca3cc`.
- الأصول والصور القديمة محفوظة. لا تسترجع قاعدة البيانات أو كميات المخزون عند الرجوع إلى شكل قديم.
- بعد وجود طلبات كومبو، احتفظ بخادم وفواتير 1.8 لتفسير الخصم والتوصيل المحفوظين؛ يمكن إعادة أجزاء التصميم القديمة مع إبقاء الحساب الحالي. إعادة Worker 1.7 كاملًا تعيد سياسة توصيله ولا تطبق كومبوهات 1.8 على الطلبات الجديدة.

## الإصدار 1.6.1 — قبل عروض الإطلاق وتحسين السرعة

- التاريخ: 26 أكتوبر 2026.
- الفرع: [`backup/v1.6.1-before-launch-sale-2026-10-26`](https://github.com/omousa9995-dev/trend-shop1/tree/backup/v1.6.1-before-launch-sale-2026-10-26).
- Commit: `6c58ca5fb485f9bb2a9b4d49fe52ec6b8b0fb31d`.
- نسخة Worker: `45ca290a-5dc8-44db-be67-7e1eb63b9447`.
- الرجوع إلى الواجهة يحافظ على الطلبات والمخزون وأسرار البريد. لا تُرجع قاعدة البيانات أو المخزون إلى 24. تُدار أسعار العرض منفصلة؛ أساسها الفعلي محفوظ في `data/launch-sale-baseline.json`، ولا تُعاد أسعار الطلبات المحفوظة أو استحقاقات توصيلها عند تغيير التصميم.

## الإصدار 1.5.0 — قبل نافذة الترحيب وصور البوابات

- التاريخ: 26 أكتوبر 2026.
- الفرع: [`backup/v1.5.0-before-welcome-categories-2026-10-26`](https://github.com/omousa9995-dev/trend-shop1/tree/backup/v1.5.0-before-welcome-categories-2026-10-26).
- Commit: `0d2e66c256ef574a342638daee9ed12ec0ab669c`.
- نسخة Worker: `9d4a2103-e02f-46e2-9c34-a71cfb83a257`.
- الرجوع إلى هذه النسخة يعيد شكل 1.5.0، مع المحافظة على قاعدة البيانات والمخزون والطلبات الحالية وربط البريد والأسرار. لا تشغّل seed أو ترقية مخزون عند الرجوع إلى الواجهة.

# الإصدار 1.4.2 — قبل تحسين تجربة المتجر

- الإصدار المحفوظ: **1.4.2**، بتاريخ 25 أكتوبر 2026.
- النسخة في GitHub: [`backup/v1.4.2-before-store-refresh-2026-10-25`](https://github.com/omousa9995-dev/trend-shop1/tree/backup/v1.4.2-before-store-refresh-2026-10-25).
- Commit: `25cd9ab11c8f854c1b201cf180da5bfb308afb0c`.
- نسخة Worker المحفوظة: `9ec2f5c4-b0eb-4f6f-b938-612a6874d999`.
- قاعدة البيانات نفسها ووسائط KV لم تُستبدلا أثناء هذا التحديث.
- مرجع D1 وقت الحفظ: `0000001e-00000000-0000510f-64a33bc6350e852ad1605a36d9c5bc44`؛ هذا مرجع تاريخي محدود بفترة احتفاظ Cloudflare، وليس نسخة مستقلة دائمة.

للرجوع إلى شكل الموقع وسلوكه السابق، أعِد نشر Worker المحفوظ، أو ابنِ المصدر من فرع النسخة المحفوظة، مع الاحتفاظ بأسرار البريد والجلسة وبربط DB وMEDIA وSTORE_LIVE=true. يعكس رابط Pages المختصر النسخة المنشورة من Worker تلقائيًا.

**لا تسترجع قاعدة البيانات أو seed أو مخزون 24 عند الرجوع إلى التصميم.** تبقى الطلبات الحقيقية والمخزون الحالي كما هما. صور الإصدار القديم محفوظة في فرع GitHub وفي KV؛ الصور الجديدة تُضاف بأسماء مختلفة ولا تستبدلها.

## Before Korean care stories v4.0.0 — 2026-11-05

Source: `backup/v3.2.0-before-korean-stories-2026-11-05`, commit `e2f39e8ef20ee5b15e5dcfec89d9da5f862bcbc0`. Previous live Worker version: `6111a7d6-9eb5-427f-91c4-381e5ffdfac3`.
A full schema/data snapshot was privately retained before edits, with321product rows,13orders,71order-item snapshots and7,218stock units. No private customer or authentication data from that snapshot is committed here. Existing immutable image keys remain available. Consult the v4 release document before any content rollback; preserve later sales, owner edits and video uploads.

## Before shopping experience v4.1.0 — 2026-11-05

Source branch: `backup/v4.0.0-before-shopping-v41-2026-11-05`, commit `4f983568ef1e378866ae30cecefcf3093639a341`. Previous Worker: `56148ab5-fc19-4401-a734-b124b14477e3`. Customer copy is retained privately in an internal KV key; no customer or authentication records are in the source backup. The additive order-presentation column may remain during a UI rollback. Preserve all current orders, stock, later copy edits and owner video uploads.
