/**
 * SokoPlus Customer Relationship Management (CRM) Triggers
 * Google Cloud Functions for Firestore-driven Automated Messaging
 * 
 * This file implements two highly clean, production-grade automated email setups to
 * recover abandoned carts for users who leave items in their cart for more than 24 hours.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentUpdated, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

/**
 * Configure Nodemailer SMTP Transporter
 * Replace these values with your enterprise email credentials (e.g., SendGrid, Mailgun, or Gmail)
 * using Cloud Functions Environment Config or Secrets Manager in Google Cloud console.
 */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587", 10),
  secure: process.env.EMAIL_SECURE === "true", // true for port 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || "placeholder-crm@sokoplus.co.ke", // Secret or environment config
    pass: process.env.EMAIL_PASS || "placeholder-password",
  },
});

/**
 * APPROACH A: Hourly Chronometer Scheduled Function (Highly Sustainable & Cost-Effective)
 * --------------------------------------------------------------------------------------
 * Trigger: Runs every hour.
 * Action: Queries the `/carts` Firestore collection for carts that have been modified 
 *         more than 24 hours ago, are non-empty, and haven't received a recovery prompt yet.
 */
exports.sendAbandonedCartAlertsScheduled = onSchedule({
  schedule: "every 1 hours",
  timeZone: "Africa/Nairobi", // Standard time context for SokoPlus Kenya operation
  memory: "256MiB",
}, async (event) => {
  logger.info("[Scheduled CRM] Initiating scanning for abandoned shopping carts...");
  
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    // Query active carts with updates older than 24 hours, where email alerts haven't fired yet
    const cartsRef = db.collection("carts");
    const snapshot = await cartsRef
      .where("updatedAt", "<", twentyFourHoursAgo.toISOString())
      .where("isAbandonedEmailSent", "==", false)
      .get();
      
    if (snapshot.empty) {
      logger.info("[Scheduled CRM] No matching abandoned carts detected during this hour cycle.");
      return;
    }
    
    logger.info(`[Scheduled CRM] Detected ${snapshot.size} potentially abandoned carts to process.`);
    
    const emailPromises = [];
    
    for (const doc of snapshot.docs) {
      const cart = doc.data();
      const userId = doc.id;
      
      // Safety checks: Skip if cart has no items or user lacks email
      if (!cart.items || !Array.isArray(cart.items) || cart.items.length === 0) {
        continue;
      }
      
      const userEmail = cart.email || await fetchUserEmailFallback(userId);
      if (!userEmail) {
        logger.warn(`[Scheduled CRM] Skipping cart recovery for user ${userId} due to lack of a valid email address.`);
        continue;
      }
      
      // Dispatch email trigger
      emailPromises.push(sendRecoveryEmailAndMarkSent(userId, userEmail, cart));
    }
    
    await Promise.all(emailPromises);
    logger.info("[Scheduled CRM] Completed CRM dispatch actions for this interval cycle.");
    
  } catch (error) {
    logger.error("[Scheduled CRM Failure] Main trigger routine failed:", error);
  }
});

/**
 * APPROACH B: Reactive Firestore Event-Trigger Function
 * -----------------------------------------------------
 * Trigger: Runs on document changes in `/carts/{userId}`.
 * Action: Sets up task timers. Note that in a pure event trigger without Google Cloud Tasks queue registration,
 *         it is recommended to use the Scheduled Cron approach above because it natively supports cron polling.
 *         However, if you want reactive real-time status shifts, you can listen here:
 */
exports.onCartUpdatedReactiveTrigger = onDocumentUpdated({
  document: "carts/{userId}",
}, async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  
  if (!afterData) return;
  
  // If user clears their cart or leaves it empty, reset isAbandonedEmailSent flags
  if (!afterData.items || afterData.items.length === 0) {
    if (beforeData && beforeData.items && beforeData.items.length > 0) {
      logger.info(`[Reactive CRM] User ${event.params.userId} custom-emptied cart. Reset notification flags.`);
      await event.data.after.ref.update({
        isAbandonedEmailSent: false,
        updatedAt: new Date().toISOString()
      });
    }
    return;
  }
  
  // If new items were added, make sure to reset mail sent status so they can get recovered 24h later
  const itemsChanged = JSON.stringify(beforeData?.items) !== JSON.stringify(afterData.items);
  if (itemsChanged && afterData.isAbandonedEmailSent === true) {
    logger.info(`[Reactive CRM] User ${event.params.userId} modified items in cart. Resetting recovery cycle.`);
    await event.data.after.ref.update({
      isAbandonedEmailSent: false,
    });
  }
});

