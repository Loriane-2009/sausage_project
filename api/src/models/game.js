import mongoose from "mongoose";

const { Schema } = mongoose;

// Participation d'un joueur à la partie (pas d'identifiant propre)
const participationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Score final : null tant que le joueur n'a pas fini
    score: { type: Number, min: 0, default: null },
    // Rang : null tant que la partie n'est pas terminée
    rank: { type: Number, min: 1, default: null },
  },
  { _id: false },
);

const gameSchema = new Schema(
  {
    // Map choisie pour la partie
    map: { type: Schema.Types.ObjectId, ref: "GameMap", required: true },
    // Hôte : le joueur qui a créé la partie
    host: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Statut : waiting au départ, puis playing, puis finished
    status: {
      type: String,
      enum: ["waiting", "playing", "finished"],
      default: "waiting",
    },
    // Code à envoyer aux amis pour rejoindre la partie
    invitationCode: {
      type: String,
      required: true,
      unique: true,
    },
    // Nombre maximum de joueurs : de 2 à 4
    maxPlayers: {
      type: Number,
      required: true,
      min: 2,
      max: 4,
    },
    participations: [participationSchema],
  },
  // Ajoute automatiquement createdAt et updatedAt
  { timestamps: true },
);

// On renomme _id en id dans le JSON renvoyé par l'API
gameSchema.set("toJSON", {
  transform(doc, json) {
    json.id = json._id;
    delete json._id;
    delete json.__v;
    return json;
  },
});

export default mongoose.model("Game", gameSchema);
