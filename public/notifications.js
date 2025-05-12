document.addEventListener('DOMContentLoaded', function() {
    // Fix the button ID selector (remove # from HTML id attribute)
    const bookingsBtn = document.getElementById('advanced-booking-btn');
    
    if (bookingsBtn) {
        bookingsBtn.addEventListener('click', function() {
            openUserBookingsModal();
            loadUserBookings();
        });
    }
});

let currentBookingToCancel = null;

function openUserBookingsModal() {
    const modal = document.getElementById('user-bookings-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeUserBookingsModal() {
    const modal = document.getElementById('user-bookings-modal');
    if (modal) modal.classList.add('hidden');
}

function openCancelModal(bookingId, reference) {
    const cancelRef = document.getElementById('cancel-ref');
    const cancelModal = document.getElementById('cancel-booking-modal');
    
    if (cancelRef && cancelModal) {
        currentBookingToCancel = bookingId;
        cancelRef.textContent = reference;
        cancelModal.classList.remove('hidden');
    }
}

function closeCancelModal() {
    const cancelModal = document.getElementById('cancel-booking-modal');
    if (cancelModal) {
        cancelModal.classList.add('hidden');
        document.getElementById('cancel-reason').value = '';
        currentBookingToCancel = null;
    }
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

async function confirmCancel() {
    if (!currentBookingToCancel) return;
    
    const reason = document.getElementById('cancel-reason').value;
    const user = JSON.parse(localStorage.getItem('user'));
    
    try {
        showLoading(true, 'Cancelling booking...');
        const response = await fetch(`/api/user/bookings/${currentBookingToCancel}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                reason,
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

// Utility functions
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