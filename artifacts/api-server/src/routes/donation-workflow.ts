import { randomInt, randomUUID } from "node:crypto";
import { getApp, getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type DocumentReference, type Transaction } from "firebase-admin/firestore";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const RECEIPT_PHOTO_MAX = 700_000;
const COLLECTION_CODE_ATTEMPTS = 10;
const DEFAULT_COLLECTION_HOURS = 24;
const DESTINATION_CATEGORIES = ["household", "family", "community-group", "shelter", "other"] as const;

interface AuthenticatedRequest extends Request {
  uid?: string;
}

interface Actor {
  uid: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isCentreReceiver: boolean;
  authorizedCentreIds: string[];
}

function validCollectionHours(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= 168;
}

function firebaseServices() {
  if (!process.env.FIREBASE_PROJECT_ID) throw new Error("FIREBASE_PROJECT_ID is required.");
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("Firebase Admin credentials are required.");
  }
  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
          ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
          : applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
  return { auth: getAuth(app), db: getFirestore(app) };
}

async function authenticate(req: AuthenticatedRequest, res: Response, next: () => void) {
  const match = req.header("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  try {
    const { auth } = firebaseServices();
    const token = await auth.verifyIdToken(match[1], true);
    req.uid = token.uid;
    next();
  } catch (error) {
    req.log?.warn({ err: error }, "Donation workflow authentication failed");
    res.status(401).json({ error: "Your sign-in session is invalid. Please sign in again." });
  }
}

async function actorFor(uid: string): Promise<Actor> {
  const { db, auth } = firebaseServices();
  const [profile, account] = await Promise.all([
    db.collection("users").doc(uid).get(),
    auth.getUser(uid),
  ]);
  if (!profile.exists || profile.data()?.emailVerified === false) {
    throw Object.assign(new Error("Verify your email address to use donations."), { status: 403 });
  }
  const data = profile.data() ?? {};
  return {
    uid,
    name: typeof data.name === "string" ? data.name : account.displayName ?? account.email ?? "HelpChain user",
    email: account.email ?? "",
    isAdmin: data.isAdmin === true,
    isCentreReceiver: data.isCentreReceiver === true,
    authorizedCentreIds: Array.isArray(data.authorizedCentreIds)
      ? data.authorizedCentreIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

function validQuantity(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 100_000;
}

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : value?.[0] ?? "";
}

function appendAudit(
  transaction: Transaction,
  ref: DocumentReference,
  entry: Record<string, unknown>,
) {
  transaction.create(ref.collection("auditTrail").doc(), {
    ...entry,
    createdAt: new Date().toISOString(),
    _serverTs: FieldValue.serverTimestamp(),
  });
}

function notify(
  batch: FirebaseFirestore.WriteBatch,
  input: { uid: string; title: string; body: string; actorUid: string; donationId?: string; requestId?: string },
) {
  const notification = firebaseServices().db.collection("notifications").doc();
  batch.create(notification, {
    title: input.title,
    body: input.body,
    type: input.requestId ? "donation_request" : "donation_registered",
    read: false,
    targetUserId: input.uid,
    createdByUid: input.actorUid,
    createdAt: new Date().toISOString(),
    ...(input.donationId ? { donationId: input.donationId } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    _serverTs: FieldValue.serverTimestamp(),
  });
}

function respondError(req: AuthenticatedRequest, res: Response, error: unknown, message: string) {
  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status)
    : 500;
  req.log?.error({ err: error }, message);
  res.status(Number.isInteger(status) && status >= 400 && status < 600 ? status : 500).json({
    error: status === 500 && !(error instanceof Error) ? message : error instanceof Error ? error.message : message,
  });
}

router.post("/donations", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.uid!;
    const actor = await actorFor(uid);
    const { itemType, itemIcon, quantity, description, destination, campaignId, campaignCreatorId } = req.body ?? {};
    if (typeof itemType !== "string" || !itemType.trim() || itemType.length > 100
      || typeof itemIcon !== "string" || !validQuantity(quantity)
      || (description !== undefined && (typeof description !== "string" || description.length > 500))
      || !destination || typeof destination.id !== "string" || typeof destination.name !== "string"
      || !destination.id || !destination.name) {
      res.status(400).json({ error: "Donation details are incomplete or invalid." });
      return;
    }
    if ((campaignId && typeof campaignCreatorId !== "string") || (!campaignId && campaignCreatorId)) {
      res.status(400).json({ error: "Campaign metadata is incomplete." });
      return;
    }
    const { db } = firebaseServices();
    const centre = await db.collection("communityCentres").doc(destination.id).get();
    if (!centre.exists || centre.data()?.name !== destination.name) {
      res.status(400).json({ error: "Choose a current HelpChain community centre." });
      return;
    }
    const counterRef = db.collection("counters").doc("donations");
    const donationRef = db.collection("donations").doc();
    const createdAt = new Date().toISOString();
    let donationId = "";
    await db.runTransaction(async (transaction) => {
      const counter = await transaction.get(counterRef);
      const next = Number(counter.data()?.nextId ?? 1);
      if (!Number.isSafeInteger(next) || next < 1) throw new Error("Donation ID counter is invalid.");
      donationId = `HC-${next.toString().padStart(6, "0")}`;
      transaction.set(counterRef, { nextId: next + 1 }, { merge: true });
      transaction.create(donationRef, {
        donationId,
        donorId: uid,
        donorName: actor.name,
        donorEmail: actor.email,
        itemType: itemType.trim(),
        itemIcon,
        quantity,
        description: description?.trim() ?? "",
        destination: { id: destination.id, name: destination.name, address: centre.data()?.address ?? "" },
        ...(typeof campaignId === "string" ? { campaignId, campaignCreatorId } : {}),
        status: "pending-delivery",
        statusHistory: [{ status: "pending-delivery", at: createdAt }],
        createdAt,
        _serverTs: FieldValue.serverTimestamp(),
      });
      appendAudit(transaction, donationRef, {
        actorId: uid,
        actorName: actor.name,
        action: "donation-created",
        donationId,
        previousStatus: null,
        newStatus: "pending-delivery",
        quantity,
      });
    });
    const batch = db.batch();
    for (const recipient of [
      { uid, title: "Donation registered", body: `${donationId}: ${quantity} ${itemType} item(s) are pending delivery to ${destination.name}.` },
      { uid: "admins", title: "New donation", body: `${donationId}: ${quantity} ${itemType} item(s) are pending delivery to ${destination.name}.` },
    ]) {
      notify(batch, { ...recipient, actorUid: uid, donationId });
    }
    await batch.commit();
    res.status(201).json({ id: donationRef.id, donationId, status: "pending-delivery", createdAt });
  } catch (error) {
    respondError(req, res, error, "Donation could not be registered.");
  }
});