/**
 * Helper to fetch a registered email address from the /users collection if not immediately in the cart document
 */
async function fetchUserEmailFallback(userId) {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (userDoc.exists) {
      return userDoc.data().email || null;
    }
  } catch (err) {
    logger.warn(`Fallback email resolution failed for uid: ${userId}`, err);
  }
  return null;
}

/**
 * Dispatches a stylized HTML recovery email to the user and marks 'isAbandonedEmailSent' as true in Firestore
 */
async function sendRecoveryEmailAndMarkSent(userId, email, cart) {
  try {
    let itemsRowsHtml = "";
    let cartTotal = 0;
    
    cart.items.forEach((item) => {
      const lineCost = (item.price || 0) * (item.quantity || 1);
      cartTotal += lineCost;
      
      itemsRowsHtml += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #f1f1f1; text-align: left;">
            <div style="font-weight: bold; color: #1e293b; font-size: 14px;">${item.name}</div>
            ${item.customizations ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Material: ${item.customizations.material || "Standard"} • Color: ${item.customizations.colorName || "Standard"}</div>` : ""}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #f1f1f1; text-align: center; color: #475569; font-size: 14px;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #f1f1f1; text-align: right; color: #0f172a; font-weight: bold; font-size: 14px;">KES ${lineCost.toLocaleString()}</td>
        </tr>
      `;
    });

    const emailHtmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #334155; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; bg-color: #ffffff; background: #ffffff; border-radius: 20px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); overflow: hidden; border: 1px solid #f1f1f1;">
          
          <!-- Brand Header -->
          <div style="background-color: #0f172a; padding: 30px 40px; text-align: center;">
            <span style="font-size: 26px; font-weight: 900; color: #f97316; letter-spacing: -1px; text-transform: uppercase;">Soko<span style="color: #ffffff;">Plus</span></span>
            <div style="color: #94a3b8; font-size: 11px; font-weight: bold; letter-spacing: 2px; margin-top: 4px; text-transform: uppercase;">Authentic Kenyan Handcrafts</div>
          </div>
          
          <!-- Content Body -->
          <div style="padding: 40px;">
            <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Habari! 🌸 You left some beautiful creations behind.</h2>
            <p style="margin-top: 0; margin-bottom: 24px; color: #475569; font-size: 14px; leading-relaxed: true;">
              We noticed you leaves some handcrafted Kenyan treasures in your SokoPlus cart. Each of our products supports authentic local artisans and craftspeople. We have saved your spot & cart list so you can check out seamlessly with standard M-Pesa or secure payment methods!
            </p>
            
            <!-- Cart Items Summary Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #f8fafc;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="padding: 12px; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; text-align: left; border-bottom: 2px solid #e2e8f0;">Item</th>
                  <th style="padding: 12px; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; text-align: center; border-bottom: 2px solid #e2e8f0; width: 60px;">Qty</th>
                  <th style="padding: 12px; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; text-align: right; border-bottom: 2px solid #e2e8f0; width: 120px;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRowsHtml}
                <tr>
                  <td colspan="2" style="padding: 16px 12px; text-align: right; font-weight: bold; color: #475569; font-size: 14px;">Total Estimated:</td>
                  <td style="padding: 16px 12px; text-align: right; font-size: 16px; font-weight: 950; color: #ea580c;">KES ${cartTotal.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            
            <!-- Call-to-action Button -->
            <div style="text-align: center; margin-bottom: 30px; margin-top: 30px;">
              <a href="https://www.sokoplus.co.ke/cart" style="background-color: #ea580c; color: #ffffff; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase; display: inline-block; box-shadow: 0 4px 6px rgba(234, 88, 12, 0.15);">
                Return to My Cart
              </a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #f1f1f1; margin-bottom: 24px;" />
            
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0; leading-relaxed: true;">
              This is an automated system email notification from SokoPlus Kenya. You received this because you initiated checkout or added items to your cart while authenticated. If you do not wish to receive automated alerts, you can edit alert options in your Profile.
            </p>
          </div>
          
        </div>
      </div>
    `;

    // 1. Send simulated or actual email
    const mailOptions = {
      from: '"SokoPlus Kenya Recovery" <no-reply@sokoplus.co.ke>',
      to: email,
      subject: "🛒 SokoPlus: We saved your cart list for you!",
      html: emailHtmlBody,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`[Scheduled CRM Alerts] Dispatched mail recovery success to ${email}. ID: ${info.messageId}`);

    // 2. Mark isAbandonedEmailSent to true in Firestore matching user ID
    await db.collection("carts").doc(userId).update({
      isAbandonedEmailSent: true,
      updatedAt: new Date().toISOString()
    });
    
    logger.info(`[Scheduled CRM Alerts] Successfully marked database cart records as recovery alert dispatched for user id: ${userId}`);

  } catch (error) {
    logger.error(`[Scheduled CRM Alerts Error] Failed for user ID: ${userId} (${email})`, error);
  }
}

/**
 * APPROACH C: Database-Triggered Targeted Marketing Campaigns
 * ---------------------------------------------------------
 * Trigger: Runs on document creation in `/marketing_campaigns/{campaignId}`.
 * Action: Validates and queries target user lists using custom rules matching wishlist or cart statuses.
 *         Iterates over recipients and sends emails and/or schedules live in-app push notifications.
 */
exports.onMarketingCampaignCreated = onDocumentCreated({
  document: "marketing_campaigns/{campaignId}",
  memory: "256MiB",
}, async (event) => {
  const campaignData = event.data.data();
  if (!campaignData) return;

  // Only process if status is "pending"
  if (campaignData.status !== "pending") {
    logger.info(`[Marketing Campaign] Skipping campaign ${event.params.campaignId} with status ${campaignData.status}`);
    return;
  }

  const { title, message, targetCriteria, channel } = campaignData;
  const campaignId = event.params.campaignId;

  logger.info(`[Marketing Campaign] Starting campaign ${campaignId} validation and target selection...`);

  try {
    // 1. Mark campaign as "processing"
    await event.data.ref.update({
      status: "processing",
      startedAt: new Date().toISOString()
    });

    // 2. Resolve users to target
    let targetUsers = []; // Array of { uid: string, email: string, displayName: string }

    // Fetch all users
    const usersSnapshot = await db.collection("users").get();
    const allUsers = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      allUsers.push({
        uid: doc.id,
        email: data.email || null,
        displayName: data.displayName || "Valued Customer",
        wishlist: data.wishlist || []
      });
    });

    // Fetch all carts
    const cartsSnapshot = await db.collection("carts").get();
    const allCarts = [];
    cartsSnapshot.forEach(doc => {
      const data = doc.data();
      allCarts.push({
        userId: doc.id,
        email: data.email || null,
        items: data.items || []
      });
    });

    const criteriaType = targetCriteria?.type || "all";
    const targetProductId = targetCriteria?.productId;
    const targetCategory = targetCriteria?.category;

    if (criteriaType === "all") {
      targetUsers = allUsers.filter(u => u.email);
    } else if (criteriaType === "wishlist_nonempty") {
      targetUsers = allUsers.filter(u => u.email && u.wishlist && u.wishlist.length > 0);
    } else if (criteriaType === "wishlist_product") {
      targetUsers = allUsers.filter(u => u.email && u.wishlist && u.wishlist.includes(targetProductId));
    } else if (criteriaType === "wishlist_category") {
      // Find matching products in this category
      const productsSnap = await db.collection("products")
        .where("category", "==", targetCategory)
        .get();
      const productIdsInCategory = [];
      productsSnap.forEach(pDoc => {
        productIdsInCategory.push(pDoc.id);
      });

      targetUsers = allUsers.filter(u => 
        u.email && 
        u.wishlist && 
        u.wishlist.some(pId => productIdsInCategory.includes(pId))
      );
    } else if (criteriaType === "cart_nonempty") {
      const userIdsWithCartsSet = new Set(allCarts.filter(c => c.items.length > 0).map(c => c.userId));
      targetUsers = allUsers.filter(u => u.email && userIdsWithCartsSet.has(u.uid));
    } else if (criteriaType === "cart_product") {
      const userIdsWithCartProdSet = new Set(
        allCarts.filter(c => c.items.some(item => item.productId === targetProductId)).map(c => c.userId)
      );
      targetUsers = allUsers.filter(u => u.email && userIdsWithCartProdSet.has(u.uid));
    } else if (criteriaType === "cart_category") {
      // Find matching products in this category
      const productsSnap = await db.collection("products")
        .where("category", "==", targetCategory)
        .get();
      const productIdsInCategory = new Set();
      productsSnap.forEach(pDoc => {
        productIdsInCategory.add(pDoc.id);
      });

      const userIdsWithCartCatSet = new Set(
        allCarts.filter(c => c.items.some(item => productIdsInCategory.has(item.productId))).map(c => c.userId)
      );
      targetUsers = allUsers.filter(u => u.email && userIdsWithCartCatSet.has(u.uid));
    }

    logger.info(`[Marketing Campaign] Target list computed. Users matching criteria: ${targetUsers.length}`);

    // 3. Dispatch notifications / emails
    let sendCount = 0;
    const deliveryPromises = [];

    for (const targetUser of targetUsers) {
      // Send standard email
      if (channel === "email" || channel === "both") {
        const mailPromise = sendCampaignEmail(targetUser.email, targetUser.displayName, title, message)
          .then(() => {
            sendCount++;
          })
          .catch(err => {
            logger.error(`[Campaign Email Fail] User: ${targetUser.email}`, err);
          });
        deliveryPromises.push(mailPromise);
      }

      // Create live database push notifications under subcollection
      if (channel === "push" || channel === "both") {
        const notifPromise = db.collection("users").doc(targetUser.uid).collection("notifications").add({
          title: title,
          body: message,
          read: false,
          createdAt: new Date().toISOString(),
          campaignId: campaignId,
          type: "marketing"
        }).then(() => {
          if (channel === "push") {
            sendCount++;
          }
        }).catch(err => {
          logger.error(`[Campaign Push Fail] User ID: ${targetUser.uid}`, err);
        });
        deliveryPromises.push(notifPromise);
      }
    }

    // Wait for all messages/writes
    await Promise.all(deliveryPromises);

    // 4. Update campaign status to completed
    await event.data.ref.update({
      status: "completed",
      sentCount: sendCount,
      completedAt: new Date().toISOString()
    });

    logger.info(`[Marketing Campaign] Campaign ${campaignId} completed successfully! Dispatched to ${sendCount} recipients.`);

  } catch (error) {
    logger.error(`[Marketing Campaign Fatal Error] Campaign ID ${campaignId} failed:`, error);
    await event.data.ref.update({
      status: "failed",
      error: error.message || String(error),
      completedAt: new Date().toISOString()
    });
  }
});

async function sendCampaignEmail(email, displayName, title, message) {
  const emailHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #334155; line-height: 1.6;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); overflow: hidden; border: 1px solid #f1f1f1;">
        
        <!-- Header -->
        <div style="background-color: #0f172a; padding: 30px 40px; text-align: center;">
          <span style="font-size: 26px; font-weight: 900; color: #f97316; letter-spacing: -1px; text-transform: uppercase;">Soko<span style="color: #ffffff;">Plus</span></span>
          <div style="color: #94a3b8; font-size: 11px; font-weight: bold; letter-spacing: 2px; margin-top: 4px; text-transform: uppercase;">Artisanal Excellence, Directly Curated</div>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px;">
          <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 16px;">Habari ${displayName}! 🌸</h2>
          <h3 style="font-size: 16px; font-weight: bold; color: #ea580c; margin-top: 0; margin-bottom: 20px;">${title}</h3>
          
          <div style="color: #475569; font-size: 14px; white-space: pre-line; margin-bottom: 30px;">
            ${message}
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="https://www.sokoplus.co.ke" style="background-color: #ea580c; color: #ffffff; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase; display: inline-block; box-shadow: 0 4px 6px rgba(234, 88, 12, 0.15);">
              Explore Sokoplus Marketplace
            </a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #f1f1f1; margin-bottom: 24px;" />
          
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">
            This email was sent to ${email} as part of a personalized SokoPlus Kenya update. If you no longer wish to receive these, please manage alert options inside your account.
          </p>
        </div>
      </div>
    </div>
  `;

  const mailOptions = {
    from: '"SokoPlus Premium Market" <no-reply@sokoplus.co.ke>',
    to: email,
    subject: `🌟 SokoPlus: ${title}`,
    text: message,
    html: emailHtml,
  };

  await transporter.sendMail(mailOptions);
}
