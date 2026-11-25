import express from 'express';
import {
  createGame,
  deleteGame,
  getGame,
  listGames,
  updateGame
} from '../controllers/games.js';
import { authenticate } from '../middlewares/authenticate.js';

const router = express.Router();

router.post('/', authenticate, createGame);
router.get('/', authenticate, listGames);
router.get('/:id', authenticate, getGame);
router.patch('/:id', authenticate, updateGame);
router.delete('/:id', authenticate, deleteGame);

export default router;
