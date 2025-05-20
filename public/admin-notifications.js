let parkingChart = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    initEventListeners();
    loadDashboardData();
});

function checkAdminAuth() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    if (user.user_type !== 'admin') {
        window.location.href = 'main.html';
        return;
    }
}


function initEventListeners() {
    // Remove existing click handlers from quick actions
    document.querySelectorAll('.quick-action[onclick*="openBookingsModal"]').forEach(btn => {
        btn.onclick = null; // Remove existing onclick handler
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            openBookingsModal();
            loadAdvancedBookings();
        });
    });

    // Modal buttons
    document.getElementById('confirm-send-broadcast')?.addEventListener('click', sendBroadcast);
}

async function loadDashboardData() {
    try {
        showLoading(true, 'Loading dashboard data...');
        
        await Promise.all([
            loadParkingData(),
            loadSystemStats(),
            loadRecentBookings(),
            loadNotifications()
        ]);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    } finally {
        showLoading(false);
    }
}

async function loadSystemStats() {
    try {
        const response = await fetch('/api/admin/locations/status');
        if (!response.ok) throw new Error('Failed to load system stats');
        
        const locations = await response.json();
        
        // Update overview stats
        document.getElementById('total-locations').textContent = locations.length;
        
        const totalSpaces = locations.reduce((sum, loc) => sum + loc.total_spaces, 0);
        document.getElementById('total-spaces').textContent = totalSpaces;
        
        // Estimate active sessions as total spaces minus available spaces
        const activeSessions = locations.reduce((sum, loc) => 
            sum + (loc.total_spaces - loc.available_spaces), 0);
        
        document.getElementById('active-sessions').textContent = activeSessions;
        
    } catch (error) {
        console.error('Error loading system stats:', error);
        document.getElementById('active-sessions').textContent = 'N/A';
        throw error;
    }
}
async function loadParkingData() {
    try {
        const response = await fetch('/api/admin/locations/status');
        if (!response.ok) throw new Error('Failed to load parking data');
        
        const locations = await response.json();
        renderParkingChart(locations);
        renderLocationsTable(locations);
    } catch (error) {
        console.error('Error loading parking data:', error);
        showError('Failed to load parking availability data');
    }
}

function renderParkingChart(locations) {
    const ctx = document.getElementById('parkingChart');
    if (!ctx) return;
    
    // Calculate totals
    let totalSpaces = 0;
    let occupiedSpaces = 0;
    let disabledSpaces = 0;
    
    locations.forEach(location => {
        totalSpaces += location.total_spaces;
        occupiedSpaces += (location.total_spaces - location.available_spaces);
        if (location.disabled) disabledSpaces += location.total_spaces;
    });
    
    const availableSpaces = totalSpaces - occupiedSpaces - disabledSpaces;
    
    // Destroy previous chart if exists
    if (parkingChart) {
        parkingChart.destroy();
    }
    
    parkingChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Occupied', 'Available', 'Closed/Maintenance'],
            datasets: [{
                data: [occupiedSpaces, availableSpaces, disabledSpaces],
                backgroundColor: [
                    '#e74c3c',
                    '#2ecc71',
                    '#3498db'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const percentage = Math.round((value / totalSpaces) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderLocationsTable(locations) {
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
        
        if (location.disabled) {
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

async function loadRecentBookings() {
    try {
        const response = await fetch('/api/admin/bookings?limit=5');
        if (!response.ok) throw new Error('Failed to load recent bookings');
        
        const bookings = await response.json();
        renderRecentBookings(bookings);
    } catch (error) {
        console.error('Error loading recent bookings:', error);
        showError('Failed to load recent bookings');
    }
}

function renderRecentBookings(bookings) {
    const tbody = document.getElementById('recent-bookings-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No recent bookings found</td></tr>';
        return;
    }
    
    bookings.forEach(booking => {
        const row = document.createElement('tr');
        const startTime = new Date(booking.start_time).toLocaleString();
        
        row.innerHTML = `
            <td>${booking.reference_number || 'N/A'}</td>
            <td>${booking.user_name}</td>
            <td>${booking.location_name}</td>
            <td>${startTime}</td>
            <td>
                <span class="status-badge ${booking.status}">
                    ${booking.status.toUpperCase()}
                </span>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications?limit=5');
        if (!response.ok) throw new Error('Failed to load notifications');
        
        const notifications = await response.json();
        renderNotifications(notifications);
    } catch (error) {
        console.error('Error loading notifications:', error);
        showError('Failed to load notifications');
    }
}

function renderNotifications(notifications) {
    const container = document.getElementById('notifications-list');
    if (!container) return;
    
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No new notifications</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    notifications.forEach(notification => {
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
        
        container.appendChild(item);
    });
}




// Broadcast Management
function showBroadcastModal() {
    const modal = document.getElementById('broadcast-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeBroadcastModal() {
    const modal = document.getElementById('broadcast-modal');
    if (modal) modal.classList.add('hidden');
}

async function sendBroadcast() {
    const title = document.getElementById('broadcast-title').value;
    const message = document.getElementById('broadcast-message').value;
    const isUrgent = document.getElementById('urgent-broadcast').checked;
    
    if (!title || !message) {
        showError('Please fill all required fields');
        return;
    }
    
    try {
        showLoading(true, 'Sending broadcast...');
        
        const response = await fetch('/api/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: isUrgent ? `URGENT: ${title}` : title,
                message,
                broadcast: true
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send broadcast');
        }
        
        showSuccess('Broadcast sent successfully');
        closeBroadcastModal();
        loadNotifications();
        
    } catch (error) {
        console.error('Error sending broadcast:', error);
        showError('Failed to send broadcast');
    } finally {
        showLoading(false);
    }
}

// Report Generation
async function generateSystemReport() {
    try {
        showLoading(true, 'Generating report...');
        
        setTimeout(() => {
            showSuccess('Report generated successfully');
            alert('System report generated. In a real implementation, this would download a PDF or CSV file.');
        }, 1500);
        
    } catch (error) {
        console.error('Error generating report:', error);
        showError('Failed to generate report');
    } finally {
        showLoading(false);
    }
}

// Bookings Management
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
        
        await loadAdvancedBookings();
        showSuccess('Booking accepted successfully');
    } catch (error) {
        console.error('Error accepting booking:', error);
        showError(error.message || 'Failed to accept booking');
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