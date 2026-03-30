import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import http from 'http';
import app from './app';
import { createSocketServer } from './socket';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

createSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