router.post("/donations/:id/delivered", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const { db } = firebaseServices();
    const donationParam = routeParam(req, "id");
    const ref = db.collection("donations").doc(donationParam);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw Object.assign(new Error("Donation not found."), { status: 404 });
      const donation = snapshot.data()!;
      if (donation.donorId !== actor.uid) throw Object.assign(new Error("Only the donor can mark this delivery as handed over."), { status: 403 });
      if (donation.status !== "pending-delivery") throw Object.assign(new Error("This donation is not awaiting delivery."), { status: 409 });
      const at = new Date().toISOString();
      transaction.update(ref, {
        status: "delivered",
        deliveredAt: at,
        statusHistory: FieldValue.arrayUnion({ status: "delivered", at }),
        updatedAt: at,
      });
      appendAudit(transaction, ref, {
        actorId: actor.uid, actorName: actor.name, action: "donation-delivered",
        donationId: donation.donationId, previousStatus: "pending-delivery", newStatus: "delivered",
      });
    });
    res.json({ status: "delivered" });
  } catch (error) {
    respondError(req, res, error, "Donation delivery could not be recorded.");
  }
});

router.post("/donations/:id/receive", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const { quantityReceived, proofPhoto } = req.body ?? {};
    if ((!actor.isAdmin && !actor.isCentreReceiver) || !validQuantity(quantityReceived)
      || (proofPhoto !== undefined && (typeof proofPhoto !== "string" || proofPhoto.length > RECEIPT_PHOTO_MAX))) {
      res.status(403).json({ error: "Administrator or authorized centre receiver access and a valid received quantity are required." });
      return;
    }
    const { db } = firebaseServices();
    const donationParam = routeParam(req, "id");
    const matches = await db.collection("donations").where("donationId", "==", donationParam).limit(1).get();
    const ref = matches.empty ? db.collection("donations").doc(donationParam) : matches.docs[0].ref;
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw Object.assign(new Error("Donation not found."), { status: 404 });
      const donation = snapshot.data()!;
      const centreId = donation.destination?.id;
      if (!actor.isAdmin && !actor.authorizedCentreIds.includes(centreId)) {
        throw Object.assign(new Error("You are not authorized to receive donations at this centre."), { status: 403 });
      }
      if (actor.uid === donation.donorId) throw Object.assign(new Error("Donors cannot verify receipt of their own donations."), { status: 403 });
      if (!["delivered", "pending-delivery"].includes(donation.status)) throw Object.assign(new Error("This donation is not awaiting receipt."), { status: 409 });
      if (quantityReceived > donation.quantity) throw Object.assign(new Error("Received quantity cannot exceed the donated quantity."), { status: 400 });
      const at = new Date().toISOString();
      const previousStatus = donation.status;
      transaction.update(ref, {
        status: "received-verified",
        receivedAt: at,
        receivedCentreId: centreId,
        receivedCentreName: donation.destination.name,
        receivedById: actor.uid,
        receivedByName: actor.name,
        quantityReceived,
        ...(proofPhoto ? { proofPhoto } : {}),
        statusHistory: FieldValue.arrayUnion({ status: "received-verified", at }),
        updatedAt: at,
      });
      appendAudit(transaction, ref, {
        actorId: actor.uid, actorName: actor.name, action: "donation-received",
        donationId: donation.donationId, previousStatus, newStatus: "received-verified",
        centreId, centreName: donation.destination.name, quantityReceived, proofProvided: Boolean(proofPhoto),
      });
      const notificationRef = db.collection("notifications").doc();
      transaction.create(notificationRef, {
        title: "Donation received and verified",
        body: `${quantityReceived} ${donation.itemType} item(s) from donation ${donation.donationId} were verified at ${donation.destination.name}.`,
        type: "donation_received",
        read: false,
        targetUserId: donation.donorId,
        createdByUid: actor.uid,
        donationId: donation.donationId,
        createdAt: at,
        _serverTs: FieldValue.serverTimestamp(),
      });
    });
    res.json({ status: "received-verified" });
  } catch (error) {
    respondError(req, res, error, "Donation receipt could not be verified.");
  }
});

