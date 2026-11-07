# Selected invoice printing 5.6.1

Add a checkbox to every order and an independent “طباعة الفواتير المحددة” action with the selected count, select-all and clear-selection controls. The selected orders render together through the existing A4 invoice template and one print call, in list order. Empty selections cannot print. Printing keeps the selection, so cancelling the system print dialog does not lose it.

The daily-print button keeps its existing implementation and today query. Individual invoice printing is unchanged. Refreshing the same list retains valid selections and uses refreshed order snapshots; switching filters clears selection with an explicit UI hint. Loading, failed refreshes and late responses cannot cause hidden or stale list selections to print. Selection stays in memory only and never writes to orders.

Validation: all 299 automated tests pass, including exact selected invoice output, a single print invocation, individual and daily printing, partial/select-all state, clearing, refresh, filter switching, request races and errors. Browser preview uses three synthetic orders with no customer information. This release changes only three static admin assets and does not change server modules, permissions or data.
