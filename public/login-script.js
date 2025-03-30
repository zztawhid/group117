document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.querySelector('#login-form form');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous errors
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(el => el.remove());
        
        // Get form values
        const email = this.elements['email'].value.trim();
        const password = this.elements['password'].value;
        
        // Basic validation
        if (!email || !password) {
            showError('Please fill in all fields');
            return;
        }
        
        try {
            const submitBtn = this.elements['login'];
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Store user data in session/local storage
                localStorage.setItem('user', JSON.stringify(result.user));
                // Redirect to dashboard or home page
                window.location.href = 'main.html';
            } else {
                showError(result.message || 'Login failed');
            }
        } catch (error) {
            showError('Network error. Please try again.');
            console.error('Login error:', error);
        } finally {
            const submitBtn = this.elements['login'];
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    });
    
    function showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        loginForm.prepend(errorElement);
    }
});