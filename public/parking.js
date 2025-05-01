document.addEventListener('DOMContentLoaded', async function() {
    // Get current user from localStorage
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Load user's vehicles and parking locations
    await Promise.all([
        loadUserVehicles(user.user_id),
        loadParkingLocations()
    ]);

    // Set up form submission
    document.getElementById('parking-form').addEventListener('submit', function(e) {
        e.preventDefault();
        calculateAndSubmit();
    });

    // Update price when duration changes
    document.getElementById('duration-select').addEventListener('change', updatePriceEstimate);
});

async function loadParkingLocations() {
    try {
        const response = await fetch('/api/parking/locations');
        if (!response.ok) throw new Error('Failed to load parking locations');
        
        const locations = await response.json();
        populateLocationDropdown(locations);
    } catch (error) {
        console.error('Error loading locations:', error);
        document.getElementById('location-select').innerHTML = `
            <option value="" disabled selected>Error loading locations</option>
        `;
    }
}

function populateLocationDropdown(locations) {
    const select = document.getElementById('location-select');
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

async function loadUserVehicles(userId) {
    try {
        const response = await fetch(`/api/vehicles?user_id=${userId}`);
        if (!response.ok) throw new Error('Failed to load vehicles');
        
        const vehicles = await response.json();
        populateVehicleDropdown(vehicles);
    } catch (error) {
        console.error('Error loading vehicles:', error);
        document.getElementById('vehicle-select').innerHTML = `
            <option value="" disabled selected>Error loading vehicles</option>
        `;
    }
}

function populateVehicleDropdown(vehicles) {
    const select = document.getElementById('vehicle-select');
    
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

    // Get hourly rate from selected location
    const locationId = locationSelect.value;
    const response = await fetch(`/api/parking/locations/${locationId}`);
    const location = await response.json();
    
    const duration = parseInt(durationSelect.value);
    const baseRate = location.hourly_rate;
    
    // Apply discounts
    let discount = 0;
    if (duration >= 24) discount = 0.2;  // 20% discount
    else if (duration >= 12) discount = 0.15;  // 15% discount
    else if (duration >= 8) discount = 0.1;  // 10% discount
    
    const totalCost = (baseRate * duration * (1 - discount)).toFixed(2);
    
    // Update hidden form fields
    document.getElementById('total-cost').value = totalCost;
}

function calculateAndSubmit() {
    const locationSelect = document.getElementById('location-select');
    const vehicleSelect = document.getElementById('vehicle-select');
    const durationSelect = document.getElementById('duration-select');
    
    if (!locationSelect.value || !vehicleSelect.value || !durationSelect.value) {
        alert('Please select all required options');
        return;
    }

    // Set hidden form values
    document.getElementById('location-id').value = locationSelect.value;
    document.getElementById('location-name').value = locationSelect.options[locationSelect.selectedIndex].text.split(' - ')[0];
    document.getElementById('vehicle-id').value = vehicleSelect.value;
    document.getElementById('vehicle-plate').value = vehicleSelect.options[vehicleSelect.selectedIndex].text;
    document.getElementById('duration').value = durationSelect.value;
    
    // Submit form
    document.getElementById('parking-form').submit();
}