router.post("/donations/:id/distribute", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const { item, quantity, beneficiaryCategory, proofPhoto } = req.body ?? {};
    if (!actor.isAdmin || !validQuantity(quantity) || typeof item !== "string" || !item.trim()
      || !DESTINATION_CATEGORIES.includes(beneficiaryCategory)
      || typeof proofPhoto !== "string" || proofPhoto.length > RECEIPT_PHOTO_MAX) {
      res.status(403).json({ error: "Administrator access, an authorized beneficiary category, quantity, and distribution proof are required." });
      return;
    }
    const { db } = firebaseServices();
    const donationParam = routeParam(req, "id");
    const ref = db.collection("donations").doc(donationParam);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw Object.assign(new Error("Donation not found."), { status: 404 });
      const donation = snapshot.data()!;
      if (donation.status !== "received-verified" && donation.status !== "distributed") {
        throw Object.assign(new Error("Only physically received donations can be distributed."), { status: 409 });
      }
      if (actor.uid === donation.donorId || actor.uid === donation.receivedById) {
        throw Object.assign(new Error("The donor or receiving staff member cannot independently record this distribution."), { status: 403 });
      }
      const previouslyDistributed = Number(donation.directDistributedQuantity ?? donation.distributedQuantity ?? 0);
      const totalReceived = Number(donation.quantityReceived ?? 0);
      const inventoryListed = Number(donation.inventoryListedQuantity ?? 0);
      const quantityCollected = Number(donation.quantityCollected ?? 0);
      if (previouslyDistributed + quantity + inventoryListed > totalReceived) {
        throw Object.assign(new Error("Distribution quantity exceeds the verified received inventory."), { status: 400 });
      }
      const at = new Date().toISOString();
      const nextDistributed = previouslyDistributed + quantity;
      const nextStatus = nextDistributed + quantityCollected >= totalReceived ? "completed" : "distributed";
      transaction.update(ref, {
        status: nextStatus,
        directDistributedQuantity: nextDistributed,
        distributedQuantity: nextDistributed,
        lastDistribution: { item: item.trim(), quantity, at, beneficiaryCategory, proofPhoto, actorId: actor.uid, actorName: actor.name },
        distributionHistory: FieldValue.arrayUnion({
          item: item.trim(), quantity, at, beneficiaryCategory, proofPhoto, actorId: actor.uid, actorName: actor.name,
        }),
        statusHistory: FieldValue.arrayUnion({ status: nextStatus, at }),
        updatedAt: at,
      });
      appendAudit(transaction, ref, {
        actorId: actor.uid, actorName: actor.name, action: "donation-distributed",
        donationId: donation.donationId, previousStatus: donation.status, newStatus: nextStatus,
        item: item.trim(), quantity, beneficiaryCategory, proofProvided: true,
      });
    });
    res.json({ status: "distributed" });
  } catch (error) {
    respondError(req, res, error, "Donation distribution could not be recorded.");
  }
});

router.post("/donations/:id/investigate", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
    if (!actor.isAdmin || !reason) {
      res.status(403).json({ error: "Administrator access and an investigation reason are required." });
      return;
    }
    const { db } = firebaseServices();
    const donationParam = routeParam(req, "id");
    const ref = db.collection("donations").doc(donationParam);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw Object.assign(new Error("Donation not found."), { status: 404 });
      const donation = snapshot.data()!;
      const at = new Date().toISOString();
      transaction.update(ref, {
        status: "investigation",
        investigation: { reason, previousStatus: donation.status, openedAt: at, openedById: actor.uid, openedByName: actor.name },
        statusHistory: FieldValue.arrayUnion({ status: "investigation", at }),
      });
      appendAudit(transaction, ref, {
        actorId: actor.uid, actorName: actor.name, action: "donation-investigation-opened",
        donationId: donation.donationId, previousStatus: donation.status, newStatus: "investigation", reason,
      });
    });
    res.json({ status: "investigation" });
  } catch (error) {
    respondError(req, res, error, "Donation investigation could not be recorded.");
  }
});

