const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Для обслуживания статических файлов

// Роут для работы с Groq API
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log('Processing message:', message.substring(0, 50) + '...');

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                messages: [{
                    role: "user",
                    content: message,
                }],
                model: "llama-3.3-70b-versatile",
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Groq API Error:', errorData);
            throw new Error(errorData.error?.message || 'API Error');
        }

        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content || 'Не удалось получить ответ';

        console.log('Response sent successfully');
        res.json({ response: aiResponse });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            error: 'Произошла ошибка при обработке запроса',
            details: error.message 
        });
    }
});

// Проверка работоспособности API
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Обслуживание index.html для всех остальных маршрутов
app.get('*', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});