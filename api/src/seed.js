import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

import User from './models/user.js';

const databaseUrl = process.env.DATABASE_URL ?? 'mongodb://127.0.0.1/sausage';
const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@sausage.local';
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  console.error("ADMIN_PASSWORD est obligatoire pour créer l'admin");
  process.exit(1);
}

await mongoose.connect(databaseUrl);

try {
  const existing = await User.findOne({ username: adminUsername }).exec();

  if (existing) {
    console.log(`L'admin "${adminUsername}" existe déjà, rien à faire`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await User.create({
      username: adminUsername,
      email: adminEmail,
      passwordHash,
      role: 'admin'
    });
    console.log(`Admin "${adminUsername}" créé`);
  }
} finally {
  await mongoose.disconnect();
}
