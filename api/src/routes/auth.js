import express from 'express';

import { createToken } from '../controllers/auth.js';

const router = express.Router();

router.post('/tokens', createToken);

export default router;