router.post("/donations/:id/investigation/resolve", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const resolution = typeof req.body?.resolution === "string" ? req.body.resolution.trim().slice(0, 500) : "";
    if (!actor.isAdmin || !resolution) {
      res.status(403).json({ error: "Administrator access and an investigation resolution are required." });
      return;
    }
    const { db } = firebaseServices();
    const donationRef = db.collection("donations").doc(routeParam(req, "id"));
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(donationRef);
      if (!snapshot.exists) throw Object.assign(new Error("Donation not found."), { status: 404 });
      const donation = snapshot.data()!;
      if (donation.status !== "investigation") throw Object.assign(new Error("This donation is not under investigation."), { status: 409 });
      const previousStatus = donation.investigation?.previousStatus;
      if (!["pending-delivery", "delivered", "received-verified", "distributed", "completed"].includes(previousStatus)) {
        throw Object.assign(new Error("The prior donation status is unavailable; contact support before resolving."), { status: 409 });
      }
      const at = new Date().toISOString();
      transaction.update(donationRef, {
        status: previousStatus,
        investigation: FieldValue.delete(),
        statusHistory: FieldValue.arrayUnion({ status: previousStatus, at }),
        updatedAt: at,
      });
      appendAudit(transaction, donationRef, {
        actorId: actor.uid, actorName: actor.name, action: "donation-investigation-resolved",
        donationId: donation.donationId, previousStatus: "investigation", newStatus: previousStatus, resolution,
      });
    });
    res.json({ status: "resolved" });
  } catch (error) {
    respondError(req, res, error, "Donation investigation could not be resolved.");
  }
});

router.put("/receivers/:uid/centres/:centreId", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const userId = routeParam(req, "uid");
    const centreId = routeParam(req, "centreId");
    if (!actor.isAdmin || userId === actor.uid) {
      res.status(403).json({ error: "Only an administrator can authorize another user's centre receiver access." });
      return;
    }
    const { db } = firebaseServices();
    const centre = await db.collection("communityCentres").doc(centreId).get();
    const profileRef = db.collection("users").doc(userId);
    if (!centre.exists) {
      res.status(404).json({ error: "Community centre not found." });
      return;
    }
    const profile = await profileRef.get();
    if (!profile.exists) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const current = Array.isArray(profile.data()?.authorizedCentreIds)
      ? profile.data()!.authorizedCentreIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const enabled = req.body?.enabled === true;
    const centreIds = enabled
      ? [...new Set([...current, centreId])]
      : current.filter((id: string) => id !== centreId);
    await profileRef.update({
      isCentreReceiver: centreIds.length > 0,
      authorizedCentreIds: centreIds,
      receiverRoleUpdatedAt: new Date().toISOString(),
      receiverRoleUpdatedBy: actor.uid,
    });
    const auditRef = db.collection("users").doc(userId).collection("roleAudit").doc();
    await auditRef.create({
      actorId: actor.uid,
      actorName: actor.name,
      action: enabled ? "centre-receiver-authorized" : "centre-receiver-revoked",
      centreId,
      centreName: centre.data()?.name ?? "",
      createdAt: new Date().toISOString(),
      _serverTs: FieldValue.serverTimestamp(),
    });
    res.json({ isCentreReceiver: centreIds.length > 0, authorizedCentreIds: centreIds });
  } catch (error) {
    respondError(req, res, error, "Centre receiver role could not be updated.");
  }
});

router.post("/donation-inventory", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const { donationId, itemName, description, category, quantity, photo, collectionHours } = req.body ?? {};
    if (!actor.isAdmin || typeof donationId !== "string" || typeof itemName !== "string" || !itemName.trim()
      || itemName.length > 100 || typeof description !== "string"
      || typeof category !== "string" || !validQuantity(quantity)
      || (photo !== undefined && (typeof photo !== "string" || photo.length > RECEIPT_PHOTO_MAX))
      || (collectionHours !== undefined && !validCollectionHours(collectionHours))) {
      res.status(403).json({ error: "Administrator access and valid received item details are required." });
      return;
    }
    const { db } = firebaseServices();
    const inventoryRef = db.collection("donationInventory").doc();
    const donationRef = db.collection("donations").doc(donationId);
    const createdAt = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(donationRef);
      if (!snapshot.exists) throw Object.assign(new Error("Donation not found."), { status: 404 });
      const donation = snapshot.data()!;
      if (donation.status !== "received-verified" && donation.status !== "distributed") {
        throw Object.assign(new Error("Only physically received and verified items can be added to available inventory."), { status: 409 });
      }
      const total = Number(donation.quantityReceived ?? 0);
      const alreadyListed = Number(donation.inventoryListedQuantity ?? 0);
      const directDistributed = Number(donation.directDistributedQuantity ?? donation.distributedQuantity ?? 0);
      if (alreadyListed + directDistributed + quantity > total) throw Object.assign(new Error("Available quantity exceeds verified items not yet allocated."), { status: 400 });
      const hours = collectionHours ?? DEFAULT_COLLECTION_HOURS;
      transaction.create(inventoryRef, {
        donationRefId: donationRef.id,
        sourceDonationId: donation.donationId,
        itemName: itemName.trim(),
        description: description.trim().slice(0, 500),
        category: category.trim().slice(0, 100),
        quantityAvailable: quantity,
        quantityReserved: 0,
        quantityCollected: 0,
        photo: photo ?? "",
        centreId: donation.receivedCentreId,
        communityCentre: donation.receivedCentreName,
        collectionHours: hours,
        collectionDeadline: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
        addedById: actor.uid,
        addedByName: actor.name,
        createdAt,
        active: true,
        _serverTs: FieldValue.serverTimestamp(),
      });
      transaction.update(donationRef, { inventoryListedQuantity: alreadyListed + quantity });
      appendAudit(transaction, donationRef, {
        actorId: actor.uid, actorName: actor.name, action: "donation-listed-for-community",
        donationId: donation.donationId, previousStatus: donation.status, newStatus: donation.status,
        quantity, itemName: itemName.trim(), inventoryItemId: inventoryRef.id,
      });
    });
    res.status(201).json({ itemId: inventoryRef.id, createdAt });
  } catch (error) {
    respondError(req, res, error, "Available donation item could not be created.");
  }
});

