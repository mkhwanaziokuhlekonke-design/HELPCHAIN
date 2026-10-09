import { Router, type IRouter } from "express";
import healthRouter from "./health";
import emailVerificationRouter from "./email-verification";
import donationWorkflowRouter from "./donation-workflow";
import nearbyDonationDestinationsRouter from "./nearby-donation-destinations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(emailVerificationRouter);
router.use(donationWorkflowRouter);
router.use(nearbyDonationDestinationsRouter);

export default router;
