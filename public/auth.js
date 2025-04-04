// Authentication and navigation management
document.addEventListener('DOMContentLoaded', function() {
    // Configuration - Remove everything above login.html after
    const PUBLIC_ROUTES = [
        '/main.html',
        '/parking.html',
        '/account.html',
        '/vManage.html',
        '/notif.html',
        '/settings.html',
        '/login.html',
        '/register.html',
        '/contact.html',
        '/index.html' 
    ];
    
    // Get current user and page
    const user = JSON.parse(localStorage.getItem('user'));
    const currentPage = window.location.pathname.split('/').pop().toLowerCase();
    
    // Navigation management
    const navLinksContainer = document.querySelector('.topnav');
    
    if (navLinksContainer) {
        if (user) {
            // Authenticated user - keep your original nav structure
            navLinksContainer.innerHTML = `
                <ul><a href="main.html" class="nav-link">Home Page</a></ul>
                <ul><a href="parking.html" class="nav-link">Parking</a></ul>
                <ul><a href="account.html" class="nav-link">Account Management</a></ul>
                <ul><a href="vManage.html" class="nav-link">Vehicle Management</a></ul>
                <ul><a href="notif.html" class="nav-link">Notifications</a></ul>
            `;
            
            // Add logout handler
            document.getElementById('logout-btn').addEventListener('click', function(e) {
                e.preventDefault();
                logout();
            });
        } else {
            // Guest - show only login/register
            navLinksContainer.innerHTML = `
                <ul><a href="login.html" class="nav-link">Log In</a></ul>
                <ul><a href="register.html" class="nav-link">Register</a></ul>
            `;
        }
    }
    
    // Route protection
    if (!PUBLIC_ROUTES.some(route => route.endsWith(currentPage)) && !user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Update active page indicator
    const activePageElement = document.querySelector('.active-page');
    if (activePageElement) {
        // Extract page name from URL
        const pageName = currentPage.replace('.html', '').replace(/-/g, ' ');
        activePageElement.textContent = pageName.charAt(0).toUpperCase() + pageName.slice(1);
    }
});

/**
 * Logs out the current user
 */
function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

/**
 * Gets authorization headers for API calls
 * @returns {Object} Headers with auth token if available
 */
function getAuthHeaders() {
    const user = JSON.parse(localStorage.getItem('user'));
    return user ? { 
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
    } : {};
}