# Invoice printing — v5.10.1

The previous action called window.print() with hidden invoices and no visible fallback. A browser that ignored printing appeared unresponsive; the precise cause on the owner’s device was not established.

Invoice actions now open a visible, mobile-friendly preview. Images and fonts settle before enabling a fresh explicit “Print / save PDF” click. The preview remains available when native printing is ignored or blocked. Today’s invoice loading reports failures and prevents duplicate requests. Selection and invoice totals are preserved.

Validation: all 354 tests passed, including selected, individual and today invoices, load failures, duplicate clicks, delayed images/fonts, ignored/throwing print, and returning to orders. Browser Rendering produced two separate A4 pages (595×842 points), one synthetic invoice per page, with no preview toolbar. A 390×844 emulated mobile screenshot was reviewed. No physical iPhone or printer was available; real paper output is not claimed. Only synthetic invoices were rendered; no customer orders were created or changed.
