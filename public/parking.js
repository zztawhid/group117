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