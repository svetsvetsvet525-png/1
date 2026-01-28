// Utility function to format date and time
function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Function to apply markdown formatting and highlight code
function formatMessage(text) {
    // Escape HTML to prevent XSS, but allow specific tags for formatting
    let formattedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Code blocks (triple backticks)
    formattedText = formattedText.replace(/```(\w+)?\n([\s\S]*?)\n```/g, (match, lang, code) => {
        lang = lang || 'plaintext'; // Default to plaintext if no language specified
        return `<pre><code class="language-${lang}">${code}</code></pre>`;
    });

    // Bold (*text*)
    formattedText = formattedText.replace(/\*([^\*]+)\*/g, '<strong>$1</strong>');
    // Italic (_text_)
    formattedText = formattedText.replace(/_([^_]+)_/g, '<em>$1</em>');

    return formattedText;
}

// Обновленная функция для вызова API через бэкенд
async function callGroqAPI(userMessage) {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: userMessage
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server Error:', errorData);
            return `Извините, произошла ошибка: ${errorData.error || response.statusText}`;
        }

        const data = await response.json();
        return data.response;

    } catch (error) {
        console.error('Fetch Error:', error);
        return 'Извините, произошла сетевая ошибка.';
    }
}

// Elements
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const clearInputBtn = document.getElementById('clear-input-btn');
const typingIndicator = document.getElementById('typing-indicator');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistory = document.querySelector('.chat-history');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const currentChatTitle = document.getElementById('current-chat-title');

// Current chat state
let currentChatId = null;
let chats = {}; // { chatId: { title: "...", messages: [...] } }

// Load theme preference
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.classList.add(savedTheme);
    } else {
        document.body.classList.add('light-theme'); // Default theme
    }
});

// Function to add a message to the chat display
function addMessageToChat(message, sender, timestamp) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);

    const avatar = document.createElement('div');
    avatar.classList.add('message-avatar');
    avatar.textContent = sender === 'user' ? 'U' : 'A';

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('message-content-wrapper');

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.innerHTML = formatMessage(message); // Use innerHTML and formatMessage

    const info = document.createElement('div');
    info.classList.add('message-info');
    info.textContent = formatTime(timestamp);

    contentWrapper.appendChild(bubble);
    contentWrapper.appendChild(info);
    messageElement.appendChild(avatar);
    messageElement.appendChild(contentWrapper);
    chatMessages.appendChild(messageElement);

    if (window.hljs) {
        window.hljs.highlightAll();
    }

    // Add copy button for AI messages
    if (sender === 'ai') {
        const copyBtn = document.createElement('span');
        copyBtn.classList.add('material-icons', 'copy-btn');
        copyBtn.textContent = 'content_copy';
        copyBtn.title = 'Скопировать ответ';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(message.replace(/<[^>]*>?/gm, '')); // Remove HTML tags for copying
            alert('Текст скопирован!');
        });
        bubble.appendChild(copyBtn);
    }

    // Auto-scroll to the latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to simulate AI typing and response
async function simulateAIResponse(userMessage) {
    typingIndicator.classList.add('visible');
    chatMessages.scrollTop = chatMessages.scrollHeight; // Keep typing indicator in view

    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500)); // 0.5-1.5 second delay

    const aiResponse = await callGroqAPI(userMessage);
    const aiMessage = {
        text: '',
        sender: 'ai',
        timestamp: new Date()
    };
    
    // Save the message to the current chat's history
    chats[currentChatId].messages.push({
        text: userMessage,
        sender: 'user',
        timestamp: new Date()
    });

    chats[currentChatId].messages.push(aiMessage);
    saveChats();

    const aiMessageElement = document.createElement('div');
    aiMessageElement.classList.add('message', 'ai');

    const avatar = document.createElement('div');
    avatar.classList.add('message-avatar');
    avatar.textContent = 'A';

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('message-content-wrapper');

    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    contentWrapper.appendChild(bubble);

    const info = document.createElement('div');
    info.classList.add('message-info');
    info.textContent = formatTime(aiMessage.timestamp);
    contentWrapper.appendChild(info);

    aiMessageElement.appendChild(avatar);
    aiMessageElement.appendChild(contentWrapper);
    chatMessages.appendChild(aiMessageElement);

    // Simulate typing effect
    let i = 0;
    const typingInterval = setInterval(() => {
        if (i < aiResponse.length) {
            bubble.textContent += aiResponse.charAt(i);
            i++;
            chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
        } else {
            clearInterval(typingInterval);
            typingIndicator.classList.remove('visible');
            // Update the stored message with the full text after typing is complete
            aiMessage.text = aiResponse; // Ensure the full text is saved
            saveChats(); // Save again after full message is typed
        }
    }, 30);
}

