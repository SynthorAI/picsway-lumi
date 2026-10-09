# PicSway Lumi V11 UI Testing

This UI is driven by the Lambda `ui` object. Protected option questions do not send free-text answers; they send the exact server-owned `questionId` and option ID(s).

## Expected path
1. Start my quote
2. Full name
3. Email
4. Event type: Marriage / Birthday / Other Event
5. Marriage only: One Event / Multiple Events, then marriage event choices
6. Services
7. Second shooter
8. Date / venue / city-state / coverage for each event
9. Guest range
10. Budget range
11. Referral source
12. Quote actions / negotiation
13. Accept
14. SAVE THIS QUOTE
15. Email OTP
16. SELECTED / saved

## Tamper check
While an option question is active, the normal message composer is locked. The API also validates the option ID, so a modified browser payload should still be rejected by Lambda.

## API
`POST https://i0cae18igk.execute-api.us-east-2.amazonaws.com/chat`
