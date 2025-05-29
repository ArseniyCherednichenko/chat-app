const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage
let messages = [];
let users = new Map(); // socketId -> username
let typingUsers = new Set();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle user joining
    socket.on('join', (username) => {
        users.set(socket.id, username);
        
        // Send existing messages to the new user
        socket.emit('load_messages', messages);
        
        // Broadcast user joined
        socket.broadcast.emit('user_joined', username);
        
        // Send updated user list
        io.emit('user_list', Array.from(users.values()));
        
        console.log(`${username} joined the chat`);
    });

    // Handle new messages
    socket.on('send_message', (data) => {
        const username = users.get(socket.id);
        if (!username) return;

        const message = {
            id: Date.now() + Math.random(), // Simple unique ID
            username: username,
            text: data.text,
            timestamp: new Date().toISOString(),
            reactions: {}
        };

        messages.push(message);
        
        // Broadcast message to all users
        io.emit('new_message', message);
        
        console.log(`Message from ${username}: ${data.text}`);
    });

    // Handle typing indicators
    socket.on('typing_start', () => {
        const username = users.get(socket.id);
        if (!username) return;

        typingUsers.add(username);
        socket.broadcast.emit('user_typing', Array.from(typingUsers));
    });

    socket.on('typing_stop', () => {
        const username = users.get(socket.id);
        if (!username) return;

        typingUsers.delete(username);
        socket.broadcast.emit('user_typing', Array.from(typingUsers));
    });

    // Handle emoji reactions
    socket.on('add_reaction', (data) => {
        const username = users.get(socket.id);
        if (!username) return;

        const message = messages.find(m => m.id === data.messageId);
        if (!message) return;

        // Initialize reactions object if it doesn't exist
        if (!message.reactions[data.emoji]) {
            message.reactions[data.emoji] = [];
        }

        // Toggle reaction: remove if already exists, add if not
        const existingIndex = message.reactions[data.emoji].indexOf(username);
        if (existingIndex > -1) {
            message.reactions[data.emoji].splice(existingIndex, 1);
            // Remove emoji key if no reactions left
            if (message.reactions[data.emoji].length === 0) {
                delete message.reactions[data.emoji];
            }
        } else {
            message.reactions[data.emoji].push(username);
        }

        // Broadcast updated reactions
        io.emit('reaction_update', {
            messageId: data.messageId,
            reactions: message.reactions
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const username = users.get(socket.id);
        if (username) {
            users.delete(socket.id);
            typingUsers.delete(username);
            
            // Broadcast user left
            socket.broadcast.emit('user_left', username);
            
            // Send updated user list and typing indicators
            io.emit('user_list', Array.from(users.values()));
            io.emit('user_typing', Array.from(typingUsers));
            
            console.log(`${username} left the chat`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Chat server running on http://localhost:${PORT}`);
});