// Event Listener for Send Button
sendBtn.addEventListener('click', async () => {
    const messageText = messageInput.value.trim();
    if (messageText.length > 5000) {
        alert('Сообщение слишком длинное. Максимальная длина 5000 символов.');
        return;
    }
    if (messageText) {
        // If it's a new chat, create a new entry
        if (!currentChatId || chats[currentChatId].messages.length === 0) {
            const newId = Date.now().toString();
            currentChatId = newId;
            chats[newId] = {
                title: messageText.substring(0, 30) + (messageText.length > 30 ? "..." : ""),
                messages: []
            };
            updateChatHistoryUI();
            currentChatTitle.textContent = chats[currentChatId].title;
        }

        addMessageToChat(messageText, 'user', new Date());
        messageInput.value = '';
        messageInput.style.height = 'auto'; // Reset textarea height
        await simulateAIResponse(messageText);
        saveChats(); // Save after AI response is fully typed
    }
});

// Event listener for Enter key in message input
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent new line
        sendBtn.click();
    }
});

// Adjust textarea height automatically
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
});

// Clear input button
clearInputBtn.addEventListener('click', () => {
    messageInput.value = '';
    messageInput.style.height = 'auto';
});

// New Chat button
newChatBtn.addEventListener('click', () => {
    currentChatId = null;
    chatMessages.innerHTML = '';
    currentChatTitle.textContent = 'Новый чат';
    // Deactivate any active chat history item
    document.querySelectorAll('.chat-history-item').forEach(item => {
        item.classList.remove('active');
    });
});

// Theme toggle
themeToggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light-theme');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark-theme');
    }
});

// Local Storage Functions
function saveChats() {
    localStorage.setItem('aiChats', JSON.stringify(chats));
}

function loadChats() {
    const savedChats = localStorage.getItem('aiChats');
    if (savedChats) {
        chats = JSON.parse(savedChats);
        updateChatHistoryUI();
        // Optionally load the last active chat or a default one
        const lastChatId = Object.keys(chats)[0];
        if (lastChatId) {
            loadChat(lastChatId);
        }
    }
}

function updateChatHistoryUI() {
    chatHistory.innerHTML = '';
    for (const id in chats) {
        const chatItem = document.createElement('div');
        chatItem.classList.add('chat-history-item');
        if (id === currentChatId) {
            chatItem.classList.add('active');
        }
        chatItem.dataset.chatId = id;

        const titleSpan = document.createElement('span');
        titleSpan.classList.add('chat-history-title');
        titleSpan.textContent = chats[id].title;
        chatItem.appendChild(titleSpan);

        // Add edit button
        const editBtn = document.createElement('span');
        editBtn.classList.add('material-icons', 'chat-edit-btn');
        editBtn.textContent = 'edit';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent loading chat when editing
            const newTitle = prompt('Переименовать чат:', chats[id].title);
            if (newTitle !== null && newTitle.trim() !== '') {
                chats[id].title = newTitle.trim();
                saveChats();
                updateChatHistoryUI();
                if (id === currentChatId) {
                    currentChatTitle.textContent = newTitle.trim();
                }
            }
        });
        chatItem.appendChild(editBtn);

        chatItem.addEventListener('click', () => loadChat(id));
        chatHistory.appendChild(chatItem);
    }
}

function loadChat(id) {
    currentChatId = id;
    chatMessages.innerHTML = '';
    currentChatTitle.textContent = chats[id].title;

    chats[id].messages.forEach(msg => {
        // Re-parse timestamp strings to Date objects
        addMessageToChat(msg.text, msg.sender, new Date(msg.timestamp));
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
    updateChatHistoryUI(); // Update active state
}

// Clear History Button
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Вы уверены, что хотите очистить всю историю чатов?')) {
        localStorage.removeItem('aiChats');
        chats = {};
        currentChatId = null;
        chatMessages.innerHTML = '';
        currentChatTitle.textContent = 'Новый чат';
        updateChatHistoryUI();
    }
});

// Initial load of chats
loadChats();