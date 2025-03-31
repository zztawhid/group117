// Check authentication status on page load
document.addEventListener('DOMContentLoaded', function() {
    // For all protected pages except login/register
    if (!window.location.pathname.includes('login.html') && 
        !window.location.pathname.includes('register.html')) {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            window.location.href = 'login.html';
        }
    }
});

// Function to get auth headers for API calls
function getAuthHeaders() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return {};
    
    return {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
    };
}