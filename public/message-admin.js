document.addEventListener('DOMContentLoaded', function() {
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessageButton');
    const refreshButton = document.getElementById('refreshButton');
    
    // Get user data from localStorage or session
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    const adminUserId = 100006; //HARDCODED ADMIN USERID
    
    // Load messages
    function loadMessages() {
        fetch(`/api/messages?sender_id=${user.user_id}&receiver_id=${adminUserId}`)
            .then(response => response.json())
            .then(messages => {
                chatMessages.innerHTML = '';
                messages.forEach(msg => {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = `message ${msg.sender_id === user.user_id ? 'sent' : 'received'}`;
                    
                    const senderName = document.createElement('div');
                    senderName.className = 'sender-name';
                    senderName.textContent = msg.sender_name;
                    
                    const content = document.createElement('div');
                    content.className = 'message-content';
                    content.textContent = msg.content;
                    
                    const time = document.createElement('div');
                    time.className = 'message-time';
                    time.textContent = new Date(msg.created_at).toLocaleString();
                    
                    messageDiv.appendChild(senderName);
                    messageDiv.appendChild(content);
                    messageDiv.appendChild(time);
                    chatMessages.appendChild(messageDiv);
                });
                
                // auto scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => {
                console.error('Error loading messages:', error);
                alert('Failed to load messages');
            });
    }
    
    // Send message
    function sendMessage() {
        const content = messageInput.value.trim();
        if (!content) return;
        
        fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sender_id: user.user_id,
                receiver_id: adminUserId,
                content: content
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                messageInput.value = '';
                loadMessages();
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        });
    }
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    refreshButton.addEventListener('click', loadMessages);
    
    // shift enter for new line
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Initial load
    loadMessages();
    
    // refreshes every 30 second
    setInterval(loadMessages, 30000);
});