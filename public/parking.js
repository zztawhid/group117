document.addEventListener('DOMContentLoaded', async function() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Check for active session first
    const hasActiveSession = await checkActiveSession(user.user_id);
    if (hasActiveSession) {
        showActiveSessionWarning();
        disableBookingForms();
        return;
    }

    // Rest of your existing initialization code...
    flatpickr("#start-time", {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        minDate: "today",
        time_24hr: true
    });

    await Promise.all([
        loadUserVehicles(user.user_id),
        loadParkingLocations(),
        loadUserVehicles(user.user_id, 'later'),
        loadParkingLocations('later')
    ]);

    // Set up form submissions
    document.getElementById('parking-form-now').addEventListener('submit', function(e) {
        e.preventDefault();
        calculateAndSubmit('now');
    });

    document.getElementById('disabled-bay-now').addEventListener('change', function() {
        document.getElementById('needs-disabled').value = this.checked;
    });

    document.getElementById('disabled-bay-later').addEventListener('change', function() {
        // Handled in checkAvailability function
    });

    // Update price when duration changes
    document.getElementById('duration-select').addEventListener('change', updatePriceEstimate);
    document.getElementById('duration-select-later').addEventListener('change', function() {
        // Handled in checkAvailability function
    });

    // Set up advanced booking
    document.getElementById('check-availability-btn').addEventListener('click', checkAvailability);
    document.getElementById('book-now-btn').addEventListener('click', bookAdvancedParking);
});

function openTab(tabName) {
    const tabs = document.getElementsByClassName('tab-content');
    for (let tab of tabs) {
        tab.classList.remove('active-tab');
    }
    
    const tabButtons = document.getElementsByClassName('tab-button');
    for (let button of tabButtons) {
        button.classList.remove('active');
    }
    
    document.getElementById(`${tabName}-tab`).classList.add('active-tab');
    event.currentTarget.classList.add('active');
}

async function loadParkingLocations(tab = 'now') {
    try {
        const response = await fetch('/api/parking/locations');
        if (!response.ok) throw new Error('Failed to load parking locations');
        
        const locations = await response.json();
        populateLocationDropdown(locations, tab);
    } catch (error) {
        console.error('Error loading locations:', error);
        const selectId = tab === 'now' ? 'location-select' : 'location-select-later';
        document.getElementById(selectId).innerHTML = `
            <option value="" disabled selected>Error loading locations</option>
        `;
    }
}

function populateLocationDropdown(locations, tab = 'now') {
    const selectId = tab === 'now' ? 'location-select' : 'location-select-later';
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="" disabled selected>Select location</option>';
    
    locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.location_id;
        option.textContent = `${loc.name} (${loc.code})`;
        if (loc.disabled) {
            option.disabled = true;
            option.textContent += ' - Temporarily unavailable';
        }
        select.appendChild(option);
    });
}

async function loadUserVehicles(userId, tab = 'now') {
    try {
        const response = await fetch(`/api/vehicles?user_id=${userId}`);
        if (!response.ok) throw new Error('Failed to load vehicles');
        
        const vehicles = await response.json();
        populateVehicleDropdown(vehicles, tab);
    } catch (error) {
        console.error('Error loading vehicles:', error);
        const selectId = tab === 'now' ? 'vehicle-select' : 'vehicle-select-later';
        document.getElementById(selectId).innerHTML = `
            <option value="" disabled selected>Error loading vehicles</option>
        `;
    }
}

function populateVehicleDropdown(vehicles, tab = 'now') {
    const selectId = tab === 'now' ? 'vehicle-select' : 'vehicle-select-later';
    const select = document.getElementById(selectId);
    
    if (vehicles.length === 0) {
        select.innerHTML = `
            <option value="" disabled selected>No vehicles registered</option>
        `;
        return;
    }

    select.innerHTML = '<option value="" disabled selected>Select your vehicle</option>';
    
    vehicles.forEach(vehicle => {
        const option = document.createElement('option');
        option.value = vehicle.vehicle_id;
        option.textContent = vehicle.license_plate;
        select.appendChild(option);
    });
}

async function updatePriceEstimate() {
    const locationSelect = document.getElementById('location-select');
    const durationSelect = document.getElementById('duration-select');
    
    if (!locationSelect.value || !durationSelect.value) return;

    const locationId = locationSelect.value;
    const response = await fetch(`/api/parking/locations/${locationId}`);
    const location = await response.json();
    
    const duration = parseInt(durationSelect.value);
    const baseRate = location.hourly_rate;
    
    let discount = 0;
    if (duration >= 24) discount = 0.2;
    else if (duration >= 12) discount = 0.15;
    else if (duration >= 8) discount = 0.1;
    
    const totalCost = (baseRate * duration * (1 - discount)).toFixed(2);
    
    document.getElementById('total-cost').value = totalCost;
}

