import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import cors from 'cors';

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database configuration
const pool = new Pool({
    host: '82.202.143.118',
    user: 'postgres',
    password: 'XXxx112233445566',
    database: 'mydb',
    port: 5432,
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
    try {
        const result = await pool.query(
            'SELECT * FROM chats WHERE id = $1',
            [req.params.id]
        );
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
        
        const result = await pool.query(
            'UPDATE chats SET waiting = $1 WHERE id = $2 RETURNING *',
            [waiting, req.params.id]
        );
        
        console.log('Update result:', result.rows[0]);
        
        if (result.rows.length === 0) {
            console.log('No chat found with id:', req.params.id);
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 