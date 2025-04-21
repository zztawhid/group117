document.addEventListener('DOMContentLoaded', async function() {
    // Get current user from localStorage
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Load user's vehicles
    await loadUserVehicles(user.user_id);
});

async function loadUserVehicles(userId) {
    try {
        const response = await fetch(`/api/vehicles?user_id=${userId}`);
        if (!response.ok) throw new Error('Failed to load vehicles');
        
        const vehicles = await response.json();
        populateVehicleDropdown(vehicles);
    } catch (error) {
        console.error('Error loading vehicles:', error);
        // Show error message or default option
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

    // Clear existing options (keeping the first "Select" option)
    select.innerHTML = '<option value="" disabled selected>Select your vehicle</option>';
    
    // Add vehicles
    vehicles.forEach(vehicle => {
        const option = document.createElement('option');
        option.value = vehicle.vehicle_id;
        option.textContent = vehicle.license_plate;
        select.appendChild(option);
    });

}