import express from 'express';
import createError from 'http-errors';
import logger from 'morgan';
import mongoose from 'mongoose';



import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';

const app = express();

app.use(logger('dev'));
app.use(express.json());

app.use('/', indexRouter);
app.use('/api/users', usersRouter);

await mongoose.connect(
  process.env.DATABASE_URL ?? 'mongodb://127.0.0.1/your-app-name'
);

// Catch 404 and forward to the error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  // Valeur unique déjà prise (username ou email) → 409 Conflict
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'valeur';
    return res.status(409).send({ message: `${field} est déjà utilisé` });
  }

  // Données invalides selon le modèle → 422 Unprocessable Entity
  if (err.name === 'ValidationError') {
    return res.status(422).send({ message: err.message });
  }

  res.status(err.status ?? 500);
  res.send({ message: err.message });
});

export default app;