router.post("/donation-requests", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const { itemId, quantity } = req.body ?? {};
    if (!validQuantity(quantity) || typeof itemId !== "string") {
      res.status(400).json({ error: "Choose an item and a valid quantity." });
      return;
    }
    const { db } = firebaseServices();
    const itemRef = db.collection("donationInventory").doc(itemId);
    const requestRef = db.collection("donationRequests").doc();
    const createdAt = new Date().toISOString();
    let requestId = "";
    await db.runTransaction(async (transaction) => {
      const itemSnapshot = await transaction.get(itemRef);
      if (!itemSnapshot.exists) throw Object.assign(new Error("This donated item is no longer available."), { status: 404 });
      const item = itemSnapshot.data()!;
      if (item.active !== true || Date.parse(item.collectionDeadline) <= Date.now()) {
        throw Object.assign(new Error("This item is no longer available for collection."), { status: 409 });
      }
      const donationRef = db.collection("donations").doc(item.donationRefId);
      const donationSnapshot = await transaction.get(donationRef);
      if (!donationSnapshot.exists || !["received-verified", "distributed"].includes(donationSnapshot.data()?.status)) {
        throw Object.assign(new Error("This donated item is currently unavailable."), { status: 409 });
      }
      if (quantity > Number(item.quantityAvailable ?? 0)) {
        throw Object.assign(new Error(`Only ${item.quantityAvailable ?? 0} item(s) are currently available.`), { status: 409 });
      }
      transaction.update(itemRef, {
        quantityAvailable: Number(item.quantityAvailable) - quantity,
        quantityReserved: Number(item.quantityReserved ?? 0) + quantity,
        updatedAt: createdAt,
      });
      requestId = `HC-R-${requestRef.id.toUpperCase()}`;
      transaction.create(requestRef, {
        requestId,
        userId: actor.uid,
        userName: actor.name,
        itemId,
        itemName: item.itemName,
        quantity,
        centreId: item.centreId,
        communityCentre: item.communityCentre,
        sourceDonationId: item.sourceDonationId,
        status: "pending",
        createdAt,
        approvalDeadline: item.collectionDeadline,
        reservationExpiresAt: null,
        _serverTs: FieldValue.serverTimestamp(),
      });
      appendAudit(transaction, requestRef, {
        actorId: actor.uid, actorName: actor.name, action: "item-requested",
        requestId, previousStatus: null, newStatus: "pending", quantity, itemId,
      });
    });
    const batch = db.batch();
    notify(batch, {
      uid: actor.uid, actorUid: actor.uid, requestId: requestRef.id,
      title: "Item request submitted", body: `Your request for ${quantity} item(s) is awaiting review.`,
    });
    notify(batch, {
      uid: "admins", actorUid: actor.uid, requestId: requestRef.id,
      title: "New available-item request", body: `${actor.name} requested ${quantity} item(s).`,
    });
    await batch.commit();
    res.status(201).json({ id: requestRef.id, requestId, status: "pending", createdAt });
  } catch (error) {
    respondError(req, res, error, "Item request could not be submitted.");
  }
});

