document.addEventListener('DOMContentLoaded', async function() {
    // Load user data
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Display user info
    document.getElementById('userFullName').textContent = user.full_name;
    document.getElementById('userAccountNumber').textContent = user.user_id;

    // Initialize extend modal
    initExtendModal();

    // Load active parking session immediately
    await loadActiveParkingSession(user.user_id);

    // Refresh parking session every 5 seconds
    setInterval(async () => {
        await loadActiveParkingSession(user.user_id);
    }, 5000);
});

let currentSessionId = null;
let countdownInterval = null;
let currentSessionData = null;

// Initialize extend parking modal
function initExtendModal() {
    const modal = document.getElementById('extendModal');
    const closeBtn = document.querySelector('.modal-close');
    const extendBtn = document.getElementById('confirmExtend');
    const hoursInput = document.getElementById('extendHours');

    // Close modal when clicking X
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Handle extend confirmation
    extendBtn.addEventListener('click', async () => {
        const hours = parseInt(hoursInput.value);
        if (hours > 0 && hours <= 24) {
            await processExtension(hours);
            modal.style.display = 'none';
        } else {
            alert('Please enter a valid number of hours (1-24)');
        }
    });
}

async function loadActiveParkingSession(userId) {
    try {
        // Add cache-busting parameter to prevent stale data
        const response = await fetch(`/api/parking/sessions/active?user_id=${userId}&_=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch parking session');
        }

        const data = await response.json();
        
        if (data.activeSession) {
            // Only update if it's a new session or data has changed
            if (currentSessionId !== data.activeSession.reference_number) {
                currentSessionId = data.activeSession.reference_number;
                currentSessionData = data.activeSession;
                displayActiveSession(data.activeSession);
            }
        } else {
            currentSessionId = null;
            currentSessionData = null;
            clearActiveSessionDisplay();
        }
    } catch (error) {
        console.error('Error loading parking session:', error);
    }
}

function clearActiveSessionDisplay() {
    const activeSessionSection = document.querySelector('.active-session');
    if (activeSessionSection) {
        activeSessionSection.innerHTML = '';
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

function displayActiveSession(session) {
    const activeSessionSection = document.querySelector('.active-session');
    const startTime = new Date(session.time_in);
    const endTime = new Date(session.end_time);
    
    // Clear any existing countdown
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    activeSessionSection.innerHTML = `
        <div class="status-bar" data-session-id="${session.reference_number}">
            <div class="status-header">
                <h2 class="status-title">Current Parking</h2>
                <span class="status-active">ACTIVE</span>
            </div>
            
            <div class="status-details">
                <div class="detail-item">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${session.location_name} (${session.location_code})</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Spot</div>
                    <div class="detail-value">${session.space_number}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Started</div>
                    <div class="detail-value">${formatTime(startTime)}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Duration</div>
                    <div class="detail-value">${session.duration_hours} hours</div>
                </div>
            </div>
            
            <div class="timer-container">
                <div class="timer-label">Time Remaining:</div>
                <div class="timer" id="parkingTimer"></div>
            </div>
            
            <div class="action-buttons">
                <button class="btn btn-extend">Extend</button>
                <button class="btn btn-end">End</button>
            </div>
        </div>
    `;
    
    // Add event listeners
    document.querySelector('.btn-extend').addEventListener('click', () => showExtendModal(session));
    document.querySelector('.btn-end').addEventListener('click', () => endParking(session.reference_number));
    
    // Calculate remaining time in seconds
    const now = new Date();
    const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
    
    startCountdownTimer(remainingSeconds);
}

function showExtendModal(session) {
    const modal = document.getElementById('extendModal');
    const hoursInput = document.getElementById('extendHours');
    
    // Set default value to current duration
    hoursInput.value = session.duration_hours;
    
    // Show current location and spot in modal
    document.getElementById('extendLocation').textContent = 
        `${session.location_name} (${session.location_code}) - Spot ${session.space_number}`;
    
    // Show modal
    modal.style.display = 'block';
}

async function processExtension(hours) {
    try {
        const response = await fetch('/api/parking/sessions/extend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                reference_number: currentSessionData.reference_number,
                duration_hours: hours
            })
        });

        if (response.ok) {
            // Refresh the session data
            const user = JSON.parse(localStorage.getItem('user'));
            await loadActiveParkingSession(user.user_id);
            alert('Parking session extended successfully!');
        } else {
            const errorData = await response.json();
            alert(errorData.error || 'Failed to extend parking session');
        }
    } catch (error) {
        console.error('Error extending parking session:', error);
        alert('Error extending parking session. Please try again.');
    }
}

function formatTime(date) {
    return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    });
}

function startCountdownTimer(initialSeconds) {
    let remainingSeconds = initialSeconds;
    const timerElement = document.getElementById('parkingTimer');
    if (!timerElement) return;

    const updateTimer = () => {
        if (remainingSeconds <= 0) {
            clearInterval(countdownInterval);
            timerElement.textContent = "00:00:00";
            timerElement.className = "timer danger";
            
            // Show expired message
            const statusHeader = document.querySelector('.status-header');
            if (statusHeader) {
                const expiredElement = document.createElement('span');
                expiredElement.className = "status-expired";
                expiredElement.textContent = "EXPIRED";
                statusHeader.appendChild(expiredElement);
                
                // Remove active status if it exists
                const activeElement = document.querySelector('.status-active');
                if (activeElement) {
                    activeElement.remove();
                }
            }
            
            return;
        }

        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const seconds = remainingSeconds % 60;

        timerElement.textContent = 
            `${hours.toString().padStart(2, '0')}:` +
            `${minutes.toString().padStart(2, '0')}:` +
            `${seconds.toString().padStart(2, '0')}`;
        
        // Update color based on remaining time
        if (hours < 1) {
            timerElement.className = "timer danger";
        } else if (hours < 2) {
            timerElement.className = "timer warning";
        } else {
            timerElement.className = "timer";
        }

        remainingSeconds--;
    };

    // Update immediately
    updateTimer();
    
    // Update every second
    countdownInterval = setInterval(updateTimer, 1000);
}

async function endParking(referenceNumber) {
    if (confirm('Are you sure you want to end this parking session?')) {
        try {
            const response = await fetch(`/api/parking/sessions/${referenceNumber}/end`, {
                method: 'POST'
            });
            
            if (response.ok) {
                // Clear the current session display
                currentSessionId = null;
                currentSessionData = null;
                clearActiveSessionDisplay();
                
                // Show success message
                alert('Parking session ended successfully');
            } else {
                const errorData = await response.json();
                alert(errorData.error || 'Failed to end parking session');
            }
        } catch (error) {
            console.error('Error ending parking session:', error);
            alert('Error ending parking session. Please try again.');
        }
    }
}

// Handle page visibility changes to prevent timer drift
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && currentSessionId) {
        // When page becomes visible again, force a refresh
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            loadActiveParkingSession(user.user_id);
        }
    }
});