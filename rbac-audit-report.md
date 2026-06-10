# UPFRONT RETAIL - RBAC AUDIT REPORT

Generated on: 6/9/2026, 8:30:19 PM (UTC)

## 1. Overview
This report outlines the status of Role-Based Access Control (RBAC) security rules and endpoint availability to address 404 errors during role assignments.

## 2. Findings
### Security Rules (firestore.rules)
- **Roles collection match block**: Guarded effectively under write operations for Super Admin only.
- **Admins collection match block**: Verified to ensure only Super Admin manages admin promotions/demotions.
- **Audit Logs collection**: Setup to strictly permit only read operations for authenticated admins.

### Endpoint Discrepancies
- **server.ts**: Active dev and start entry point runner. Status: **MISSING** administrative endpoints.
- **api/index.ts**: Isolated serverless entry point. Status: **CONTAINS** administrative endpoints.

## 3. Core Diagnosed Issue
**The 404 error during role assignments is caused by an architectural split.** The backend of our preview environment is served by mounting Express inside `server.ts` (dev/start scripts). While the RBAC role endpoints (`/api/admin/roles`, `/api/admin/admins`, `/api/admin/audit_logs`) were registered inside `api/index.ts` (for compatibility with certain deployments), they were never synchronized or mounted in active container's root entrypoint `server.ts`. As a result, the frontend clients query port 3000 where server.ts responds with a `404 Not Found` error.

## 4. Resolution Plan
1. **Port role assignment endpoint logic** from `api/index.ts` into `server.ts`, including the secure `requireSuperAdmin` authorization token verification middleware and `logAuditAction` helper.
2. **Bind these endpoints** securely alongside existing Paystack and sitemap routes in `server.ts`.
3. **Restart the dev server** to apply the unified codebase.
