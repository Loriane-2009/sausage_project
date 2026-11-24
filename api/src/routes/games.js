import express from "express";
import { createGame, getGame, updateGame } from "../controllers/games.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = express.Router();

router.post("/", authenticate, createGame);
router.get("/:id", authenticate, getGame);
router.patch("/:id", authenticate, updateGame);

export default router;
