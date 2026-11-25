import mongoose from 'mongoose';
import { OBSTACLES_BY_DIFFICULTY } from '../constant.js';
import { validateObstacles } from '../lib/obstacles.js';

const { Schema } = mongoose;

// Un obstacle = une case de la grille (pas d'identifiant propre)
const obstacleSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  { _id: false }
);

const mapSchema = new Schema(
  {
    // Nom de la map : obligatoire
    name: {
      type: String,
      required: true,
      trim: true
    },
    // Difficulté : easy, medium ou hard
    difficulty: {
      type: String,
      required: true,
      enum: Object.keys(OBSTACLES_BY_DIFFICULTY)
    },
    // Obstacles : la validation détaillée est faite dans le hook ci-dessous
    obstacles: [obstacleSchema]
  },
  // Ajoute automatiquement createdAt et updatedAt
  { timestamps: true }
);

// Vérifie nombre, position et doublons des obstacles avant l'enregistrement.
// Le message précis de validateObstacles est conservé dans l'erreur.
mapSchema.pre('validate', function () {
  try {
    validateObstacles(this.obstacles, this.difficulty);
  } catch (err) {
    this.invalidate('obstacles', err.message);
  }
});

// On renomme _id en id dans le JSON renvoyé par l'API
mapSchema.set('toJSON', {
  transform(doc, json) {
    json.id = json._id;
    delete json._id;
    delete json.__v;
    return json;
  }
});

export default mongoose.model('GameMap', mapSchema);
