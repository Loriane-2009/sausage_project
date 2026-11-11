import express from 'express';

const router = express.Router();

router.get('/', function (req, res) {
  res.send('Test changement de nom');
});

export default router;
