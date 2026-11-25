import express from 'express';

import { joinGame } from '../controllers/participations.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = express.Router({ mergeParams: true });

router.post('/', authenticate, joinGame);

export default router;
