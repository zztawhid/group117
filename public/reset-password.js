document.addEventListener('DOMContentLoaded', function() {
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        document.getElementById('reset-message').textContent = 'Invalid reset token. Check your email for the correct link.';
        document.getElementById('reset-message').classList.remove('hidden');
        document.getElementById('reset-password-form').classList.add('hidden');
        return;
    }

    document.getElementById('token').value = token;

    document.getElementById('reset-password-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }
        
        if (newPassword.length < 8) {
            showError('Password must be at least 8 characters');
            return;
        }

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: document.getElementById('token').value,
                    newPassword
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                document.getElementById('reset-password-form').classList.add('hidden');
                const messageEl = document.getElementById('reset-message');
                messageEl.textContent = 'Password reset successfully! You can now login with your new password.';
                messageEl.classList.remove('hidden');
                messageEl.style.color = 'green';
            } else {
                showError(result.message || 'Failed to reset password');
            }
        } catch (error) {
            showError('Network error. Please try again.');
            console.error('Reset password error:', error);
        }
    });

    function showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        const form = document.getElementById('reset-password-form');
        const existingError = form.querySelector('.error-message');
        if (existingError) existingError.remove();
        form.prepend(errorElement);
    }
});