document.addEventListener('DOMContentLoaded', function() {
    const userSelect = document.getElementById('userSelect');
    const messageHistory = document.getElementById('messageHistory');
    const messageForm = document.getElementById('messageForm');
    const messageContent = document.getElementById('messageContent');
    
    // Get admin user data from localStorage or session
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Verify user is admin
    if (user.user_type !== 'admin') {
        window.location.href = 'main.html';
        return;
    }
    
    // Load users into dropdown
    function loadUsers() {
        fetch('/api/messages/users')
            .then(response => response.json())
            .then(users => {
                userSelect.innerHTML = '<option value="">-- Select a user --</option>';
                users.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.user_id;
                    option.textContent = `${user.full_name} (${user.email})`;
                    userSelect.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error loading users:', error);
                alert('Failed to load users');
            });
    }
    
    // Load messages for selected user
    function loadMessages() {
        const selectedUserId = userSelect.value;
        if (!selectedUserId) {
            messageHistory.innerHTML = '<p>Select a user to view messages</p>';
            return;
        }
        
        fetch(`/api/messages?sender_id=${user.user_id}&receiver_id=${selectedUserId}`)
            .then(response => response.json())
            .then(messages => {
                messageHistory.innerHTML = '';
                
                if (messages.length === 0) {
                    messageHistory.innerHTML = '<p>No messages yet</p>';
                    return;
                }
                
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
                    messageHistory.appendChild(messageDiv);
                });
                
                // Scroll to bottom
                messageHistory.scrollTop = messageHistory.scrollHeight;
            })
            .catch(error => {
                console.error('Error loading messages:', error);
                alert('Failed to load messages');
            });
    }
    
    // Send message
    function sendMessage(e) {
        e.preventDefault();
        
        const selectedUserId = userSelect.value;
        const content = messageContent.value.trim();
        
        if (!selectedUserId) {
            alert('Please select a user first');
            return;
        }
        
        if (!content) {
            alert('Please enter a message');
            return;
        }
        
        fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sender_id: user.user_id,
                receiver_id: selectedUserId,
                content: content
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                messageContent.value = '';
                loadMessages();
            }
        })
        .catch(error => {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        });
    }
    
    // Event listeners
    userSelect.addEventListener('change', loadMessages);
    messageForm.addEventListener('submit', sendMessage);
    
    // Initial load
    loadUsers();
});