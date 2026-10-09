import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getApp, getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const OTP_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

interface EmailOtpChallenge {
  codeHash: string;
  sentAt: number;
  expiresAt: number;
  attempts: number;
}

interface AuthenticatedRequest extends Request {
  verifiedUser?: DecodedIdToken;
}

function getFirebaseServices() {
  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error("FIREBASE_PROJECT_ID is required for email verification.");
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("Firebase Admin credentials are required for email verification.");
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({
        credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
          ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
          : applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

  return {
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}

function otpSecret(): string {
  const secret = process.env.EMAIL_OTP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("EMAIL_OTP_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function hashOtp(uid: string, code: string): string {
  return createHmac("sha256", otpSecret()).update(`${uid}:${code}`).digest("hex");
}

function getMailer() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  const port = Number(process.env.SMTP_PORT ?? 587);

  if (!host || !user || !pass || !from || !Number.isInteger(port) || port < 1) {
    throw new Error("SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, and a valid SMTP_PORT are required.");
  }

  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    }),
  };
}

async function authenticateRequest(req: AuthenticatedRequest, res: Response, next: () => void) {
  const authorization = req.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Sign in to verify your email address." });
    return;
  }

  let auth: ReturnType<typeof getAuth>;
  try {
    ({ auth } = getFirebaseServices());
  } catch (error) {
    req.log?.error({ err: error }, "Email verification Firebase Admin is not configured");
    res.status(503).json({ error: "Email verification is not configured. Please contact HelpChain support." });
    return;
  }

  try {
    req.verifiedUser = await auth.verifyIdToken(match[1], true);
    next();
  } catch (error) {
    req.log?.warn({ err: error }, "Email verification authentication failed");
    res.status(401).json({ error: "Your sign-in session is invalid. Please sign in again." });
  }
}

async function sendOtp(req: AuthenticatedRequest, res: Response) {
  const token = req.verifiedUser;
  if (!token) {
    res.status(401).json({ error: "Sign in to verify your email address." });
    return;
  }

  let challengeRef: DocumentReference<EmailOtpChallenge>;
  let userRecord;
  try {
    const { auth, firestore } = getFirebaseServices();
    userRecord = await auth.getUser(token.uid);
    if (!userRecord.email) {
      res.status(400).json({ error: "Your account does not have an email address." });
      return;
    }
    const profileRef = firestore.collection("users").doc(token.uid);
    const profile = await profileRef.get();
    if (userRecord.emailVerified || profile.data()?.emailVerified === true) {
      res.status(409).json({ error: "This email address is already verified." });
      return;
    }
    const { from, transporter } = getMailer();
    challengeRef = firestore.collection("emailOtpChallenges").doc(token.uid) as DocumentReference<EmailOtpChallenge>;
    const now = Date.now();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const codeHash = hashOtp(token.uid, code);
    const expiresAt = now + OTP_LIFETIME_MS;

    const result = await firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(challengeRef);
      const challenge = existing.data();
      if (challenge && now - challenge.sentAt < RESEND_INTERVAL_MS) {
        return {
          sent: false,
          expiresAt: challenge.expiresAt,
          resendAt: challenge.sentAt + RESEND_INTERVAL_MS,
          retryAfterSeconds: Math.ceil((RESEND_INTERVAL_MS - (now - challenge.sentAt)) / 1000),
        };
      }
      transaction.set(challengeRef, { codeHash, sentAt: now, expiresAt, attempts: 0 });
      return { sent: true, expiresAt, resendAt: now + RESEND_INTERVAL_MS, retryAfterSeconds: 0 };
    });

    if (!result.sent) {
      res.status(429).json({
        error: "Please wait before requesting another code.",
        expiresAt: result.expiresAt,
        resendAt: result.resendAt,
        retryAfterSeconds: result.retryAfterSeconds,
      });
      return;
    }

    try {
      await transporter.sendMail({
        from,
        to: userRecord.email,
        subject: "Your HelpChain verification code",
        text: `Your HelpChain verification code is ${code}. It expires in 10 minutes. If you did not create this account, you can ignore this email.`,
        html: `<p>Your HelpChain verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not create this account, you can ignore this email.</p>`,
      });
    } catch (error) {
      await getFirebaseServices().firestore.runTransaction(async (transaction) => {
        const current = await transaction.get(challengeRef);
        if (current.data()?.codeHash === codeHash) transaction.delete(challengeRef);
      });
      throw error;
    }

    res.json({ expiresAt: result.expiresAt, resendAt: result.resendAt });
  } catch (error) {
    req.log?.error({ err: error }, "Could not send HelpChain email verification code");
    const message = error instanceof Error ? error.message : "Email verification service is unavailable.";
    const isConfigurationError = /required|must contain/i.test(message);
    res.status(isConfigurationError ? 503 : 502).json({
      error: isConfigurationError
        ? "Email verification is not configured. Please contact HelpChain support."
        : "We could not send your verification email. Please try again.",
    });
  }
}

