document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    setupBookingButton();
    loadParkingLocations();
});

// Parking Locations Functions
async function loadParkingLocations() {
    try {
        showLoading(true, 'Loading parking availability...');
        const response = await fetch('/api/parking/locations');
        if (!response.ok) throw new Error('Failed to load locations');
        
        const locations = await response.json();
        renderParkingLocations(locations);
        loadNotifications(); // Load notifications for bookings and sessions
    } catch (error) {
        console.error('Error loading locations:', error);
        showError('Failed to load parking availability');
    } finally {
        showLoading(false);
    }
}


async function loadNotifications() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const notificationsList = document.getElementById('notifications-list');
        if (!notificationsList) return;

        notificationsList.innerHTML = '<li>Loading notifications...</li>';

        // Fetch user bookings
        const bookingsResponse = await fetch(`/api/user/bookings?user_id=${user.user_id}`);
        if (!bookingsResponse.ok) throw new Error('Failed to load bookings');
        const bookings = await bookingsResponse.json();

        // Fetch active parking session
        const sessionResponse = await fetch(`/api/parking/sessions/active?user_id=${user.user_id}`);
        if (!sessionResponse.ok) throw new Error('Failed to load active session');
        const activeSession = await sessionResponse.json();

        // Fetch general notifications from the database
        const generalNotificationsResponse = await fetch('/api/notifications');
        if (!generalNotificationsResponse.ok) throw new Error('Failed to load general notifications');
        const generalNotifications = await generalNotificationsResponse.json();

        // Clear notifications list
        notificationsList.innerHTML = '';

        // Add general notifications from the database
        if (generalNotifications.length > 0) {
            generalNotifications.forEach(notification => {
                const createdAt = new Date(notification.created_at).toLocaleString();
                notificationsList.innerHTML += `
                    <li>
                        <i class="fa-solid fa-bell"></i>
                        ${notification.title}: ${notification.message} <br>
                        <small>${createdAt}</small>
                    </li>
                `;
            });
        }

        // Check for upcoming bookings
        const now = new Date();
        const upcomingBookings = bookings.filter(booking => new Date(booking.start_time) > now);
        if (upcomingBookings.length > 0) {
            upcomingBookings.forEach(booking => {
                const startTime = new Date(booking.start_time).toLocaleString();
                notificationsList.innerHTML += `
                    <li>
                        <i class="fa-solid fa-calendar-check"></i>
                        Upcoming Booking: ${booking.location_name} (${booking.location_code}) on ${startTime}.
                    </li>
                `;
            });
        }

        // Check for nearly ending active session
        if (activeSession && activeSession.end_time) {
            const endTime = new Date(activeSession.end_time);
            const timeRemaining = Math.floor((endTime - now) / (1000 * 60)); // Time remaining in minutes
            if (timeRemaining > 0 && timeRemaining <= 30) {
                notificationsList.innerHTML += `
                    <li>
                        <i class="fa-solid fa-hourglass-end"></i>
                        Your parking session at ${activeSession.location_name} (${activeSession.location_code}) is ending in ${timeRemaining} minutes.
                    </li>
                `;
            }
        }

        // If no notifications, show a default message
        if (notificationsList.innerHTML.trim() === '') {
            notificationsList.innerHTML = '<li>No notifications at the moment.</li>';
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        const notificationsList = document.getElementById('notifications-list');
        if (notificationsList) {
            notificationsList.innerHTML = '<li>Failed to load notifications. Please try again later.</li>';
        }
    }
}

function renderParkingLocations(locations) {
    const tbody = document.getElementById('locations-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    locations.forEach(location => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${location.name}</td>
            <td>
                <span class="status-${location.disabled ? 'closed' : location.disabled_reason?.includes('Event') ? 'event' : 'open'}">
                    ${location.disabled ? 'Closed' : location.disabled_reason?.includes('Event') ? 'Event Only' : 'Open'}
                </span>
            </td>
            <td>${location.available_spaces} / ${location.total_spaces} spaces</td>
        `;

        tbody.appendChild(row);
    });
}




// Booking Modal Functions (existing)
let currentBookingToCancel = null;

function setupBookingButton() {
    const bookingsBtn = document.getElementById('advanced-booking-btn');
    if (bookingsBtn) {
        bookingsBtn.addEventListener('click', function() {
            openUserBookingsModal();
            loadUserBookings();
        });
    }
}

function openUserBookingsModal() {
    const modal = document.getElementById('user-bookings-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeUserBookingsModal() {
    const modal = document.getElementById('user-bookings-modal');
    if (modal) modal.classList.add('hidden');
}

async function loadUserBookings() {
    try {
        showLoading(true, 'Loading your bookings...');
        const user = JSON.parse(localStorage.getItem('user'));
        
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        const response = await fetch(`/api/user/bookings?user_id=${user.user_id}`);
        if (!response.ok) throw new Error('Failed to load bookings');
        
        const bookings = await response.json();
        renderUserBookings(bookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
        showError('Failed to load bookings. Please try again.');
    } finally {
        showLoading(false);
    }
}

function renderUserBookings(bookings) {
    const tbody = document.getElementById('user-bookings-list');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">You have no advanced bookings</td></tr>';
        return;
    }
    
    bookings.forEach(booking => {
        const row = document.createElement('tr');
        const startTime = new Date(booking.start_time).toLocaleString();
        const endTime = new Date(booking.end_time).toLocaleString();
        const duration = booking.duration_hours || 
                        Math.round((new Date(booking.end_time) - new Date(booking.start_time)) / (1000 * 60 * 60));
        
        row.innerHTML = `
            <td>${booking.reference_number || 'N/A'}</td>
            <td>${booking.location_name} (${booking.location_code})</td>
            <td>${startTime}<br>to<br>${endTime}</td>
            <td>${duration} hrs</td>
            <td>
                <span class="status-badge ${booking.status}">
                    ${booking.status.toUpperCase()}
                </span>
                ${booking.rejection_reason ? 
                 `<br><small>Reason: ${booking.rejection_reason}</small>` : ''}
            </td>
            <td>
                ${booking.status === 'pending' || booking.status === 'confirmed' ? 
                 `<button class="btn btn-cancel" 
                         onclick="openCancelModal('${booking.reservation_id}', '${booking.reference_number}')">
                  Cancel
                 </button>` : ''}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Utility Functions
function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds/60)} mins ago`;
    if (seconds < 86400) return `${Math.floor(seconds/3600)} hours ago`;
    return `${Math.floor(seconds/86400)} days ago`;
}

function showLoading(show, message = 'Loading...') {
    const loading = document.getElementById('loading-indicator');
    if (loading) {
        loading.textContent = message;
        loading.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    const error = document.getElementById('error-message');
    if (error) {
        error.textContent = message;
        error.style.display = 'block';
        setTimeout(() => error.style.display = 'none', 5000);
    }
}

function showSuccess(message) {
    const success = document.getElementById('success-message');
    if (success) {
        success.textContent = message;
        success.style.display = 'block';
        setTimeout(() => success.style.display = 'none', 5000);
    }
}