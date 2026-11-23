const pool = require('../config/db');

const ChatModel = {
    async createChat(userId, title) {
        const { rows } = await pool.query(
            'INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING *',
            [userId, title]
        );
        return rows[0];
    },

    async addMessage(chatId, role, content) {
        await pool.query(
            'INSERT INTO chat_messages (chat_id, role, content) VALUES ($1, $2, $3)',
            [chatId, role, content]
        );
        // Update the chat's updated_at timestamp
        await pool.query('UPDATE chats SET updated_at = NOW() WHERE id = $1', [chatId]);
    },

    async getChatsByUser(userId) {
        const { rows } = await pool.query(
            `SELECT c.id, c.title, 
              (SELECT content FROM chat_messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
              c.updated_at
       FROM chats c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC`,
            [userId]
        );
        return rows;
    },

    async getMessagesByChatId(chatId) {
        const { rows } = await pool.query(
            'SELECT role, content FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC',
            [chatId]
        );
        return rows;
    }
};

module.exports = ChatModel;