router.post("/donation-requests/:id/decision", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const decision = req.body?.decision;
    const collectionHours = req.body?.collectionHours;
    const { db } = firebaseServices();
    if (!actor.isAdmin || !["approved", "rejected"].includes(decision)) {
      res.status(403).json({ error: "Administrator access and an approve or reject decision are required." });
      return;
    }
    if (decision === "approved" && !validCollectionHours(collectionHours)) {
      res.status(400).json({ error: "Set a collection deadline from 1 to 168 hours before approving this request." });
      return;
    }
    const requestRef = db.collection("donationRequests").doc(routeParam(req, "id"));
    const notificationBatch = db.batch();
    let reservationExpiresAt: string | undefined;
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists) throw Object.assign(new Error("Request not found."), { status: 404 });
      const request = snapshot.data()!;
      if (request.status !== "pending") throw Object.assign(new Error("This request has already been reviewed."), { status: 409 });
      if (decision === "approved" && request.userId === actor.uid) {
        throw Object.assign(new Error("Administrators cannot approve their own item requests."), { status: 403 });
      }
      const itemRef = db.collection("donationInventory").doc(request.itemId);
      const itemSnapshot = await transaction.get(itemRef);
      if (!itemSnapshot.exists) throw Object.assign(new Error("The source inventory item no longer exists."), { status: 409 });
      const item = itemSnapshot.data()!;
      const at = new Date().toISOString();
      const previousStatus = request.status;
      if (decision === "rejected") {
        const collectionDeadline = Date.parse(item.collectionDeadline) <= Date.now()
          ? new Date(Date.now() + Number(item.collectionHours ?? DEFAULT_COLLECTION_HOURS) * 60 * 60 * 1000).toISOString()
          : item.collectionDeadline;
        transaction.update(itemRef, {
          quantityAvailable: Number(item.quantityAvailable ?? 0) + request.quantity,
          quantityReserved: Math.max(0, Number(item.quantityReserved ?? 0) - request.quantity),
          collectionDeadline,
          active: true,
        });
        transaction.update(requestRef, {
          status: "rejected", reviewedAt: at, reviewedById: actor.uid, reviewedByName: actor.name,
          reservationExpiresAt: null,
        });
        transaction.delete(requestRef.collection("private").doc(request.userId));
      } else {
        if (!validCollectionHours(collectionHours)) {
          throw Object.assign(new Error("Set a collection deadline from 1 to 168 hours."), { status: 400 });
        }
        reservationExpiresAt = new Date(Date.now() + collectionHours * 60 * 60 * 1000).toISOString();
        if (Date.parse(item.collectionDeadline) <= Date.now()) {
          throw Object.assign(new Error("This item’s request-by deadline has passed."), { status: 409 });
        }
        const code = randomInt(0, 100_000_000).toString().padStart(8, "0");
        transaction.update(requestRef, {
          status: "approved",
          approvedAt: at,
          approvedById: actor.uid,
          approvedByName: actor.name,
          collectionHours,
          reservationExpiresAt,
        });
        transaction.create(requestRef.collection("private").doc(request.userId), {
          collectionCode: code,
          createdAt: at,
        });
      }
      appendAudit(transaction, requestRef, {
        actorId: actor.uid, actorName: actor.name,
        action: decision === "approved" ? "request-approved" : "request-rejected",
        requestId: request.requestId, previousStatus, newStatus: decision,
        quantity: request.quantity, itemId: request.itemId,
      });
      notify(notificationBatch, {
        uid: request.userId, actorUid: actor.uid, requestId: request.requestId,
        title: decision === "approved" ? "Item request approved" : "Item request declined",
        body: decision === "approved"
          ? `Your request for ${request.quantity} ${request.itemName} is approved. Collect it at ${request.communityCentre} before ${new Date(reservationExpiresAt!).toLocaleString()}.`
          : `Your request for ${request.quantity} ${request.itemName} was not approved.`,
      });
    });
    await notificationBatch.commit();
    res.json({ status: decision, ...(reservationExpiresAt ? { reservationExpiresAt } : {}) });
  } catch (error) {
    respondError(req, res, error, "Item request decision could not be saved.");
  }
});

router.get("/donation-requests/:id/code", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const { db } = firebaseServices();
    const requestRef = db.collection("donationRequests").doc(routeParam(req, "id"));
    const [request, privateCode] = await Promise.all([
      requestRef.get(),
      requestRef.collection("private").doc(actor.uid).get(),
    ]);
    if (!request.exists || request.data()?.userId !== actor.uid) {
      res.status(404).json({ error: "Approved request not found." });
      return;
    }
    if (request.data()?.status !== "approved") {
      res.status(409).json({ error: "A collection code is only available for an approved request." });
      return;
    }
    if (Date.parse(request.data()?.reservationExpiresAt) <= Date.now()) {
      res.status(410).json({ error: "This collection reservation has expired." });
      return;
    }
    const collectionCode = privateCode.data()?.collectionCode;
    if (typeof collectionCode !== "string") {
      res.status(404).json({ error: "Collection code is unavailable. Contact the community centre." });
      return;
    }
    res.json({ collectionCode });
  } catch (error) {
    respondError(req, res, error, "Collection code could not be loaded.");
  }
});

