import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nearbyDonationDestinationsRouter from "./nearby-donation-destinations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nearbyDonationDestinationsRouter);

export default router;
