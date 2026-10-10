# PicSway Lumi Frontend — Cool Blue UI

## What changed
- Airy cool-blue/white design using Manrope.
- Server-driven venue-state choices: NJ, NY, MI, or Outside service area.
- Exact venue/location is entered after state selection.
- Budget is an exact customer-entered amount; no suggested budget ranges are shown.
- Counteroffers are exact customer-entered amounts; Lumi never fabricates the customer's number.
- Mobile-first input controls and responsive chat layout.
- Developer footer links to https://mahdi.inksway.com.

## API
Defaults to:
`https://i0cae18igk.execute-api.us-east-2.amazonaws.com/chat`

Override with `VITE_LUMI_API_URL` if needed.

## Deploy
Push to `main`. The included GitHub Action builds, deploys to S3, and invalidates CloudFront using the existing `AWS_ROLE_ARN` OIDC secret.
