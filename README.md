
# Digital Banking - Core Backend

Backend system for a startup digital bank (NibssByPhoenix Assessment) built with Node.js.

### Features
- **Customer Onboarding:** BVN/NIN verification workflow
- **Account Management:** One account per customer, pre-funded with ₦15,000
- **Core Banking:**
    - Name Enquiry (verify recipient)
    - Funds Transfer (Intra-bank & Inter-bank)
    - Account Balance Check

### Tech Stack
- Node.js + Express / NestJS
- NibssByPhoenix API Integration
- [Your DB: e.g. PostgreSQL / MongoDB]


# Below are Full Details & Features
Deployable in Render deployment

Express/Mongoose backend integrated with the NIBSS by Phoenix simulation API.

## Features
- Customer registration using BVN or NIN (not real BVN/NIN), identity registration and validation against NIBSS.
- Customer login with a signed JWT.
- One account per customer, created only after verified onboarding; the NIBSS account creation response supplies the opening balance (expected ₦15,000).
- Account lookup, balance check, recipient name enquiry, transfer and TSQ status.
- Customer-scoped transaction history and status lookup.
- Centralized NIBSS client, token refresh before expiry, retry once on 401, request timeout, Helmet and JSON size limit.

## Setup locally
1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Create your `.env` and fill in the values.
4. Run `npm run dev` (or `npm start`).

## Environment variables
- `MONGO_URI`: MongoDB connection string.
- `JWT_SECRET`: long, random secret used to sign customer tokens.
- `JWT_EXPIRES_IN`: optional token lifetime, defaults to `1d`.
- `NIBSS_BASE_URL`: defaults to the documented NIBSS base URL.
- `NIBSS_API_KEY` and `NIBSS_API_SECRET`: fintech credentials received after NIBSS fintech onboarding.
- `PORT`: supplied by Render automatically; do not hardcode it in production.

## Render
Create a **Web Service** from the repository containing this project.
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Add all required environment variables in Render's Environment settings.
- Ensure your MongoDB deployment permits connections from Render (for Atlas, configure network access appropriately).
- Deploy and check `/health`.

## API usage
All customer-protected routes require `Authorization: Bearer <accessToken>`.

### Register and onboard a test customer
`POST /api/customers/register`
```json
{
  "firstName": "Test",
  "lastName": "Customer",
  "email": "test@example.com",
  "password": "a-long-test-password",
  "kycType": "bvn",
  "kycID": "use-an-assigned-test-BVN",
  "dob": "2000-01-01",
  "phone": "08000000000"
}
```
For NIN, use `"kycType":"nin"` and an assigned test NIN; phone is not needed. Use only test identifiers, as required by the assignment. Registration inserts and validates the KYC record at NIBSS before saving the local verified customer.

### Login
`POST /api/customers/login`
```json
{"email":"test@example.com","password":"a-long-test-password"}
```
Use returned `accessToken` as a Bearer token.

### Create account
`POST /api/account/create` with an empty JSON object. Account details and KYC are taken from the authenticated customer record; clients cannot substitute another person's KYC ID.

### Other protected routes
- `GET /api/account/me`
- `GET /api/account/balance`
- `GET /api/account/name-enquiry/:accountNumber`
- `POST /api/transfer` body: `{"to":"10-digit-account","amount":"500"}`
- `GET /api/transaction/:transactionId`
- `GET /api/transactions?page=1&limit=20`

## Important notes
- This is an educational integration against a simulated API, not a production banking platform. Do not use real BVN/NIN data.
- NIBSS's documented account balance is authoritative. The local `openingBalance` is retained for the account record, not used to calculate live balances.
- The documented transfer endpoint is interbank-capable; this backend submits intra-bank and inter-bank transfers through that endpoint.
- NIBSS documentation requires name enquiry and identity validation before transfer. This implementation performs name enquiry before transfer; onboarding validation is completed at registration. The documented API's validation behavior and any test data setup should be confirmed against the live sandbox.
- A database uniqueness constraint enforces one local account per customer. In a high-concurrency production system, add idempotency and a reconciliation workflow around remote account creation/transfer calls to handle network failures between NIBSS and MongoDB.
- Real banking deployment would require substantially more controls, audits, regulatory approvals, secrets management, encryption/tokenization of identity data, and operational monitoring.
