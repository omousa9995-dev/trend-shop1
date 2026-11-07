# Customer reports — v5.7.0

The owner dashboard now includes **الزبائن وExcel** with a current invoice
preview, contact grouping, product/governorate summaries, XLSX download, customer
list CSV download and printing. Existing single, selected and daily invoice
printing remain independent.

## Data and refresh

- `GET /api/admin/customer-report` uses the existing signed owner session and
  `no-store` responses. It reads the complete history in 250-order pages; it does
  not inherit the invoice screen's 300-order display limit.
- A maximum order row ID stabilizes pagination against newly inserted orders.
  New orders appear in the next refresh. Each page reads invoice rows and their
  historical product snapshots in one SQL statement. No database migration or
  mutation is performed.
- Date filters use Amman days; status filters use the stored status. Preview
  refreshes every 45 seconds while the section and browser document are visible.
  Every export/print first reads a fresh snapshot. Failed refreshes never export
  a previously loaded report.
- A downloaded workbook is a snapshot, not a remotely linked Excel session.
  Downloading again includes newly recorded invoices without manual copying.
- Customer data is not written into public assets, source control, localStorage,
  analytics events or an external spreadsheet service. The template is data-free.

## Meaning and quality

The workbook contains summary, invoices, contacts, invoice lines and Meta sheets.
Money remains integer fils until export, then numeric JOD to three decimals;
shipping unknowns stay blank, not zero. Order amounts use invoice-level values
after discounts. Product prices/names are historical snapshots; product
classification uses the current catalog. Phone strings preserve the international
country code, including `+`, as text. Dates are numeric Excel dates in Amman time.

Contacts group by normalized phone, falling back to a valid email or a distinct
invoice key. This is contact grouping rather than a claim of unique people. Names
remain intact, with explicitly inferred first/family fields; missing family names
stay blank. Different names on one phone are flagged and omitted from Meta's name
fields. An email shared by different contact groups is flagged and omitted from
CSV to avoid ambiguous matching. Invalid phone originals remain available for
review. Unknown completed goods values stay empty in the CSV.

## Meta file

The separate UTF-8 CSV contains `email,phone,fn,ln,st,country,value`, using contacts
with a valid phone/email from invoices marked **تم** within the selected filters.
Phone is the full country-code number without punctuation. Value is the sum of
completed invoice goods after discounts, excluding shipping, in JOD. Jordan is
the shipping country, not an inferred nationality. Missing identifiers are not
invented. Detailed addresses, product lists and order dates remain in the XLSX,
not arbitrary upload columns. Users can review the exact CSV rows in the Meta
preview before downloading.

No Meta upload, audience creation, ad-spend change, automatic purchase event or
Conversions API integration occurs. Existing orders have no recorded marketing
consent; the report states that fact and does not retroactively assert consent
or change checkout/privacy wording. Audience upload does not promise improved
ad delivery or purchase-event attribution.

## Workbook implementation and validation

`scripts/build-customer-workbook.mjs` authors the workbook and synthetic template
with artifact-tool in the primary runtime. `extract-customer-template.py` extracts
only its styles/layout/package metadata into a data-free public template. The
browser fills that template with typed cells and cached summary/contact formulas,
then packages standard uncompressed OpenXML ZIP entries with CRC32. No external
workbook library, CDN or customer-data service runs in the browser.

Source values use inline strings in the browser export so formula-like input
cannot execute; numeric amounts and dates remain numeric. Both workbook paths
include table filters, frozen headers, RTL views, repeated print headings,
landscape A4 and bounded summary formulas. `finish-customer-workbook.py` adds print
metadata to the privately authored initial workbook without rewriting data.

Regression tests cover authentication, no-store responses, excluded private
fields, 607-order pagination with an intervening insert, Amman date boundaries,
status filters, exact monetary calculations, international/Arabic-digit phones,
shared identifiers, missing names/values, stale/aborted refreshes, HTML/formula
injection, CSV construction, workbook CRC/XML validation, typed cells, filters,
print metadata and report UI behavior. Browser QA uses synthetic records only.
