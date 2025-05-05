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

    // Load active parking session immediately
    await loadActiveParkingSession(user.user_id);

    // Refresh parking session every 5 seconds
    setInterval(async () => {
        await loadActiveParkingSession(user.user_id);
    }, 5000);
});

let currentSessionId = null;
let countdownInterval = null;

async function loadActiveParkingSession(userId) {
    try {
        // Add cache-busting parameter to prevent stale data
        const response = await fetch(`/api/parking/sessions/active?user_id=${userId}&_=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch parking session');
        }

        const data = await response.json();
        
        if (data.activeSession) {
            // Only update if it's a new session
            if (currentSessionId !== data.activeSession.reference_number) {
                currentSessionId = data.activeSession.reference_number;
                displayActiveSession(data.activeSession);
            }
        } else {
            currentSessionId = null;
        }
    } catch (error) {
        console.error('Error loading parking session:', error);
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
                    <div class="detail-value">${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
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
    document.querySelector('.btn-extend').addEventListener('click', () => extendParking(session.reference_number));
    document.querySelector('.btn-end').addEventListener('click', () => endParking(session.reference_number));
    
    // Calculate remaining time in seconds
    const now = new Date();
    const endTime = new Date(now.getTime() + (session.duration_hours * 60 * 60 * 1000));
    const remainingSeconds = Math.floor((endTime - now) / 1000);
    
    startCountdownTimer(remainingSeconds);
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

async function extendParking(referenceNumber) {
    window.location.href = `parking.html?extend=${referenceNumber}`;
}

async function endParking(referenceNumber) {
    if (confirm('Are you sure you want to end this parking session?')) {
        try {
            const response = await fetch(`/api/parking/sessions/${referenceNumber}/end`, {
                method: 'POST'
            });
            
            if (response.ok) {
                // Force a refresh to get updated status
                await loadActiveParkingSession(JSON.parse(localStorage.getItem('user')).user_id);
            } else {
                alert('Failed to end parking session');
            }
        } catch (error) {
            console.error('Error ending parking session:', error);
            alert('Error ending parking session');
        }
    }
}