router.post("/donation-requests/:id/collect", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    const code = typeof req.body?.code === "string" ? req.body.code : "";
    if (!actor.isCentreReceiver || !/^\d{8}$/.test(code)) {
      res.status(403).json({ error: "An authorized centre receiver and a valid collection code are required." });
      return;
    }
    const { db } = firebaseServices();
    const requestId = routeParam(req, "id");
    const matchingRequests = await db.collection("donationRequests")
      .where("requestId", "==", requestId)
      .limit(1)
      .get();
    const requestRef = matchingRequests.empty
      ? db.collection("donationRequests").doc(requestId)
      : matchingRequests.docs[0].ref;
    const notificationBatch = db.batch();
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists) throw Object.assign(new Error("Request not found."), { status: 404 });
      const request = snapshot.data()!;
      if (!actor.authorizedCentreIds.includes(request.centreId)) throw Object.assign(new Error("You are not authorized to confirm collections at this centre."), { status: 403 });
      if (request.userId === actor.uid) throw Object.assign(new Error("You cannot confirm collection of your own item request."), { status: 403 });
      if (request.status !== "approved") throw Object.assign(new Error("This request is not approved for collection."), { status: 409 });
      if (Date.parse(request.reservationExpiresAt) <= Date.now()) throw Object.assign(new Error("This collection reservation has expired."), { status: 410 });
      const privateCode = await transaction.get(requestRef.collection("private").doc(request.userId));
      if (privateCode.data()?.collectionCode !== code) throw Object.assign(new Error("The collection code is incorrect."), { status: 400 });
      const itemRef = db.collection("donationInventory").doc(request.itemId);
      const itemSnapshot = await transaction.get(itemRef);
      if (!itemSnapshot.exists) throw Object.assign(new Error("The source inventory item no longer exists."), { status: 409 });
      const item = itemSnapshot.data()!;
      const donationRef = db.collection("donations").doc(item.donationRefId);
      const donationSnapshot = await transaction.get(donationRef);
      if (!donationSnapshot.exists) throw Object.assign(new Error("The source donation record no longer exists."), { status: 409 });
      const donation = donationSnapshot.data()!;
      if (donation.status !== "received-verified" && donation.status !== "distributed") {
        throw Object.assign(new Error("The source donation is not cleared for collection."), { status: 409 });
      }
      if (Number(donation.quantityCollected ?? 0) + Number(donation.directDistributedQuantity ?? donation.distributedQuantity ?? 0) + request.quantity
        > Number(donation.quantityReceived ?? 0)) {
        throw Object.assign(new Error("Collection quantity exceeds the remaining verified donation."), { status: 409 });
      }
      const at = new Date().toISOString();
      const collectionId = `HC-C-${randomUUID().toUpperCase()}`;
      transaction.update(itemRef, {
        quantityReserved: Math.max(0, Number(item.quantityReserved ?? 0) - request.quantity),
        quantityCollected: Number(item.quantityCollected ?? 0) + request.quantity,
        updatedAt: at,
      });
      transaction.update(requestRef, {
        status: "collected", collectedAt: at, confirmedById: actor.uid, confirmedByName: actor.name, collectionId,
      });
      transaction.delete(requestRef.collection("private").doc(request.userId));
      const quantityCollected = Number(donation.quantityCollected ?? 0) + request.quantity;
      const directDistributed = Number(donation.directDistributedQuantity ?? donation.distributedQuantity ?? 0);
      const nextDonationStatus = quantityCollected + directDistributed >= Number(donation.quantityReceived ?? 0)
        ? "completed"
        : "distributed";
      transaction.update(donationRef, {
        quantityCollected,
        status: nextDonationStatus,
        statusHistory: FieldValue.arrayUnion({ status: nextDonationStatus, at }),
        updatedAt: at,
      });
      appendAudit(transaction, donationRef, {
        actorId: actor.uid, actorName: actor.name, action: "donated-item-collected",
        donationId: donation.donationId, previousStatus: donation.status, newStatus: nextDonationStatus,
        quantity: request.quantity, item: request.itemName, collectionId,
      });
      appendAudit(transaction, requestRef, {
        actorId: actor.uid, actorName: actor.name, action: "item-collected",
        requestId: request.requestId, previousStatus: "approved", newStatus: "collected",
        quantity: request.quantity, itemId: request.itemId, collectionId,
      });
      notify(notificationBatch, {
        uid: request.userId, actorUid: actor.uid, requestId: request.requestId,
        title: "Donation item collected",
        body: `Your ${request.quantity} ${request.itemName} item(s) have been successfully collected.`,
      });
    });
    await notificationBatch.commit();
    res.json({ status: "collected" });
  } catch (error) {
    respondError(req, res, error, "Collection could not be confirmed.");
  }
});

