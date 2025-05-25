import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.SERVER_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Successfully connected to the database');
        release();
    }
});

// Defensive check helper
function isValidId(id) {
  return id !== undefined && id !== null && id !== '' && id !== 'null' && id !== 'undefined';
}

// API Routes
app.get('/api/chats', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM chats ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching chats:', err);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

app.get('/api/chats/:id/messages', async (req, res) => {
    if (!isValidId(req.params.id)) {
        console.error('Invalid chat id for messages:', req.params.id);
        return res.status(400).json({ error: 'Invalid chat id' });
    }
    try {
        const result = await pool.query(
            'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.post('/api/chats', async (req, res) => {
    try {
        const { uuid, ai } = req.body;
        const result = await pool.query(
            'INSERT INTO chats (uuid, ai) VALUES ($1, $2) RETURNING *',
            [uuid, ai]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating chat:', err);
        res.status(500).json({ error: 'Failed to create chat' });
    }
});

app.post('/api/messages', async (req, res) => {
    if (!isValidId(req.body.chat_id)) {
        console.error('Invalid chat_id for new message:', req.body.chat_id);
        return res.status(400).json({ error: 'Invalid chat_id' });
    }
    try {
        const { chat_id, message, message_type, ai } = req.body;
        const result = await pool.query(
            'INSERT INTO messages (chat_id, message, message_type, ai) VALUES ($1, $2, $3, $4) RETURNING *',
            [chat_id, message, message_type, ai]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating message:', err);
        res.status(500).json({ error: 'Failed to create message' });
    }
});

app.get('/api/chats/:id', async (req, res) => {
    if (!isValidId(req.params.id)) {
        console.error('Invalid chat id for get chat:', req.params.id);
        return res.status(400).json({ error: 'Invalid chat id' });
    }
    try {
        // Try to find chat by ID first
        let result = await pool.query(
            'SELECT * FROM chats WHERE id = $1',
            [req.params.id]
        );
        
        // If not found by ID, try UUID
        if (result.rows.length === 0) {
            result = await pool.query(
                'SELECT * FROM chats WHERE uuid = $1',
                [req.params.id]
            );
        }
        
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Chat not found' });
            return;
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching chat:', err);
        res.status(500).json({ error: 'Failed to fetch chat' });
    }
});

app.put('/api/chats/:id/waiting', async (req, res) => {
    try {
        const { waiting } = req.body;
        console.log('Updating chat waiting status:', { id: req.params.id, waiting });
        
        // Try to find chat by ID first
        let result = await pool.query(
            'UPDATE chats SET waiting = $1 WHERE id = $2 RETURNING *',
            [waiting, req.params.id]
        );
        
        // If not found by ID, try UUID
        if (result.rows.length === 0) {
            result = await pool.query(
                'UPDATE chats SET waiting = $1 WHERE uuid = $2 RETURNING *',
                [waiting, req.params.id]
            );
        }
        
        console.log('Update result:', result.rows[0]);
        
        if (result.rows.length === 0) {
            console.log('No chat found with id/uuid:', req.params.id);
            res.status(404).json({ error: 'Chat not found' });
            return;
        }
        
        res.json({ success: true, chat: result.rows[0] });
    } catch (err) {
        console.error('Error updating chat waiting status:', err);
        res.status(500).json({ error: 'Failed to update chat' });
    }
});

app.put('/api/chats/:id/ai', async (req, res) => {
    try {
        const { ai } = req.body;
        console.log('Updating chat AI status:', { id: req.params.id, ai });
        
        const result = await pool.query(
            'UPDATE chats SET ai = $1 WHERE id = $2 RETURNING *',
            [ai, req.params.id]
        );
        
        console.log('Update result:', result.rows[0]);
        
        if (result.rows.length === 0) {
            console.log('No chat found with id:', req.params.id);
            res.status(404).json({ error: 'Chat not found' });
            return;
        }
        
        res.json(result.rows[0]);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'stats_update' }));
            }
        });
    } catch (err) {
        console.error('Error updating chat AI status:', err);
        res.status(500).json({ error: 'Failed to update chat' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE waiting = true) as pending,
                COUNT(*) FILTER (WHERE ai = true) as ai
            FROM chats
        `);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Webhook proxy route
app.post('/api/webhook/messages', async (req, res) => {
    try {
        const response = await fetch(process.env.WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        console.error('Error proxying webhook message:', err);
        res.status(500).json({ error: 'Failed to proxy webhook message' });
    }
});

// WebSocket server setup
const wss = new WebSocketServer({ port: 3002 });

// Храним подключения фронтов и бота
let frontendClients = [];
let botClient = null;

wss.on('connection', (ws, req) => {
    // Определяем тип клиента по первому сообщению
    ws.once('message', (msg) => {
        let parsed;
        try {
            parsed = JSON.parse(msg);
        } catch {
            ws.close();
            return;
        }
        if (parsed.type === 'bot') {
            botClient = ws;
            ws.on('message', (data) => {
                // Бот прислал новое сообщение для фронта
                frontendClients.forEach(client => {
                    if (client.readyState === 1) {
                        client.send(data);
                    }
                });
            });
            ws.on('close', () => {
                botClient = null;
            });
        } else if (parsed.type === 'frontend') {
            frontendClients.push(ws);
            ws.on('message', (data) => {
                // Фронт отправил сообщение для бота (например, от менеджера)
                if (botClient && botClient.readyState === 1) {
                    botClient.send(data);
                }
            });
            ws.on('close', () => {
                frontendClients = frontendClients.filter(c => c !== ws);
            });
        } else {
            ws.close();
        }
    });
});

console.log('WebSocket server running at ws://localhost:3002');

// Delete chat
app.delete('/api/chats/:id', async (req, res) => {
  const chatId = req.params.id;
  
  try {
    // First try to delete by ID
    const result = await pool.query(
      'DELETE FROM chats WHERE id = $1 RETURNING id',
      [chatId]
    );
    
    if (result.rows.length === 0) {
      // If not found by ID, try to delete by UUID
      const uuidResult = await pool.query(
        'DELETE FROM chats WHERE uuid = $1 RETURNING id',
        [chatId]
      );
      
      if (uuidResult.rows.length === 0) {
        return res.status(404).json({ error: 'No chat found with the provided ID or UUID' });
      }
      
      // Delete associated messages
      await pool.query('DELETE FROM messages WHERE chat_id = $1', [uuidResult.rows[0].id]);
      
      // Broadcast chat deletion to all connected clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'chat_deleted',
            chatId: uuidResult.rows[0].id
          }));
        }
      });
      
      res.json({ message: 'Chat deleted successfully' });
    } else {
      // Delete associated messages
      await pool.query('DELETE FROM messages WHERE chat_id = $1', [result.rows[0].id]);
      
      // Broadcast chat deletion to all connected clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'chat_deleted',
            chatId: result.rows[0].id
          }));
        }
      });
      
      res.json({ message: 'Chat deleted successfully' });
    }
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'stats_update' }));
      }
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Add WebSocket message handling for chat read status
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'frontend') {
        ws.isFrontend = true;
        return;
      }
      
      if (data.type === 'mark_chat_read' && data.chatId) {
        // Update chat status in database
        await pool.query(
          'UPDATE chats SET waiting = false WHERE id = $1',
          [data.chatId]
        );
        
        // Broadcast the status update to all frontend clients
        wss.clients.forEach((client) => {
          if (client.isFrontend && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'status_update',
              chatId: data.chatId,
              waiting: false
            }));
          }
        });
        
        // Also broadcast updated stats
        const stats = await getStats();
        wss.clients.forEach((client) => {
          if (client.isFrontend && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'stats_update',
              stats
            }));
          }
        });
      }
      
      // ... rest of existing WebSocket message handling ...
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 