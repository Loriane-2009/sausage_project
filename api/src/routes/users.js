import express from 'express';

import {
  createUser,
  deleteUser,
  getUser,
  updateUser
} from '../controllers/users.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requireSelfOrAdmin } from '../middlewares/authorize.js';
import { loadUserFromParams } from '../middlewares/load-user.js';

const router = express.Router();

// Inscription : publique
router.post('/', createUser);

// Profil : il faut être connecté
router.get('/:id', authenticate, loadUserFromParams, getUser);

router.patch(
  '/:id',
  authenticate,
  loadUserFromParams,
  requireSelfOrAdmin(),
  updateUser
);

router.delete(
  '/:id',
  authenticate,
  loadUserFromParams,
  requireSelfOrAdmin(),
  deleteUser
);

export default router;
