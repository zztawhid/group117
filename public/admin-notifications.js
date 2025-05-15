document.addEventListener('DOMContentLoaded', function() {
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
    
    // Get the button element
    const manageBookingsBtn = document.getElementById('advanced-booking-btn');
    
    if (manageBookingsBtn) {
        manageBookingsBtn.addEventListener('click', function() {
            openBookingsModal();
            loadAdvancedBookings();
        });
    }
});

let currentBookingToReject = null;

function openBookingsModal() {
    const modal = document.getElementById('bookings-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeBookingsModal() {
    const modal = document.getElementById('bookings-modal');
    if (modal) modal.classList.add('hidden');
}

function openRejectModal(bookingId, reference) {
    const rejectRef = document.getElementById('reject-ref');
    const rejectModal = document.getElementById('reject-modal');
    
    if (rejectRef && rejectModal) {
        currentBookingToReject = bookingId;
        rejectRef.textContent = reference;
        rejectModal.classList.remove('hidden');
    }
}

function closeRejectModal() {
    const rejectModal = document.getElementById('reject-modal');
    if (rejectModal) {
        rejectModal.classList.add('hidden');
        document.getElementById('reject-reason').value = '';
        currentBookingToReject = null;
    }
}

async function loadAdvancedBookings() {
    try {
        showLoading(true);
        const response = await fetch('/api/admin/bookings');
        if (!response.ok) throw new Error('Failed to load bookings');
        
        const bookings = await response.json();
        renderBookings(bookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
        showError('Failed to load bookings. Please try again.');
    } finally {
        showLoading(false);
    }
}

function renderBookings(bookings) {
    const tbody = document.getElementById('bookings-list');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">No upcoming bookings found</td></tr>';
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
            <td>${booking.user_name}</td>
            <td>${booking.license_plate}</td>
            <td>${booking.location_name} (${booking.location_code})</td>
            <td>${startTime}<br>to<br>${endTime}</td>
            <td>${duration} hrs</td>
            <td>
                <span class="status-badge ${booking.status}">
                    ${booking.status.toUpperCase()}
                </span>
                ${booking.processed_by_name ? 
                 `<br><small>By ${booking.processed_by_name}</small>` : ''}
            </td>
            <td>
                ${booking.status === 'pending' ? 
                 `<div class="action-buttons">
                    <button class="btn btn-accept" 
                            onclick="confirmAccept('${booking.reservation_id}')">
                        Accept
                    </button>
                    <button class="btn btn-reject" 
                            onclick="openRejectModal('${booking.reservation_id}', '${booking.reference_number}')">
                        Reject
                    </button>
                  </div>` : 
                 booking.rejection_reason ? 
                 `<small>Reason: ${booking.rejection_reason}</small>` : ''}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function confirmReject() {
    if (!currentBookingToReject) return;
    
    const reason = document.getElementById('reject-reason').value;
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user) {
        showError('You must be logged in to perform this action');
        return;
    }
    
    try {
        showLoading(true, 'Processing rejection...');
        const response = await fetch(`/api/admin/bookings/${currentBookingToReject}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                reason,
                admin_id: user.user_id 
            })
        });
        
        if (!response.ok) throw new Error('Failed to reject booking');
        
        // Refresh the bookings list
        await loadAdvancedBookings();
        closeRejectModal();
        showSuccess('Booking rejected successfully');
    } catch (error) {
        console.error('Error rejecting booking:', error);
        showError(error.message || 'Failed to reject booking');
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


//Accept button
async function confirmAccept(bookingId) {
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user) {
        showError('You must be logged in to perform this action');
        return;
    }
    
    try {
        showLoading(true, 'Processing acceptance...');
        const response = await fetch(`/api/admin/bookings/${bookingId}/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                admin_id: user.user_id 
            })
        });
        
        if (!response.ok) throw new Error('Failed to accept booking');
        
        // Refresh the bookings list
        await loadAdvancedBookings();
        showSuccess('Booking accepted successfully');
    } catch (error) {
        console.error('Error accepting booking:', error);
        showError(error.message || 'Failed to accept booking');
    } finally {
        showLoading(false);
    }
}
