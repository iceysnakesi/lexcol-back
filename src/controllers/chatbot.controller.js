const { GoogleGenAI } = require('@google/genai');
const ChatModel = require('../models/chat.model');

if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set.');
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    timeout: 120000
});

const MODEL_NAME = 'gemini-3.6-flash';

const ChatbotController = {
    async sendMessage(req, res) {
        try {
            const { message, chatId } = req.body;
            const userId = req.user.id;

            if (!message || !message.trim()) {
                return res.status(400).json({ error: 'Message is required' });
            }

            let currentChatId = chatId;

            // 1. If no chatId provided, create a new chat with a title based on the first message
            if (!currentChatId) {
                const title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
                const newChat = await ChatModel.createChat(userId, title);
                currentChatId = newChat.id;
            }

            // 2. Save the user's message to the DB
            await ChatModel.addMessage(currentChatId, 'user', message);

            // 3. Fetch history from DB to provide context to Gemini
            const pastMessages = await ChatModel.getMessagesByChatId(currentChatId);

            // Format history for the Gemini SDK
            const history = pastMessages.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            // 4. Initialize chat with history
            const chat = ai.chats.create({
                model: MODEL_NAME,
                history: history,
                config: {
                    systemInstruction: "You are Lexcol Assistant, a helpful and friendly AI for the Lexcol platform.",
                },
            });

            // 5. Send message to Gemini
            let response;
            try {
                response = await chat.sendMessage({ message });
            } catch (apiError) {
                console.error('Gemini API Error:', apiError);
                if (apiError.status === 429) {
                    return res.status(429).json({ error: 'The AI is busy. Please wait a moment and try again.' });
                }
                return res.status(500).json({ error: 'The AI service is temporarily unavailable.' });
            }

            const aiText = response.text;

            // 6. Save AI response to DB
            await ChatModel.addMessage(currentChatId, 'assistant', aiText);

            // 7. Return response along with the chatId (in case a new one was created)
            return res.json({
                reply: aiText,
                chatId: currentChatId
            });

        } catch (err) {
            console.error('Chatbot Controller Fatal Error:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }
    },

    async getChats(req, res) {
        try {
            const chats = await ChatModel.getChatsByUser(req.user.id);
            res.json({ chats });
        } catch (err) {
            console.error('Get Chats Error:', err);
            res.status(500).json({ error: 'Failed to fetch chats.' });
        }
    },

    async getChatMessages(req, res) {
        try {
            const { id } = req.params;
            const messages = await ChatModel.getMessagesByChatId(id);
            res.json({ messages });
        } catch (err) {
            console.error('Get Messages Error:', err);
            res.status(500).json({ error: 'Failed to fetch messages.' });
        }
    }
};

module.exports = ChatbotController;