function calculateAndSubmit(tab = 'now') {
    const locationSelect = document.getElementById(tab === 'now' ? 'location-select' : 'location-select-later');
    const vehicleSelect = document.getElementById(tab === 'now' ? 'vehicle-select' : 'vehicle-select-later');
    const durationSelect = document.getElementById(tab === 'now' ? 'duration-select' : 'duration-select-later');
    
    if (!locationSelect.value || !vehicleSelect.value || !durationSelect.value) {
        alert('Please select all required options');
        return;
    }

    // Set hidden form values
    const form = document.getElementById('parking-form-now');
    form.querySelector('#location-id').value = locationSelect.value;
    form.querySelector('#location-name').value = locationSelect.options[locationSelect.selectedIndex].text.split(' - ')[0];
    form.querySelector('#vehicle-id').value = vehicleSelect.value;
    form.querySelector('#vehicle-plate').value = vehicleSelect.options[vehicleSelect.selectedIndex].text;
    form.querySelector('#duration').value = durationSelect.value;
    
    // Submit form
    form.submit();
}

async function checkAvailability() {
    const locationId = document.getElementById('location-select-later').value;
    const vehicleId = document.getElementById('vehicle-select-later').value;
    const startTime = document.getElementById('start-time').value;
    const duration = document.getElementById('duration-select-later').value;
    const needsDisabled = document.getElementById('disabled-bay-later').checked;
    
    if (!locationId || !vehicleId || !startTime || !duration) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const user = JSON.parse(localStorage.getItem('user'));
        
        const response = await fetch('/api/parking/reservations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: user.user_id,
                vehicle_id: vehicleId,
                location_id: locationId,
                start_time: startTime,
                duration_hours: duration,
                needs_disabled: needsDisabled
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to check availability');
        }
        
        const reservation = await response.json();
        
        // Display reservation details
        document.getElementById('space-number').textContent = reservation.space_number || 'Not assigned';
        
        const start = new Date(reservation.start_time).toLocaleString();
        const end = new Date(reservation.end_time).toLocaleString();
        document.getElementById('reservation-time').textContent = `${start} to ${end}`;
        
        document.getElementById('reservation-total').textContent = `£${reservation.total_cost}`;
        
        // Store reservation details for booking
        document.getElementById('book-now-btn').dataset.reservationId = reservation.reservation_id;
        document.getElementById('book-now-btn').dataset.totalCost = reservation.total_cost;
        
        document.getElementById('availability-result').classList.remove('hidden');
        
    } catch (error) {
        console.error('Availability check error:', error);
        alert(error.message || 'Failed to check availability');
    }
}

async function bookAdvancedParking() {
    const reservationId = this.dataset.reservationId;
    const totalCost = this.dataset.totalCost;
    
    if (!reservationId) {
        alert('No reservation selected');
        return;
    }

    // Redirect to payment page with reservation details
    window.location.href = `payment.html?reservation_id=${reservationId}&total_cost=${totalCost}&type=reservation`;
}

async function checkActiveSession(userId) {
    try {
        const response = await fetch(`/api/parking/sessions/active?user_id=${userId}`);
        if (!response.ok) throw new Error('Failed to check active session');
        
        const data = await response.json();
        return !!data.activeSession;
    } catch (error) {
        console.error('Error checking active session:', error);
        return false;
    }
}

function showActiveSessionWarning() {
    const paymentForm = document.querySelector('.payment-form');
    const heading = document.querySelector('.payment-form h2');
    
    const warningHTML = `
        <div class="active-session-warning">
            <div class="warning-content">
                <h3>You already have an active parking session</h3>
                <p>You cannot book another parking session while you have an active one.</p>
                <p>Please end your current session before booking a new one.</p>
                <a href="main.html" class="btn btn-view-session">View Current Session</a>
            </div>
        </div>
    `;
    
    // Insert the warning after the heading instead of at the beginning
    heading.insertAdjacentHTML('afterend', warningHTML);
    document.querySelector('.tab-container').style.display = 'none';
}

function disableBookingForms() {
    // Disable all form elements
    const formElements = document.querySelectorAll('select, input, button');
    formElements.forEach(element => {
        element.disabled = true;
    });
    
    // Hide the booking tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
}