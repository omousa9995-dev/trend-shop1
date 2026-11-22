// Product-shaped illustrations for compact category shortcuts.
const drawings={
 "mascara": "<rect x=\"15\" y=\"29\" width=\"12\" height=\"24\" rx=\"3\" fill=\"#bb7796\"/><path d=\"m34 30 6-20m-8 3 11 3m-12 1 11 3m-12 1 11 3m-12 1 11 3\"/><path d=\"M19 34v14\"/>",
 "foundation": "<rect x=\"18\" y=\"21\" width=\"26\" height=\"34\" rx=\"5\" fill=\"#dfb49b\"/><path d=\"M25 21V12h18v5H32v4\"/><path d=\"M24 33h14m-14 5h10\"/>",
 "concealer": "<rect x=\"14\" y=\"29\" width=\"12\" height=\"25\" rx=\"3\" fill=\"#d7ad94\"/><path d=\"m39 31 3-14m-7-5 10 2-2 7-10-2Z\"/><path d=\"m38 30-2 5\"/>",
 "powder": "<ellipse cx=\"32\" cy=\"17\" rx=\"20\" ry=\"11\" fill=\"#ead5df\"/><ellipse cx=\"32\" cy=\"43\" rx=\"21\" ry=\"13\" fill=\"#d6b393\"/><path d=\"M11 42v4c0 8 42 8 42 0v-4M16 38c9-5 23-5 32 0\"/>",
 "lips": "<path d=\"M24 32V17c0-6 15-13 15-6v21\" fill=\"#be6989\"/><rect x=\"21\" y=\"31\" width=\"21\" height=\"23\" rx=\"3\" fill=\"#d2b8c5\"/><path d=\"M24 38h15\"/>",
 "sunscreen": "<path d=\"m19 9 26 0-3 37H22Z\" fill=\"#f6e7b7\"/><rect x=\"23\" y=\"46\" width=\"18\" height=\"9\" rx=\"2\" fill=\"#b7c4a1\"/><circle cx=\"32\" cy=\"28\" r=\"6\"/><path d=\"M32 18v-3m0 23v3m-10-13h-3m23 0h3m-20-8-2-2m17 18 2 2m-2-18 2-2m-17 18-2 2\"/>",
 "cleanser": "<rect x=\"18\" y=\"22\" width=\"28\" height=\"33\" rx=\"5\" fill=\"#cbdccb\"/><path d=\"M27 22v-9h20v5H34v4\"/><path d=\"M32 31s-6 7-6 10a6 6 0 0 0 12 0c0-3-6-10-6-10Z\" fill=\"#f6fbf2\"/>",
 "toner": "<rect x=\"22\" y=\"8\" width=\"20\" height=\"11\" rx=\"2\" fill=\"#b9b39f\"/><rect x=\"18\" y=\"19\" width=\"28\" height=\"36\" rx=\"5\" fill=\"#dfd4be\"/><path d=\"M23 31h18m-18 5h18m-18 5h10\"/>",
 "serum": "<path d=\"M26 19V9a6 6 0 0 1 12 0v10\" fill=\"#c4b2b9\"/><path d=\"M23 19h18v8l6 5v20a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4V32l6-5Z\" fill=\"#ddbd9e\"/><path d=\"M24 37h16m-16 5h11\"/>",
 "hair-oil": "<rect x=\"20\" y=\"20\" width=\"24\" height=\"35\" rx=\"7\" fill=\"#dab477\"/><path d=\"M27 20V10h19v5H34v5\"/><path d=\"M27 29c-10 8 13 11 4 21m6-20c-6 7 8 12 3 19\"/>",
 "hair-removal": "<rect x=\"23\" y=\"25\" width=\"18\" height=\"30\" rx=\"7\" fill=\"#d5bdcc\"/><path d=\"M23 27V16l18-6v17\" fill=\"#ecdce4\"/><path d=\"m24 17 16-6m-13 26h10\"/>"
};
export function productTypeIcon(type){return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="#64515e" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${drawings[type]||drawings.toner}</svg>`;}
