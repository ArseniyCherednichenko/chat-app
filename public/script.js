// Socket.io connection
const socket = io();

// DOM elements
const usernameModal = new bootstrap.Modal(document.getElementById('usernameModal'));
const emojiModal = new bootstrap.Modal(document.getElementById('emojiModal'));
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const chatInterface = document.getElementById('chatInterface');
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const usersList = document.getElementById('usersList');
const mobileUsersList = document.getElementById('mobileUsersList');
const userCount = document.getElementById('userCount');
const mobileUserCount = document.getElementById('mobileUserCount');

// State
let currentUsername = '';
let typingTimer = null;
let isTyping = false;
let selectedMessageId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    usernameModal.show();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Username modal
    joinBtn.addEventListener('click', joinChat);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinChat();
    });

    // Message input
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Typing indicators
    messageInput.addEventListener('input', handleTyping);
    messageInput.addEventListener('blur', stopTyping);

    // Emoji reactions
    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const emoji = e.target.dataset.emoji;
            if (selectedMessageId) {
                socket.emit('add_reaction', {
                    messageId: selectedMessageId,
                    emoji: emoji
                });
                emojiModal.hide();
            }
        });
    });
}

// Join chat
function joinChat() {
    const username = usernameInput.value.trim();
    if (username && username.length <= 20) {
        currentUsername = username;
        socket.emit('join', username);
        usernameModal.hide();
        chatInterface.style.display = 'flex';
        messageInput.focus();
    } else {
        alert('Please enter a valid username (1-20 characters)');
    }
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && message.length <= 500) {
        socket.emit('send_message', { text: message });
        messageInput.value = '';
        stopTyping();
        messageInput.focus();
    }
}

// Typing indicators
function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        socket.emit('typing_start');
    }

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        stopTyping();
    }, 2000);
}

function stopTyping() {
    if (isTyping) {
        isTyping = false;
        socket.emit('typing_stop');
    }
    clearTimeout(typingTimer);
}

// Socket event handlers
socket.on('load_messages', (messages) => {
    messagesArea.innerHTML = '';
    messages.forEach(message => displayMessage(message));
    scrollToBottom();
});

socket.on('new_message', (message) => {
    displayMessage(message);
    scrollToBottom();
});

socket.on('user_joined', (username) => {
    displaySystemMessage(`${username} joined the chat`);
});

socket.on('user_left', (username) => {
    displaySystemMessage(`${username} left the chat`);
});

socket.on('user_list', (users) => {
    updateUserList(users);
});

socket.on('user_typing', (typingUsers) => {
    updateTypingIndicator(typingUsers);
});

socket.on('reaction_update', (data) => {
    updateMessageReactions(data.messageId, data.reactions);
});

// Display functions
function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.dataset.messageId = message.id;

    const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-username">${escapeHtml(message.username)}</span>
            <span class="message-timestamp">${timestamp}</span>
        </div>
        <div class="message-content" onclick="showEmojiModal('${message.id}')">
            <p class="message-text">${escapeHtml(message.text)}</p>
            <div class="message-reactions" id="reactions-${message.id}">
                ${renderReactions(message.reactions)}
            </div>
        </div>
    `;

    messagesArea.appendChild(messageDiv);
}

function displaySystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = text;
    messagesArea.appendChild(messageDiv);
    scrollToBottom();
}

function renderReactions(reactions) {
    if (!reactions || Object.keys(reactions).length === 0) {
        return '';
    }

    return Object.entries(reactions)
        .filter(([emoji, users]) => users.length > 0)
        .map(([emoji, users]) => `
            <span class="reaction">
                <span class="reaction-emoji">${emoji}</span>
                <span class="reaction-count">${users.length}</span>
            </span>
        `)
        .join('');
}

function updateMessageReactions(messageId, reactions) {
    const reactionsContainer = document.getElementById(`reactions-${messageId}`);
    if (reactionsContainer) {
        reactionsContainer.innerHTML = renderReactions(reactions);
    }
}

function updateUserList(users) {
    const userListHTML = users.map(user => `
        <li><i class="fas fa-circle"></i> ${escapeHtml(user)}</li>
    `).join('');

    usersList.innerHTML = userListHTML;
    mobileUsersList.innerHTML = userListHTML;
    userCount.textContent = users.length;
    mobileUserCount.textContent = users.length;
}

function updateTypingIndicator(typingUsers) {
    const filteredUsers = typingUsers.filter(user => user !== currentUsername);
    
    if (filteredUsers.length === 0) {
        typingIndicator.innerHTML = '';
    } else if (filteredUsers.length === 1) {
        typingIndicator.innerHTML = `
            <span>${escapeHtml(filteredUsers[0])} is typing<span class="typing-dots"></span></span>
        `;
    } else if (filteredUsers.length === 2) {
        typingIndicator.innerHTML = `
            <span>${escapeHtml(filteredUsers[0])} and ${escapeHtml(filteredUsers[1])} are typing<span class="typing-dots"></span></span>
        `;
    } else {
        typingIndicator.innerHTML = `
            <span>Several users are typing<span class="typing-dots"></span></span>
        `;
    }
}

// Utility functions
function showEmojiModal(messageId) {
    selectedMessageId = messageId;
    emojiModal.show();
}

function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle connection events
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    displaySystemMessage('Disconnected from server. Trying to reconnect...');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    displaySystemMessage('Connection error. Please refresh the page.');
});

// Handle page visibility for better UX
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopTyping();
    }
});

// Handle window beforeunload
window.addEventListener('beforeunload', () => {
    stopTyping();
});