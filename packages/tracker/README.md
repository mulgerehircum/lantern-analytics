# @lantern/tracker

Phase 1: cookieless pageview beacon (hashed IPs for unique-visitor counting, DNT-respecting).
Phase 2: rrweb session capture with input masking on by default.

## Excluding your own visits

Run once in the browser you don't want counted (DevTools console or bookmarklet):

```js
localStorage.setItem("lantern_ignore", "1");
```

or from any page where the script has loaded:

```js
window.lantern.ignore();
```

The flag is read at script load, so it takes effect from the next page load; it never
gets written for visitors. Server-side IP/CIDR exclusion (`EXCLUDED_IPS` on the ingest
Lambda) is the complementary layer for non-browser traffic.
