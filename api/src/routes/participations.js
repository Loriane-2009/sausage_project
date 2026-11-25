import express from 'express';

import { joinGame, leaveGame } from '../controllers/participations.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = express.Router({ mergeParams: true });

router.post('/', authenticate, joinGame);
router.delete('/:userId', authenticate, leaveGame);

export default router;
