import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    // Pseudo : obligatoire, unique, 3 à 20 caractères
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20
    },
    // E-mail : obligatoire, unique, enregistré en minuscules
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^\S+@\S+\.\S+$/
    },
    // Mot de passe haché avec bcrypt (jamais le mot de passe en clair)
    passwordHash: {
      type: String,
      required: true
    },
    // Rôle : "user" par défaut, "admin" seulement via le seed
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    }
  },
  // Ajoute automatiquement createdAt et updatedAt
  { timestamps: true }
);

// Ce que l'API renvoie quand on transforme un user en JSON :
// on renomme _id en id et on retire le hash du mot de passe.
userSchema.set('toJSON', {
  transform(doc, json) {
    json.id = json._id;
    delete json._id;
    delete json.__v;
    delete json.passwordHash;
    return json;
  }
});

export default mongoose.model('User', userSchema);