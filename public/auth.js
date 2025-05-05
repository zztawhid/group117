// Authentication and navigation management
document.addEventListener('DOMContentLoaded', function() {
    // Configuration - Remove everything above login.html after
    const PUBLIC_ROUTES = [
        '/login.html',
        '/register.html',
        '/contact.html',
<<<<<<< HEAD
        '/index.html'
    ];



    // Get current user and page
    const user = JSON.parse(localStorage.getItem('user'));
    const currentPage = window.location.pathname.split('/').pop().toLowerCase();

    // Navigation management
    const navLinksContainer = document.querySelector('.topnav');

=======
        '/index.html' 
    ];
    

    
    // Get current user and page
    const user = JSON.parse(localStorage.getItem('user'));
    const currentPage = window.location.pathname.split('/').pop().toLowerCase();
    
    // Navigation management
    const navLinksContainer = document.querySelector('.topnav');
    
>>>>>>> parent of 07e2797 (changes)
    if (navLinksContainer) {
        if (user) {
            // authenticated user
            navLinksContainer.innerHTML = `
                <ul><a href="main.html" class="nav-link">Home Page</a></ul>
                <ul><a href="parking.html" class="nav-link">Parking</a></ul>
                <ul><a href="account.html" class="nav-link">Account Management</a></ul>
                <ul><a href="vManage.html" class="nav-link">Vehicle Management</a></ul>
                <ul><a href="notif.html" class="nav-link">Notifications</a></ul>
            `;
<<<<<<< HEAD

=======
            
>>>>>>> parent of 07e2797 (changes)
            // logout handle
            document.getElementById('logout-btn').addEventListener('click', function(e) {
                e.preventDefault();
                logout();
            });
        } else {
            // guest view - only shows login / register
            navLinksContainer.innerHTML = `
                <ul><a href="index.html" class="nav-link">Home Page</a></ul>
                <ul><a href="login.html" class="nav-link">Log In</a></ul>
                <ul><a href="register.html" class="nav-link">Register</a></ul>
            `;
        }
            // highlighting the active page
            const activenavLinks = navLinksContainer.querySelectorAll('.nav-link');
            activenavLinks.forEach(link => {
              if (link.getAttribute('href').toLowerCase() === currentPage) {
                link.classList.add('active');
            }
        });
    }
<<<<<<< HEAD

=======
    
>>>>>>> parent of 07e2797 (changes)
    // route protection
    if (!PUBLIC_ROUTES.some(route => route.endsWith(currentPage)) && !user) {
        window.location.href = 'login.html';
        return;
    }
<<<<<<< HEAD

=======
    
>>>>>>> parent of 07e2797 (changes)
    // update active page indicator
    const activePageElement = document.querySelector('.active-page');
    if (activePageElement) {
        // extract page name from URL
        const pageName = currentPage.replace('.html', '').replace(/-/g, ' ');
        activePageElement.textContent = pageName.charAt(0).toUpperCase() + pageName.slice(1);
    }
});


//logs out current user
function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}
<<<<<<< HEAD

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


// /* MIGHT REMOVE */
// function checkAuth() {
//     const user = JSON.parse(localStorage.getItem('user'));
//     if (!user) {
//         window.location.href = 'login.html';
//     }
//     return user;
// }

=======

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


// /* MIGHT REMOVE */
// function checkAuth() {
//     const user = JSON.parse(localStorage.getItem('user'));
//     if (!user) {
//         window.location.href = 'login.html';
//     }
//     return user;
// }

>>>>>>> parent of 07e2797 (changes)
// checkAuth();