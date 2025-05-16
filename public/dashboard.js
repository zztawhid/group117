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

    // Add card formatting
    document.getElementById('card-number')?.addEventListener('input', formatCardNumber);
    document.getElementById('card-expiry')?.addEventListener('input', formatCardExpiry);
    document.getElementById('card-cvv')?.addEventListener('input', formatCardCvv);
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

    if (!modal || !closeBtn || !extendBtn || !hoursInput) return;

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
        } else {
            showError('Please enter a valid number of hours (1-24)');
        }
    });
}

async function loadActiveParkingSession(userId) {
    try {
        // cache-busting parameter to prevent stale data
        const response = await fetch(`/api/parking/sessions/active?user_id=${userId}&_=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch parking session');
        }

        const data = await response.json();
        
        if (data.activeSession) {
            // update if it's a new session or data has changed
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
        showError('Failed to load parking session. Please try again.');
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
    
    // Calculate end time based on duration_hours
    const endTime = new Date(startTime.getTime() + (session.duration_hours * 60 * 60 * 1000));
    
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
                    <div class="detail-value">${session.space_number || 'Not assigned'}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Started</div>
                    <div class="detail-value">${formatTime(startTime)}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Total Duration</div>
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
    document.querySelector('.btn-extend')?.addEventListener('click', () => showExtendModal(session));
    document.querySelector('.btn-end')?.addEventListener('click', () => endParking(session.reference_number));
    
    // Start countdown timer
    const now = new Date();
    const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
    startCountdownTimer(remainingSeconds);
}

function showExtendModal(session) {
    const modal = document.getElementById('extendModal');
    const hoursInput = document.getElementById('extendHours');
    
    if (!modal || !hoursInput) return;
    
    // Reset form
    hoursInput.value = 1;
    document.getElementById('card-name').value = '';
    document.getElementById('card-number').value = '';
    document.getElementById('card-expiry').value = '';
    document.getElementById('card-cvv').value = '';
    
    // Show current location and spot in modal
    document.getElementById('extendLocation').textContent = 
        `${session.location_name} (${session.location_code}) - Spot ${session.space_number || 'Not assigned'}`;
    
    // Show modal
    modal.style.display = 'block';
}

async function processExtension(hours) {
    try {
        const cardName = document.getElementById('card-name').value.trim();
        const cardNumber = document.getElementById('card-number').value.replace(/\s/g, '');
        const cardExpiry = document.getElementById('card-expiry').value.trim();
        const cardCvv = document.getElementById('card-cvv').value.trim();
        
        // Validate inputs
        if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
            showError('Please fill in all card details');
            return;
        }

        if (!hours || hours < 1 || hours > 24) {
            showError('Please enter a valid duration (1-24 hours)');
            return;
        }
        
        if (!cardName) {
            showError('Please enter the name on card');
            return;
        }
        
        if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
            showError('Please enter a valid 16-digit card number');
            return;
        }
        
        if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
            showError('Please enter a valid expiry date (MM/YY)');
            return;
        }
        
        if (!cardCvv || cardCvv.length < 3) {
            showError('Please enter a valid CVV (3-4 digits)');
            return;
        }

        showLoading(true, 'Processing extension...');
        
        const response = await fetch('/api/parking/sessions/extend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                reference_number: currentSessionData.reference_number,
                additional_hours: hours,  // Changed from duration_hours
                card_number: cardNumber,
                card_expiry: cardExpiry,
                card_cvv: cardCvv,
                card_name: cardName
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to extend parking session');
        }

        const result = await response.json();
        
        // Close modal
        document.getElementById('extendModal').style.display = 'none';
        
        // Refresh the session data
        const user = JSON.parse(localStorage.getItem('user'));
        await loadActiveParkingSession(user.user_id);
        
        showSuccess(`Parking extended successfully! Added ${hours} hour(s)`);
    } catch (error) {
        console.error('Error extending parking session:', error);
        showError(error.message || 'Failed to extend parking session');
    } finally {
        showLoading(false);
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
            showLoading(true, 'Ending parking session...');
            const response = await fetch(`/api/parking/sessions/${referenceNumber}/end`, {
                method: 'POST'
            });
            
            if (response.ok) {
                // Clear the current session display
                currentSessionId = null;
                currentSessionData = null;
                clearActiveSessionDisplay();
                
                // Show success message
                showSuccess('Parking session ended successfully');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to end parking session');
            }
        } catch (error) {
            console.error('Error ending parking session:', error);
            showError(error.message || 'Failed to end parking session');
        } finally {
            showLoading(false);
        }
    }
}

// Card formatting functions
function formatCardNumber(e) {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = '';
    
    for (let i = 0; i < value.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += value[i];
    }
    
    e.target.value = formatted;
}

function formatCardExpiry(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length > 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    
    e.target.value = value;
}

function formatCardCvv(e) {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
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