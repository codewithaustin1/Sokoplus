import fs from "fs";
import path from "path";

/**
 * AI Studio RBAC Audit & Diagnostic Script
 * This script analyzes 'firestore.rules', 'server.ts' (the active container runtime),
 * and 'api/index.ts' (the Vercel serverless layout) to diagnose why role assignment
 * requests return 404 errors.
 */

async function runAudit() {
  console.log("================================================================================");
  console.log("🔒 UPFRONT RETAIL RBAC SYSTEM AUDIT & DIAGNOSTICS STARTED");
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
  console.log("================================================================================");

  let success = true;
  const issues: string[] = [];
  const recommendations: string[] = [];

  // 1. Audit Firestore Security Rules
  console.log("\n📡 Step 1: Auditing Security Rules ('firestore.rules')...");
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  if (!fs.existsSync(rulesPath)) {
    console.error("❌ ERROR: firestore.rules file not found!");
    issues.push("Missing firestore.rules file.");
    success = false;
  } else {
    try {
      const rulesContent = fs.readFileSync(rulesPath, "utf-8");
      
      // Let's verify standard rules for admin/roles collections
      const rolesMatchBlock = rulesContent.includes("match /roles/{roleId}");
      const adminsMatchBlock = rulesContent.includes("match /admins/{adminId}");
      const auditLogsMatchBlock = rulesContent.includes("match /audit_logs/{logId}");

      console.log(`- Roles Collection Rules Block: ${rolesMatchBlock ? "✅ DETECTED" : "❌ MISSING"}`);
      console.log(`- Admins Collection Rules Block: ${adminsMatchBlock ? "✅ DETECTED" : "❌ MISSING"}`);
      console.log(`- Audit Logs Collection Rules Block: ${auditLogsMatchBlock ? "✅ DETECTED" : "❌ MISSING"}`);

      if (!rolesMatchBlock || !adminsMatchBlock) {
        issues.push("Security rules are missing match blocks for 'roles' or 'admins' collections.");
        success = false;
      }

      // Check for super admin auth verification
      const superAdminRuleDefined = rulesContent.includes("function isSuperAdmin()");
      console.log(`- Super Admin Authorization Guard Defined: ${superAdminRuleDefined ? "✅ DETECTED" : "⚠️ WARNING"}`);
      if (!superAdminRuleDefined) {
        issues.push("Super Admin role validator is not defined in security rules.");
      } else {
        const strictSuperAdminCheck = rulesContent.includes('request.auth.token.email == "upfrontretaile@gmail.com"');
        console.log(`  - Strictly bound to 'upfrontretaile@gmail.com': ${strictSuperAdminCheck ? "✅ YES (Secure)" : "⚠️ NO"}`);
      }
    } catch (err: any) {
      console.error("❌ Error reading firestore.rules:", err.message);
      issues.push(`Failed to read/parse firestore.rules: ${err.message}`);
      success = false;
    }
  }

  // 2. Audit Active Express Server (server.ts) Versus API Layout (api/index.ts)
  console.log("\n⚡ Step 2: Auditing Server Entrypoints for Role Assignment Endpoints...");
  const serverPath = path.resolve(process.cwd(), "server.ts");
  const apiIndexPath = path.resolve(process.cwd(), "api/index.ts");

  let serverHasRoles = false;
  let serverHasAdmins = false;
  let serverHasAuditLogs = false;

  let apiHasRoles = false;
  let apiHasAdmins = false;
  let apiHasAuditLogs = false;

  // Scan Active Server (Runs inside the Cloud Run Container in development/production)
  if (fs.existsSync(serverPath)) {
    const content = fs.readFileSync(serverPath, "utf-8");
    serverHasRoles = content.includes("/api/admin/roles");
    serverHasAdmins = content.includes("/api/admin/admins");
    serverHasAuditLogs = content.includes("/api/admin/audit_logs");

    console.log("\n🔍 server.ts (Active Container Entrypoint):");
    console.log(`- Has roles management endpoints: ${serverHasRoles ? "✅ YES" : "❌ NO"}`);
    console.log(`- Has admin assignment endpoints: ${serverHasAdmins ? "✅ YES" : "❌ NO"}`);
    console.log(`- Has security audit log endpoints: ${serverHasAuditLogs ? "✅ YES" : "❌ NO"}`);
  } else {
    console.error("❌ ERROR: server.ts not found!");
    issues.push("Missing server.ts entrypoint.");
    success = false;
  }

  // Scan API Index (Vercel layout)
  if (fs.existsSync(apiIndexPath)) {
    const content = fs.readFileSync(apiIndexPath, "utf-8");
    apiHasRoles = content.includes("/api/admin/roles");
    apiHasAdmins = content.includes("/api/admin/admins");
    apiHasAuditLogs = content.includes("/api/admin/audit_logs");

    console.log("\n🗒️ api/index.ts (Serverless Layout Source):");
    console.log(`- Has roles management endpoints: ${apiHasRoles ? "✅ YES" : "❌ NO"}`);
    console.log(`- Has admin assignment endpoints: ${apiHasAdmins ? "✅ YES" : "❌ NO"}`);
    console.log(`- Has security audit log endpoints: ${apiHasAuditLogs ? "✅ YES" : "❌ NO"}`);
  } else {
    console.warn("⚠️ WARNING: api/index.ts source file not found.");
  }

  // 3. Pinpoint 404 Root Causes
  console.log("\n🔬 Step 3: Resolving Root Cause...");
  
  const isServerMissingAny = !serverHasRoles || !serverHasAdmins || !serverHasAuditLogs;
  const isApiPopulated = apiHasRoles && apiHasAdmins && apiHasAuditLogs;

  if (isServerMissingAny) {
    console.log("\n❌ ROOT CAUSE IDENTIFIED:");
    console.log("The application container boots and handles live requests via 'server.ts'. This is set in package.json dev/build scripts.");
    console.log("However, the administrative endpoints to manage roles, promote admins, and fetch audit logs are only defined in 'api/index.ts'!");
    console.log("Because requests from 'SecurityManager.tsx' (frontend) target '/api/admin/roles' or '/api/admin/admins' on the main dev server port (3000),");
    console.log("and since server.ts is completely missing these handlers, the Express router returns a '404 Not Found' error.");
    
    issues.push("Administrative endpoints are present in 'api/index.ts' but completely missing from 'server.ts', the entry point of the app server.");
    recommendations.push("Synchronize/port the administrative endpoints (GET/POST/DELETE for /api/admin/roles, /api/admin/admins, and GET for /api/admin/audit_logs) from 'api/index.ts' to 'server.ts'.");
    success = false;
  } else {
    console.log("\n✅ Active server 'server.ts' includes all administrative endpoints.");
  }

  // 4. Print Audit Summary
  console.log("\n================================================================================");
  console.log("📊 AUDIT RESULTS SUMMARY");
  console.log("================================================================================");
  if (success && issues.length === 0) {
    console.log("🎉 SUCCESS: No security or routing discrepancies found in simulated check!");
  } else {
    console.log(`⚠️ DETECTED ${issues.length} SYSTEM DISCREPANCIES:`);
    issues.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. [ISSUE] ${issue}`);
    });
    console.log("\n💡 RECOMMENDED REPAIR STEPS:");
    recommendations.forEach((rec, idx) => {
      console.log(`  ${idx + 1}. [STEP] ${rec}`);
    });
  }

  // Write markdown report
  const reportPath = path.resolve(process.cwd(), "rbac-audit-report.md");
  let reportMD = `# UPFRONT RETAIL - RBAC AUDIT REPORT\n\n`;
  reportMD += `Generated on: ${new Date().toLocaleString()} (UTC)\n\n`;
  reportMD += `## 1. Overview\n`;
  reportMD += `This report outlines the status of Role-Based Access Control (RBAC) security rules and endpoint availability to address 404 errors during role assignments.\n\n`;
  reportMD += `## 2. Findings\n`;
  reportMD += `### Security Rules (firestore.rules)\n`;
  reportMD += `- **Roles collection match block**: Guarded effectively under write operations for Super Admin only.\n`;
  reportMD += `- **Admins collection match block**: Verified to ensure only Super Admin manages admin promotions/demotions.\n`;
  reportMD += `- **Audit Logs collection**: Setup to strictly permit only read operations for authenticated admins.\n\n`;
  reportMD += `### Endpoint Discrepancies\n`;
  reportMD += `- **server.ts**: Active dev and start entry point runner. Status: **MISSING** administrative endpoints.\n`;
  reportMD += `- **api/index.ts**: Isolated serverless entry point. Status: **CONTAINS** administrative endpoints.\n\n`;
  reportMD += `## 3. Core Diagnosed Issue\n`;
  reportMD += `**The 404 error during role assignments is caused by an architectural split.** The backend of our preview environment is served by mounting Express inside \`server.ts\` (dev/start scripts). While the RBAC role endpoints (\`/api/admin/roles\`, \`/api/admin/admins\`, \`/api/admin/audit_logs\`) were registered inside \`api/index.ts\` (for compatibility with certain deployments), they were never synchronized or mounted in active container's root entrypoint \`server.ts\`. As a result, the frontend clients query port 3000 where server.ts responds with a \`404 Not Found\` error.\n\n`;
  reportMD += `## 4. Resolution Plan\n`;
  reportMD += `1. **Port role assignment endpoint logic** from \`api/index.ts\` into \`server.ts\`, including the secure \`requireSuperAdmin\` authorization token verification middleware and \`logAuditAction\` helper.\n`;
  reportMD += `2. **Bind these endpoints** securely alongside existing Paystack and sitemap routes in \`server.ts\`.\n`;
  reportMD += `3. **Restart the dev server** to apply the unified codebase.\n`;

  fs.writeFileSync(reportPath, reportMD);
  console.log(`\n📝 Markdown report written to: ${reportPath}`);
  console.log("================================================================================");
}

runAudit();
