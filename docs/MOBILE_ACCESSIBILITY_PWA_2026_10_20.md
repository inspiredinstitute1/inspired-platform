# Mobile, accessibility and PWA checks — 20 October 2026

Private version 6 inspected in connected Chrome. Temporary viewport requests produced effective document widths of 315, 382, 457 and 562 CSS pixels (browser scaling differs from requested dimensions). Temporary override was reset. These are responsive desktop-browser observations, not a physical Android/iPhone test.

## Observed

- Timed mocks and analytics pages fit at the inspected narrow widths; Home, Notes and Free practice also fit at 315/382 pixels, with document scroll width equal to client width in the checked states.
- Main analytics controls, topbar buttons and bottom navigation had no measured target height under 44px at the narrowest checked width. This is a scoped check, not every control on every page.
- Profile inputs use 18px text and roughly 52–55px height at 382px.
- Navigation opens and Escape closes it. Theme switch operates using Space and exposes its checked state. No captured browser errors appeared.
- Account page exposes the installation card; no installation was triggered on the user's device.
- Manifest declares standalone display, root scope/start URL and PNG icons whose actual dimensions match 192x192/512x512 declarations.
- Service-worker tests passed public-asset caching, neutral offline navigation, old-cache cleanup, and exclusion of private pages, APIs and authentication routes. No offline exam autosave is claimed.

## Issue found and corrected in development

Shift+Tab from the closed menu button reached an off-screen Admin link (negative horizontal coordinates). Collapsed mobile navigation now uses inert and aria-hidden. Opening moves focus into navigation; Escape returns it to the menu button. Moving focus outside closes the drawer without stealing focus. Desktop breakpoint changes restore navigation accessibility. Three new tests exercise these behaviors.

348 tests, TypeScript checking and lint passed after this fix. Build/package result is reported separately. This fix requires a newly approved private deployment before its hosted behavior can be checked.

## Still unverified

Physical-device install and relaunch; offline/network-disconnection behavior on a device; screen-reader output; exhaustive contrast/accessibility compliance; populated exam/analytics states at mobile sizes; separate Student provider sign-in. Existing responsive checks should not be described as full accessibility certification or complete PWA validation.
