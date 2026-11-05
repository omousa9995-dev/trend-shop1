# Korean care product stories — v4.0.0

Prepared 5 November 2026 for the existing Trend Shop deployment. Extends the Arencia layout to every one of the 105 products in the current Korean care collection. Other product-page layouts, prices, inventory, offers and historical orders are preserved.

## Product content and photographs

Each product has an individual Arabic/English introduction, three benefits, texture and suitability sections, three usage steps, ingredient/property notes, two product-specific questions and manufacturer references. Research covers 87 exact product matches, 12 family/regional/size matches and six legacy products with limited current primary information. The latter use conservative pack-supported copy rather than inferred formula percentages or unsupported results. Exact input identities match all 105 live database rows, including the sold-out legacy AXIS-Y entry TS0143.

Examples of deliberately preserved distinctions: retinal-liposome percentage is not pure retinal percentage; regional sunscreen versions are not interchangeable; Dr.Melaxin rice exfoliators rinse off; the 25,000 Medicube shot follows its specific weekly directions; scalp serum is not facial serum; TS0169's photographed pack is 50g despite an old catalog-name suffix. Original stock and manufacturer shade-code fields are retained.

The original packshot remains first. There are 104 newly generated, reference-based promotional scenes, plus previously reviewed scenes and one reoptimized reuse. The merged galleries select 113 scene variants across all 105 products. New delivered assets comprise 210 hashed WebP scene/thumbnail files. Images are explicitly promotional, without fabricated testimonials or before/after results. Every generated scene was visually inspected; exact reference paths, prompts, original output paths and content hashes are recorded in `data/korean-expansion/`.

The richer story document loads only on the selected product page (approximately 4–6KB per product), with a 4.5-second deadline and usable catalog-content fallback. Administrator replacement packshots discard old matched galleries. Explicitly clearing editable copy does not resurrect text from the static enrichment. Stock-aware quantity offers use the existing shared quote engine and retain the quick checkout's draft and duplicate-request protections.

## Owner-managed videos

No product video is seeded by this release. An empty video section stays absent. The administrator opens Products → Edit → Product videos, chooses a file from the device/photo library, optionally supplies Arabic/English captions, and presses Upload and show. Videos appear immediately after the usage steps. Upload progress, hide/restore and deletion are available. Saving an unsaved new product is required first.

The existing MEDIA storage is reused. MP4, QuickTime/MOV and WebM containers are supported, up to20MiB each and three saved videos per product. MP4 is recommended for wider browser compatibility; playback depends on its actual codec. Controls, inline mobile playback, manual loading and a direct-open fallback are provided; videos never autoplay. Public byte-range responses stream only the requested slice and cancel the remainder. HEAD ignores Range. Hidden videos/products and unapproved products are inaccessible publicly, with no public playback cache.

Upload and management require the existing signed administrator session and same-origin protection. Streamed-byte limits, container signatures, random storage paths and a database cap trigger are checked server-side. Changing products or closing the editor cancels pending work; list revisions prevent an older response from overwriting a completed upload. Video records are separate from price/stock editing.

## Validation and release safeguards

The full automated suite and isolated browser checks are recorded during publication. Meaningful coverage includes all105 pages in both languages, shared pricing, unchanged commerce fields and order snapshots, repeatable copy migrations, image identity changes, empty videos, authorization, oversized/disguised uploads, per-product caps, actual persisted attachment identity, stream ranges, hide/restore/delete and stale upload/list responses. The browser preview uses only public catalog copies, synthetic in-memory SQLite and temporary credentials; it has no production database or mail configuration. Phone QA uses a390px frame, not physical iPhone hardware.

Source recovery point: `backup/v3.2.0-before-korean-stories-2026-11-05`, commit `e2f39e8ef20ee5b15e5dcfec89d9da5f862bcbc0`. Previous production Worker: `6111a7d6-9eb5-427f-91c4-381e5ffdfac3`. A full pre-development database/schema snapshot is privately retained in existing MEDIA; public media routes reject its internal key. Existing images are not removed.

Migration0019 only adds the empty `product_videos` table/index/trigger. Migration0020 updates only the 105 named products' descriptions and selected bilingual copy fields, guarding the captured name and update timestamp. It preserves nested options and other metadata with JSON patch. Concurrently edited or sold rows are skipped for explicit review rather than overwritten; repeat execution does not reset content or sales. Rollback must preserve subsequent inventory, orders, admin edits and uploaded videos. Source rollback does not imply restoring an old database.

The previously prepared bilingual confirmation-email activation remains a separate pending Google Apps Script step; this release does not change its live bridge or credentials.
