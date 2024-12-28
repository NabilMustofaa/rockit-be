# Rockit Backend

Rockit Backend is a Node.js application designed for managing multiplayer game rooms. It includes user authentication, room creation and joining, game state management, win tracking, and real-time online game via Pusher.

---

## Features

- **User Management**:
  - Create and manage user profiles.
  - Secure authentication with JWT.

- **Game Room Management**:
  - Create and join game rooms.
  - Manage game states and results.

- **Real-time Updates**:
  - Notify players of room events using Pusher.

- **Win Tracking**:
  - Track individual player performance with `win_count`.

---

## Prerequisites

Before running this project, ensure you have:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [PostgreSQL](https://www.postgresql.org/)
- [Pusher Account](https://pusher.com/) for real-time events

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/rockit-be.git
cd rockit-be
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root and configure the following variables:

```env
# Database configuration
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>

# Pusher configuration
PUSHER_APP_ID=<your-pusher-app-id>
PUSHER_KEY=<your-pusher-key>
PUSHER_SECRET=<your-pusher-secret>
PUSHER_CLUSTER=<your-pusher-cluster>

# JWT configuration
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRATION=1h
```

### 4. Set Up Database

Run the following SQL commands to set up the database schema:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  pin CHAR(6) NOT NULL,
  win_count INTEGER DEFAULT 0
);

CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  token VARCHAR(50) UNIQUE NOT NULL,
  player_1_id INTEGER NOT NULL REFERENCES users(id),
  player_2_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'waiting',
  winner VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  round INTEGER NOT NULL,
  player_1_move VARCHAR(50),
  player_2_move VARCHAR(50),
  result VARCHAR(50)
);

CREATE TABLE history (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_1_id INTEGER NOT NULL REFERENCES users(id),
  player_2_id INTEGER NOT NULL REFERENCES users(id),
  winner VARCHAR(50),
  played_at TIMESTAMP DEFAULT NOW(),
  finish_at TIMESTAMP
);
```

### 3. Project Structure

ROCKIT-BE
├── bin
├── config
│   ├── db.js
│   ├── index.js
│   ├── jwt.js
│   └── pusher.js
├── controllers
│   ├── authController.js
│   ├── gameController.js
│   ├── matchController.js
│   └── userController.js
├── middlewares
│   ├── auth.js
│   └── validation.js
├── node_modules
├── public
├── routes
│   ├── authRoutes.js
│   ├── gameRoutes.js
│   ├── index.js
│   ├── matchRoutes.js
│   └── userRoutes.js
├── validators
│   ├── index.js
│   ├── loginUser.validator.js
│   └── registerUser.validator.js
├── .env.example
├── .gitignore
├── app.js
├── package-lock.json
├── package.json
├── README.md
└── Rock-It.postman_collection.json

---

## Usage

### Start the Server

To start the server, run:

```bash
npm run start
```

## Real-time Notifications

Rockit Backend uses Pusher for real-time events. The following events are triggered:

- **`room-join`**:
  - Triggered when a player joins a room.
  - Includes information about both players and the game.

- **`room-end`**:
  - Triggered when the game ends.
  - Includes the final status and winner details.

---

## Development

### Run in Development Mode

To run the server with hot-reloading for development:

```bash
npm run dev
```
---

## Deployment

1. Ensure your `.env` file is correctly configured for the production environment.
2. Build the project (if applicable) and start the server using a process manager like [PM2](https://pm2.io/):

   ```bash
   npm install -g pm2
   pm2 start server.js
   ```

3. Monitor logs and server performance:

   ```bash
   pm2 logs
   pm2 status
   ```

---

## Testing

### Run Tests

If tests are available, run them using:

```bash
npm test
```

### Postman Collection

Import the provided Postman collection (`rockit-be.postman_collection.json`) to test the API.

---

## Contributions

Contributions are welcome! Please open issues or submit pull requests to suggest improvements.

---

## Contact

For support or inquiries, reach out to the repository owner.
