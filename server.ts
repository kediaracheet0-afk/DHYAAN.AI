import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('dhyaan.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    suggestedTools TEXT
  );
  
  CREATE TABLE IF NOT EXISTS focus_sessions (
    id TEXT PRIMARY KEY,
    taskId TEXT,
    startTime INTEGER NOT NULL,
    endTime INTEGER,
    duration INTEGER,
    FOREIGN KEY(taskId) REFERENCES tasks(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/tasks', (req, res) => {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY createdAt DESC').all();
    res.json(tasks.map((t: any) => ({
      ...t,
      completed: !!t.completed,
      suggestedTools: t.suggestedTools ? JSON.parse(t.suggestedTools) : []
    })));
  });

  app.post('/api/tasks', (req, res) => {
    const { id, text, completed, createdAt, suggestedTools } = req.body;
    const stmt = db.prepare('INSERT INTO tasks (id, text, completed, createdAt, suggestedTools) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, text, completed ? 1 : 0, createdAt, JSON.stringify(suggestedTools || []));
    res.status(201).json({ success: true });
  });

  app.put('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { completed, suggestedTools } = req.body;
    
    if (suggestedTools !== undefined) {
      const stmt = db.prepare('UPDATE tasks SET suggestedTools = ? WHERE id = ?');
      stmt.run(JSON.stringify(suggestedTools), id);
    } else {
      const stmt = db.prepare('UPDATE tasks SET completed = ? WHERE id = ?');
      stmt.run(completed ? 1 : 0, id);
    }
    
    res.json({ success: true });
  });

  app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  });

  app.post('/api/sessions', (req, res) => {
    const { id, taskId, startTime, endTime, duration } = req.body;
    const stmt = db.prepare('INSERT INTO focus_sessions (id, taskId, startTime, endTime, duration) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, taskId, startTime, endTime, duration);
    res.status(201).json({ success: true });
  });

  app.get('/api/stats', (req, res) => {
    const totalKarma = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE completed = 1').get() as any;
    const totalFocusTime = db.prepare('SELECT SUM(duration) as total FROM focus_sessions').get() as any;
    res.json({
      totalKarma: totalKarma.count,
      totalFocusTime: totalFocusTime.total || 0
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
