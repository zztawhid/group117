document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    setupBookingButton();
    loadParkingLocations();
    loadNotifications();
});

// Parking Locations Functions
async function loadParkingLocations() {
    try {
        showLoading(true, 'Loading parking availability...');
        const response = await fetch('/api/parking/locations');
        if (!response.ok) throw new Error('Failed to load locations');
        
        const locations = await response.json();
        renderParkingLocations(locations);
    } catch (error) {
        console.error('Error loading locations:', error);
        showError('Failed to load parking availability');
    } finally {
        showLoading(false);
    }
}

function renderParkingLocations(locations) {
    const tbody = document.getElementById('locations-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    locations.forEach(location => {
        const row = document.createElement('tr');
        const occupied = location.total_spaces - location.available_spaces;
        const occupancyPercentage = Math.round((occupied / location.total_spaces) * 100);
        
        // Determine status badge class
        let statusClass = 'open';
        let statusText = 'Open';
        
        if (location.available_spaces === 0) {
            statusClass = 'full';
            statusText = 'Full';
        } else if (location.disabled) {
            if (location.disabled_reason?.includes('Maintenance')) {
                statusClass = 'maintenance';
                statusText = 'Maintenance';
            } else if (location.disabled_reason?.includes('Event')) {
                statusClass = 'event';
                statusText = 'Event Only';
            } else {
                statusClass = 'closed';
                statusText = 'Closed';
            }
        }
        
        row.innerHTML = `
            <td><strong>${location.name}</strong><br><small>${location.code}</small></td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>
                ${location.disabled_reason ? `<br><small>${location.disabled_reason}</small>` : ''}
            </td>
            <td>
                ${location.available_spaces}/${location.total_spaces} spaces
                <div class="progress">
                    <div class="progress-bar" style="width: ${occupancyPercentage}%; background: ${occupancyPercentage > 80 ? '#e74c3c' : occupancyPercentage > 50 ? '#f39c12' : '#2ecc71'};"></div>
                </div>
                <small>${occupancyPercentage}% occupied</small>
            </td>
        `;
        
        tbody.appendChild(row);
    });
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
                const item = document.createElement('div');
                item.className = 'notification-item';
                
                item.innerHTML = `
                    <div class="notification-icon">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="notification-content">
                        <strong>${notification.title}</strong>
                        <p>${notification.message}</p>
                        <div class="notification-time">
                            ${new Date(notification.created_at).toLocaleString()}
                        </div>
                    </div>
                `;
                
                notificationsList.appendChild(item);
            });
        }

        // Check for upcoming bookings
        const now = new Date();
        const upcomingBookings = bookings.filter(booking => new Date(booking.start_time) > now);
        if (upcomingBookings.length > 0) {
            upcomingBookings.forEach(booking => {
                const item = document.createElement('div');
                item.className = 'notification-item';
                
                const startTime = new Date(booking.start_time).toLocaleString();
                item.innerHTML = `
                    <div class="notification-icon">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="notification-content">
                        <strong>Upcoming Booking</strong>
                        <p>${booking.location_name} (${booking.location_code}) on ${startTime}</p>
                    </div>
                `;
                
                notificationsList.appendChild(item);
            });
        }

        // Check for nearly ending active session
        if (activeSession && activeSession.end_time) {
            const endTime = new Date(activeSession.end_time);
            const timeRemaining = Math.floor((endTime - now) / (1000 * 60)); // Time remaining in minutes
            if (timeRemaining > 0 && timeRemaining <= 30) {
                const item = document.createElement('div');
                item.className = 'notification-item';
                
                item.innerHTML = `
                    <div class="notification-icon">
                        <i class="fas fa-hourglass-end"></i>
                    </div>
                    <div class="notification-content">
                        <strong>Session Ending Soon</strong>
                        <p>Your parking session at ${activeSession.location_name} (${activeSession.location_code}) is ending in ${timeRemaining} minutes.</p>
                    </div>
                `;
                
                notificationsList.appendChild(item);
            }
        }

        // If no notifications, show a default message
        if (notificationsList.children.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <i class="fas fa-bell-slash"></i>
                <p>No new notifications</p>
            `;
            notificationsList.appendChild(emptyState);
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        const notificationsList = document.getElementById('notifications-list');
        if (notificationsList) {
            notificationsList.innerHTML = '<div class="notification-item">Failed to load notifications. Please try again later.</div>';
        }
    }
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

// Cancel Booking Modal Functions
function openCancelModal(reservationId, referenceNumber) {
    currentBookingToCancel = reservationId;
    const modal = document.getElementById('cancel-booking-modal');
    if (modal) {
        document.getElementById('cancel-ref-number').textContent = referenceNumber;
        modal.classList.remove('hidden');
    }
}

function closeCancelModal() {
    const modal = document.getElementById('cancel-booking-modal');
    if (modal) modal.classList.add('hidden');
    currentBookingToCancel = null;
}

async function confirmCancelBooking() {
    if (!currentBookingToCancel) return;

    const reason = document.getElementById('cancel-reason').value;
    if (!reason) {
        alert('Please provide a reason for cancellation');
        return;
    }

    try {
        showLoading(true, 'Cancelling booking...');
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) throw new Error('User not logged in');

        const response = await fetch(`/api/user/bookings/${currentBookingToCancel}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reason: reason,
                user_id: user.user_id
            })
        });

        if (!response.ok) throw new Error('Failed to cancel booking');

        // Refresh the bookings list
        await loadUserBookings();
        closeCancelModal();
        showSuccess('Booking cancelled successfully');
    } catch (error) {
        console.error('Error cancelling booking:', error);
        showError(error.message || 'Failed to cancel booking');
    } finally {
        showLoading(false);
    }
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