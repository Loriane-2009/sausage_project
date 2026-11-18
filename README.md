# Sausage

Jeu mobile inspiré de Snake, (en solo) et en multijoueur.
Projet de groupe des cours ArchiOWeb et DevMobil, HEIG-VD.

## Structure

- `api/` : l'API REST (Express, MongoDB)
- `web/` : le front (PWA), à venir

## Prérequis

- Node.js 26 (22.9 et 24 fonctionnent aussi)
- MongoDB 8 qui tourne en local sur `mongodb://127.0.0.1:27017` (installé ou via Docker)

## Installation

```bash
git clone https://github.com/Loriane-2009/sausage_project.git
cd sausage_project/api
npm ci
cp .env.example .env
npm run dev
```



## Scripts (dans `api/`)

| Commande | Effet |
| --- | --- |
| `npm run dev` | lance l'API en local et la redémarre à chaque modification |
| `npm start` | lance l'API (utilisé par Render) |
| `npm test` | lance les tests sur la base `sausage-test` |

## Variables d'environnement

Copier `api/.env.example` en `api/.env`. Le fichier `.env` n'est jamais commité.

| Variable | Rôle |
| --- | --- |
| `PORT` | port de l'API (3000 par défaut) |
| `DATABASE_URL` | URL de la base MongoDB locale |
| `JWT_SECRET` | secret pour signer les tokens |

## Liens

- API en production : https://mon-api-archioweb.onrender.com/

## Équipe

Loriane, Ana, Lilou, Léa