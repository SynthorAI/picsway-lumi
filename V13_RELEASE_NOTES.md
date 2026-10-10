# PicSway Lumi V13 UI / V11.6 Lambda release

## Frontend

- Chat typography is now dark and bold for readability.
- Removed most gradients, excessive rounded cards, decorative sparkle treatment, and the generic right-side marketing panel.
- Uses a restrained blue/white/ink system with consistent radii and spacing.
- Mobile UI uses `100dvh`, safe-area padding, 16px text inputs, and a sticky interaction panel.
- User and Lumi messages both use dark text; alignment and subtle background differences identify the speaker.
- Currency fields use text + decimal keyboard so users can enter `2200`, `2,200`, or `$2,200` naturally.
- State selection remains controlled by the backend; exact location follows as free text.
- Budget is direct customer input with a skip option; no budget suggestions are displayed.
- Counteroffer is direct customer input.
- Added request-in-flight guard to prevent double submissions.
- Added 30-second request timeout and safer handling of non-JSON/API failures.
- Added OTP format validation.
- Avoids duplicated prompt rendering when the API reply is identical to the current field prompt.
- Added safe sessionStorage wrappers.
- Added `npm run lint`, `npm run typecheck`, and `npm run check`.
- Developer footer links to `https://mahdi.inksway.com`.

## Lambda V11.6

Business logic is intentionally unchanged from V11.5. The update is presentation-only for email:

- OTP, customer quote, and studio quote email styling now matches the cleaner cool-blue UI.
- Removed gradient/shadow-heavy email styling.
- Darker typography and flatter quote panels.
- Developer link remains at the end of email templates.
- Existing quote ID, negotiation, service-area, OTP, save, and lifecycle rules remain intact.

## Validation performed

- Python Lambda source passes `python -m py_compile`.
- TS/TSX syntax transpilation passed.
- A strict local TypeScript contract check with module stubs passed for App.tsx/main.tsx.
- Backend/UI question IDs were reviewed against the V11.5 Lambda contract.