async function expireApprovedRequests() {
  const { db } = firebaseServices();
  const now = new Date().toISOString();
  const reminderThreshold = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const reminders = await db.collection("donationRequests")
    .where("status", "==", "approved")
    .where("reservationExpiresAt", ">", now)
    .where("reservationExpiresAt", "<=", reminderThreshold)
    .limit(200)
    .get();
  for (const snapshot of reminders.docs) {
    const notificationBatch = db.batch();
    const sent = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(snapshot.ref);
      const request = current.data();
      if (!current.exists || request?.status !== "approved" || request.expiryReminderSentAt
        || Date.parse(request.reservationExpiresAt) <= Date.now()
        || Date.parse(request.reservationExpiresAt) > Date.now() + 60 * 60 * 1000) return false;
      const at = new Date().toISOString();
      transaction.update(snapshot.ref, { expiryReminderSentAt: at });
      appendAudit(transaction, snapshot.ref, {
        actorId: "system:expiry", actorName: "HelpChain automatic reminder",
        action: "collection-deadline-reminder", requestId: request.requestId,
        previousStatus: "approved", newStatus: "approved", quantity: request.quantity,
      });
      notify(notificationBatch, {
        uid: request.userId, actorUid: "system:expiry", requestId: request.requestId,
        title: "Collection deadline approaching",
        body: `Please collect ${request.quantity} ${request.itemName} within the next hour.`,
      });
      return true;
    });
    if (sent) await notificationBatch.commit();
  }
  const expired = await db.collection("donationRequests")
    .where("status", "==", "approved")
    .where("reservationExpiresAt", "<=", now)
    .limit(200)
    .get();
  let count = 0;
  for (const snapshot of expired.docs) {
    const notificationBatch = db.batch();
    const changed = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(snapshot.ref);
      if (!current.exists || current.data()?.status !== "approved"
        || Date.parse(current.data()?.reservationExpiresAt) > Date.now()) return false;
      const request = current.data()!;
      const itemRef = db.collection("donationInventory").doc(request.itemId);
      const item = await transaction.get(itemRef);
      if (item.exists) {
        const itemData = item.data()!;
        const reopenDeadline = Date.parse(itemData.collectionDeadline) <= Date.now()
          ? new Date(Date.now() + Number(itemData.collectionHours ?? DEFAULT_COLLECTION_HOURS) * 60 * 60 * 1000).toISOString()
          : itemData.collectionDeadline;
        transaction.update(itemRef, {
          quantityAvailable: Number(itemData.quantityAvailable ?? 0) + request.quantity,
          quantityReserved: Math.max(0, Number(itemData.quantityReserved ?? 0) - request.quantity),
          collectionDeadline: reopenDeadline,
          active: true,
          updatedAt: now,
        });
      }
      transaction.update(snapshot.ref, { status: "expired", expiredAt: now });
      transaction.delete(snapshot.ref.collection("private").doc(request.userId));
      appendAudit(transaction, snapshot.ref, {
        actorId: "system:expiry", actorName: "HelpChain automatic expiry",
        action: "request-expired", requestId: request.requestId,
        previousStatus: "approved", newStatus: "expired", quantity: request.quantity, itemId: request.itemId,
      });
      notify(notificationBatch, {
        uid: request.userId, actorUid: "system:expiry", requestId: request.requestId,
        title: "Collection period expired",
        body: `Your reservation for ${request.quantity} ${request.itemName} expired. The item is available again.`,
      });
      return true;
    });
    if (changed) {
      await notificationBatch.commit();
      count++;
    }
  }
  const unreviewed = await db.collection("donationRequests")
    .where("status", "==", "pending")
    .where("approvalDeadline", "<=", now)
    .limit(200)
    .get();
  for (const snapshot of unreviewed.docs) {
    const notificationBatch = db.batch();
    const changed = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(snapshot.ref);
      if (!current.exists || current.data()?.status !== "pending"
        || Date.parse(current.data()?.approvalDeadline) > Date.now()) return false;
      const request = current.data()!;
      const itemRef = db.collection("donationInventory").doc(request.itemId);
      const item = await transaction.get(itemRef);
      if (item.exists) {
        const itemData = item.data()!;
        const reopenDeadline = Date.parse(itemData.collectionDeadline) <= Date.now()
          ? new Date(Date.now() + Number(itemData.collectionHours ?? DEFAULT_COLLECTION_HOURS) * 60 * 60 * 1000).toISOString()
          : itemData.collectionDeadline;
        transaction.update(itemRef, {
          quantityAvailable: Number(itemData.quantityAvailable ?? 0) + request.quantity,
          quantityReserved: Math.max(0, Number(itemData.quantityReserved ?? 0) - request.quantity),
          collectionDeadline: reopenDeadline,
          active: true,
          updatedAt: now,
        });
      }
      transaction.update(snapshot.ref, { status: "expired", expiredAt: now });
      appendAudit(transaction, snapshot.ref, {
        actorId: "system:expiry", actorName: "HelpChain automatic expiry",
        action: "unreviewed-request-expired", requestId: request.requestId,
        previousStatus: "pending", newStatus: "expired", quantity: request.quantity, itemId: request.itemId,
      });
      notify(notificationBatch, {
        uid: request.userId, actorUid: "system:expiry", requestId: request.requestId,
        title: "Item request expired",
        body: `Your request for ${request.quantity} ${request.itemName} expired before it could be reviewed. The item is available again.`,
      });
      return true;
    });
    if (changed) {
      await notificationBatch.commit();
      count++;
    }
  }
  return count;
}

router.get("/donation-requests/expire", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    if (!actor.isAdmin) {
      res.status(403).json({ error: "Administrator access is required." });
      return;
    }
    res.json({ expired: await expireApprovedRequests() });
  } catch (error) {
    respondError(req, res, error, "Expired collection requests could not be processed.");
  }
});

router.post("/donation-requests/expire", async (req, res) => {
  const secret = process.env.DONATION_EXPIRY_SECRET;
  if (!secret || req.header("authorization") !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Invalid expiration service credentials." });
    return;
  }
  try {
    res.json({ expired: await expireApprovedRequests() });
  } catch (error) {
    req.log?.error({ err: error }, "Donation request expiry sweep failed");
    res.status(503).json({ error: "Expired collection requests could not be processed." });
  }
});

router.get("/donation-requests", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const actor = await actorFor(req.uid!);
    if (!actor.isAdmin) {
      res.status(403).json({ error: "Administrator access is required." });
      return;
    }
    await expireApprovedRequests();
    const { db } = firebaseServices();
    const requests = await db.collection("donationRequests").orderBy("createdAt", "desc").limit(500).get();
    res.json({ requests: requests.docs.map((request) => ({ id: request.id, ...request.data() })) });
  } catch (error) {
    respondError(req, res, error, "Donation requests could not be loaded.");
  }
});

export default router;
