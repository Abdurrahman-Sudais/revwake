# Revwake corrected preview QA — 18 October 2026

## Result and scope

The standalone preview generator has been corrected. The complete verification command is `npm run verify`: production build, standalone preview generation and ten automated tests. All ten tests passed with no failures.

The website remains unpublished. Approved product copy, branding, founders and manufacturing review workflow were preserved. Browser visual QA is still pending.

## Reproduced failure and root cause

Before editing, the existing standalone HTML contained 24 occurrences of `<!doctype html>`. Extracting its first inline module and running Node's JavaScript syntax check produced `SyntaxError: Unexpected end of input`.

The unembedded preview bundle passed the syntax check and contained 23 literal dollar-backtick sequences (`$` followed by a backtick). The generator passed the bundle as a String.replace replacement string. Each of those sequences was interpreted as “insert the HTML before the match”, duplicating the document inside the script. Escaping closing-script sequences alone did not prevent that replacement-token expansion.

## Changes

- Added scripts/embedding.mjs with callback-based insertion. Literal replacement tokens are no longer interpreted when inserting JavaScript or CSS.
- Escaped case-insensitive closing-script sequences before placing the bundle in an HTML script element, preserving the JavaScript string value and original casing.
- Changed React prerender insertion and structured-data insertion to callbacks as a precaution against the same class of failure.
- Added regression tests for dollar-backtick, dollar-apostrophe, dollar-ampersand, double-dollar and mixed-case closing-script text.
- Added independent runtime checks for the final extracted standalone script and emitted production client, plus the one-command verification script.

## Production source assessed separately

Before correction, Home, Privacy, Terms, Brand and 404 production HTML each contained exactly one doctype. They referenced external module bundles rather than embedding the preview script.

After rebuilding, each production page still contains one document and one external module entry. Every emitted production JavaScript bundle passed Node's module syntax check. The home page client hydrated its prerendered content and passed the workflow checks below. Privacy, Terms, Brand and unknown-path 404 content also hydrated independently with no captured JavaScript errors.

Finding: the observed repeated-document corruption affected the standalone preview assembly. No corresponding corruption was found in the checked production output. The prerender callback change closes a latent risk; no existing production content was found to trigger it.

## Checks actually run

### Final standalone structure and syntax

- Raw text counts: one doctype, one opening html tag, one head tag and one body tag.
- Parsed document: one html, head and body; exactly one inline module.
- Extracted module: successful `node --check --input-type=module` syntax check.
- Adversarial embedding fixture retains every literal replacement token and closing-script string without inserting another document.

### Executing the final bundled outputs in jsdom

The actual JavaScript extracted from the standalone HTML was executed in a jsdom window. The emitted production client was separately executed against prerendered production pages. Neither test substituted the React source component for the delivered bundle.

Both the standalone home and production home passed:

- Mobile-menu open/close and Team navigation event handling.
- Correct full founder names and presence of the leadership section.
- Orders and Review Tasks navigation; search and no-results state.
- Record-type and acknowledgement-status filters.
- Old and new surface-finish excerpts.
- Record details and dependency path.
- Fictional owner assignment, local review note and acknowledgement.
- Export generation and inspection of the actual generated JSON payload.
- Export preserves the unknown mapping, unresolved reviews and implementation=false.
- Reset restores all six original records.

Standalone in-file navigation also passed Privacy, Terms, Brand, unknown-route 404, and return-home checks. All 14 brand download links resolve to embedded image data. Team navigation scrolled to the leadership target in the emulated environment.

The tests captured window errors, emulated-console JavaScript errors and rejection events; none were captured during these checks.

### Additional component/model and output checks

- Review decisions and local notes work; acknowledgements and decisions do not verify physical implementation.
- WO-218 and WO-221 require review. PO-731 and QC-07 have their specific reasons. WO-229 is unaffected by this mapped change. WO-235 remains unknown rather than unaffected.
- Contact copy-message, draft preparation, retained form entries and clipboard-failure fallback passed component tests.
- All prerendered pages contain expected origin/email metadata and review noindex instructions.
- Home HTML contains the product headline and both leadership names/titles.
- Every production /brand asset download refers to an existing nonempty file. PNG dimensions were checked for 16×16, 32×32, 180×180 and 1200×630 assets.
- ZIP integrity and required-source checks were run after packaging.

## Verification limits — do not treat as browser certification

No supported browser-control capability was available. “No captured runtime errors” refers to the jsdom executions, not Chrome, Safari or Firefox. The extracted import-free module and production client were evaluated as strict scripts inside the emulated window; actual browser module loading was not exercised.

Dialog methods, scrolling, object-URL/download capture and structuredClone were supplied by the test harness. Desktop/phone rendering, overflow, real focus trapping, screen readers, actual downloads, operating-system email launch/delivery and cross-browser behaviour were not verified. Responsive CSS and native dialog semantics are implemented, but this report does not claim visual browser checks passed.

Standalone routes are in-file React navigation. Production static route output and hydration were checked, but no server was launched: actual HTTP 404 status, host routing, headers, DNS and HTTPS were not tested.

No AWS, AI, extraction, authentication, ERP or form submission backend is deployed. These remain proposed production integrations. Review indexing stays disabled. See README.md for setup and essential configuration notes. This QA file is optional internal handover material; it is not copied into the public build.

## Final packaging check

Verified that optional internal QA and setup documents have no public links and are absent from the dist deployment output. QA lives only under internal/ in the source package. Redundant handover documentation was removed; setup and essential configuration notes are in README.md.
