const pool = require('../config/db');

const ChatModel = {
    async createChat(userId, title) {
        const { rows } = await pool.query(
            'INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING *',
            [userId, title]
        );
        return rows[0];
    },

    async deleteChat(chatId, userId) {
        const { rows } = await pool.query(
            'DELETE FROM chats WHERE id = $1 AND user_id = $2 RETURNING id',
            [chatId, userId]
        );
        return rows[0] || null;
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
    },

    async deleteLastAssistantMessage(chatId) {
        await pool.query(`
      DELETE FROM chat_messages 
      WHERE id = (
        SELECT id FROM chat_messages 
        WHERE chat_id = $1 AND role = 'assistant' 
        ORDER BY created_at DESC LIMIT 1
      )
    `, [chatId]);
    },

    async updateLastUserMessage(chatId, newContent) {
        await pool.query(`
      UPDATE chat_messages 
      SET content = $1 
      WHERE id = (
        SELECT id FROM chat_messages 
        WHERE chat_id = $2 AND role = 'user' 
        ORDER BY created_at DESC LIMIT 1
      )
    `, [newContent, chatId]);
    }
};


module.exports = ChatModel;