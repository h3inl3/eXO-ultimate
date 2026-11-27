# TODO

## API

- [ ] **Time out the Cognito userInfo call.** `cognitoProfile` in `apps/api/src/auth.ts` fetches `/oauth2/userInfo` on a user's first request with no timeout, so a slow Cognito holds the request until Lambda's 30 s limit. Add `signal: AbortSignal.timeout(5000)` to the `fetch`.
- [ ] **Move invite codes out of the URL.** `POST /v1/invites/:code/accept` (`apps/api/src/routes/players.ts`) puts the code in the path, and Fastify logs every URL to CloudWatch, so anyone with log access can claim unused codes for 14 days. Take `code` in the POST body instead. Do this before web and mobile start calling the route (Phase 1, PR 2).
