# PicSway Lumi Frontend V13

Production-oriented React/Vite frontend for the PicSway Lumi quote assistant.

## What changed in V13

- Dark, bold, high-contrast chat text.
- Cleaner cool-blue product UI with flat surfaces and fewer decorative effects.
- Simplified chat-first layout; removed the generic marketing side panel.
- Mobile-safe 100dvh layout and safe-area-aware sticky input panel.
- Venue flow remains state first, then exact venue/location.
- Budget remains exact customer input, not suggested ranges.
- Counteroffer remains exact customer input.
- Currency inputs accept formatted text such as `2,200` or `$2,200`.
- OTP gets client-side 6-digit validation.
- Prevents duplicate submissions while a request is in flight.
- Adds a 30-second API timeout and friendlier network/API errors.
- Avoids duplicating the same API prompt in both chat history and input area.
- Session storage access is fail-safe.
- Added `npm run lint` as the static TypeScript check, matching the project's dependency-light setup.
- Developer link: https://mahdi.inksway.com

## Commands

```bash
npm ci
npm run lint
npm run build
```

Or:

```bash
npm run check
```

## API

Default endpoint:

`https://i0cae18igk.execute-api.us-east-2.amazonaws.com/chat`

Override locally with:

```env
VITE_LUMI_API_URL=https://your-api.example.com/chat
```

## Deployment

Push to `main`. GitHub Actions runs static checks, builds the app, assumes the AWS role with OIDC, syncs `dist/` to `picsway-lumi-frontend`, and invalidates CloudFront distribution `EJ3E2NR0RPKBH`.
