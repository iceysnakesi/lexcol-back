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
            const { message, chatId, isEdit } = req.body;
            const userId = req.user.id;

            if (!message || !message.trim()) {
                return res.status(400).json({ error: 'Message is required' });
            }

            let currentChatId = chatId;

            if (!currentChatId) {
                const title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
                const newChat = await ChatModel.createChat(userId, title);
                currentChatId = newChat.id;
            } else if (isEdit) {
                // If editing, remove the previous AI response and update the user's message
                await ChatModel.deleteLastAssistantMessage(currentChatId);
                await ChatModel.updateLastUserMessage(currentChatId, message);
            } else {
                // Normal flow: save the new user message
                await ChatModel.addMessage(currentChatId, 'user', message);
            }

            // Fetch updated history
            const pastMessages = await ChatModel.getMessagesByChatId(currentChatId);

            const history = pastMessages.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            const chat = ai.chats.create({
                model: MODEL_NAME,
                history: history,
                config: {
                    systemInstruction: "You are Lexcol Assistant, a helpful and friendly AI for the Lexcol platform.",
                },
            });

            let response;
            try {
                response = await chat.sendMessage({ message });
            } catch (apiError) {
                console.error('Gemini API Error:', apiError);
                if (apiError.status === 429 || apiError.status === 503) {
                    return res.status(503).json({ error: 'The AI is busy or experiencing high demand. Please try again in a moment.' });
                }
                return res.status(500).json({ error: 'The AI service is temporarily unavailable.' });
            }

            const aiText = response.text;
            await ChatModel.addMessage(currentChatId, 'assistant', aiText);

            return res.json({ reply: aiText, chatId: currentChatId });

        } catch (err) {
            console.error('Chatbot Controller Fatal Error:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }
    },

    async regenerate(req, res) {
        try {
            const { chatId } = req.body;
            if (!chatId) return res.status(400).json({ error: 'chatId is required' });

            // 1. Remove the failed/old AI response
            await ChatModel.deleteLastAssistantMessage(chatId);

            // 2. Fetch history (which now ends with the user's message)
            const pastMessages = await ChatModel.getMessagesByChatId(chatId);
            if (pastMessages.length === 0) return res.status(400).json({ error: 'No messages to regenerate from' });

            const lastUserMessage = pastMessages[pastMessages.length - 1].content;
            const history = pastMessages.slice(0, -1).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            }));

            const chat = ai.chats.create({
                model: MODEL_NAME,
                history: history,
                config: {
                    systemInstruction: "You are Lexcol Assistant, a helpful and friendly AI for the Lexcol platform.",
                },
            });

            let response;
            try {
                response = await chat.sendMessage({ message: lastUserMessage });
            } catch (apiError) {
                console.error('Gemini API Error:', apiError);
                return res.status(503).json({ error: 'The AI is busy. Please try again.' });
            }

            const aiText = response.text;
            await ChatModel.addMessage(chatId, 'assistant', aiText);

            return res.json({ reply: aiText });
        } catch (err) {
            console.error('Regenerate Error:', err);
            return res.status(500).json({ error: 'Failed to regenerate.' });
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

    async deleteChat(req, res) {
        try {
            const chatId = req.params.id;
            const userId = req.user.id;

            const deleted = await ChatModel.deleteChat(chatId, userId);

            if (!deleted) {
                return res.status(404).json({ error: 'Chat not found or unauthorized' });
            }

            res.json({ success: true, message: 'Chat deleted successfully' });
        } catch (err) {
            console.error('Delete Chat Error:', err);
            res.status(500).json({ error: 'Failed to delete chat' });
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