import express from "express";

import { createGame } from "../controllers/games.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = express.Router();

router.post("/", authenticate, createGame);

export default router;
