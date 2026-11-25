import express from 'express';
import {
  createMap,
  deleteMap,
  getMap,
  listMaps,
  updateMap
} from '../controllers/maps.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requireAdmin } from '../middlewares/authorize.js';
import { validateObjectId } from '../middlewares/validateObjectId.js';

const router = express.Router();

// Vérifie le format de :id pour toutes les routes qui en ont un
router.param('id', validateObjectId);

router.post('/', authenticate, requireAdmin, createMap);
router.get('/', authenticate, listMaps);
router.get('/:id', authenticate, getMap);
router.patch('/:id', authenticate, requireAdmin, updateMap);
router.delete('/:id', authenticate, requireAdmin, deleteMap);

export default router;