async function verifyOtp(req: AuthenticatedRequest, res: Response) {
  const token = req.verifiedUser;
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!token) {
    res.status(401).json({ error: "Sign in to verify your email address." });
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Enter the 6-digit code from your email." });
    return;
  }

  try {
    const { auth, firestore } = getFirebaseServices();
    const account = await auth.getUser(token.uid);
    const userRef = firestore.collection("users").doc(token.uid);
    const profile = await userRef.get();
    if (account.emailVerified || profile.data()?.emailVerified === true) {
      if (!account.emailVerified) await auth.updateUser(token.uid, { emailVerified: true });
      res.json({ verified: true });
      return;
    }

    const challengeRef = firestore.collection("emailOtpChallenges").doc(token.uid) as DocumentReference<EmailOtpChallenge>;
    const now = Date.now();
    const submittedHash = hashOtp(token.uid, code);
    const result = await firestore.runTransaction(async (transaction) => {
      const challengeSnapshot = await transaction.get(challengeRef);
      const challenge = challengeSnapshot.data();
      if (!challenge) return "missing";
      if (challenge.expiresAt <= now) {
        transaction.delete(challengeRef);
        return "expired";
      }
      if (challenge.attempts >= MAX_ATTEMPTS) {
        transaction.delete(challengeRef);
        return "locked";
      }

      const savedHash = Buffer.from(challenge.codeHash, "hex");
      const providedHash = Buffer.from(submittedHash, "hex");
      if (savedHash.length !== providedHash.length || !timingSafeEqual(savedHash, providedHash)) {
        const attempts = challenge.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) transaction.delete(challengeRef);
        else transaction.update(challengeRef, { attempts });
        return attempts >= MAX_ATTEMPTS ? "locked" : "incorrect";
      }

      transaction.delete(challengeRef);
      transaction.set(userRef, {
        emailVerified: true,
        emailVerifiedAt: new Date(now).toISOString(),
      }, { merge: true });
      return "verified";
    });

    if (result !== "verified") {
      const message = result === "expired"
        ? "That code has expired. Request a new code to continue."
        : result === "locked"
          ? "Too many incorrect attempts. Request a new code to continue."
          : "That code is incorrect. Check the email and try again.";
      res.status(result === "missing" ? 410 : 400).json({ error: message });
      return;
    }

    await auth.updateUser(token.uid, { emailVerified: true });
    res.json({ verified: true });
  } catch (error) {
    req.log?.error({ err: error }, "Could not verify HelpChain email code");
    res.status(503).json({ error: "We could not verify your code right now. Please try again." });
  }
}

router.post("/auth/email-otp/send", authenticateRequest, (req, res) => {
  void sendOtp(req, res);
});
router.post("/auth/email-otp/verify", authenticateRequest, (req, res) => {
  void verifyOtp(req, res);
});

export default router;
