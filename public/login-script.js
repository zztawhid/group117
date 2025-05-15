document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.querySelector('#login-form form');
    
    // Initialize modal functionality
    initializeForgotPasswordModal();
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous errors
        clearErrors('login-form');
        
        // Get form values
        const email = this.elements['email'].value.trim();
        const password = this.elements['password'].value;
        
        // Basic validation
        if (!email || !password) {
            showError('Please fill in all fields', 'login-form');
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
                localStorage.setItem('user', JSON.stringify({
                    ...result.user,
                    token: result.token 
                }));
                window.location.href = 'main.html';
            } else {
                if (response.status === 429) {
                    showError('Too many login attempts. Please try again later.', 'login-form');
                } else {
                    showError(result.message || 'Login failed', 'login-form');
                }
            }
        } catch (error) {
            showError('Network error. Please try again.', 'login-form');
            console.error('Login error:', error);
        } finally {
            const submitBtn = loginForm.elements['login'];
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        }
    });
    
    function handleRateLimit() {
        rateLimited = true;
        
        // Disable the login form
        const form = document.getElementById('login-form');
        form.querySelectorAll('input, button').forEach(el => {
            el.disabled = true;
        });
        
        // Show countdown
        let minutes = 15;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        const countdown = setInterval(() => {
            submitBtn.textContent = `Try again in ${minutes} minutes`;
            minutes--;
            
            if (minutes < 0) {
                clearInterval(countdown);
                rateLimited = false;
                submitBtn.textContent = originalText;
                form.querySelectorAll('input, button').forEach(el => {
                    el.disabled = false;
                });
            }
        }, 1000);
        
        // Set timeout to clear rate limit after 15 minutes
        if (rateLimitTimeout) clearTimeout(rateLimitTimeout);
        rateLimitTimeout = setTimeout(() => {
            rateLimited = false;
        }, 15 * 60 * 1000);
    }
    
    function initializeForgotPasswordModal() {
        // Update the forgot password link
        const forgotPasswordLink = document.querySelector('p a[href=""]');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', function(e) {
                e.preventDefault();
                showForgotPasswordModal();
            });
        }

        // Handle forgot password form submission
        const forgotPasswordForm = document.getElementById('forgot-password-form');
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                await handleForgotPassword();
            });
        }
        
        // Close modal when clicking X or outside
        document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
            el.addEventListener('click', closeForgotPasswordModal);
        });
    }
    
    async function handleForgotPassword() {
        const form = document.getElementById('forgot-password-form');
        const email = document.getElementById('reset-email').value.trim();
        
        clearErrors('forgot-password-form');
        
        if (!email) {
            showError('Please enter your email address', 'forgot-password-form');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const result = await response.json();
            
            if (response.ok) {
                alert('Password reset link sent to your email');
                closeForgotPasswordModal();
            } else {
                if (response.status === 429) {
                    showError('Too many requests. Please try again later.', 'forgot-password-form');
                } else {
                    showError(result.message || 'Failed to send reset link', 'forgot-password-form');
                }
            }
        } catch (error) {
            showError('Network error. Please try again.', 'forgot-password-form');
            console.error('Forgot password error:', error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';
        }
    }
    
    function showForgotPasswordModal() {
        document.getElementById('forgot-password-modal').classList.remove('hidden');
        document.getElementById('reset-email').value = '';
        clearErrors('forgot-password-form');
        document.getElementById('reset-email').focus();
    }
    
    function closeForgotPasswordModal() {
        document.getElementById('forgot-password-modal').classList.add('hidden');
    }
    
    function showError(message, formId) {
        const form = document.getElementById(formId);
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        
        // Remove any existing error messages
        const existingError = form.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        form.prepend(errorElement);
    }
    
    function clearErrors(formId) {
        const form = document.getElementById(formId);
        const errorElements = form.querySelectorAll('.error-message');
        errorElements.forEach(el => el.remove());
    }
});