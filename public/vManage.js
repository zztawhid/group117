document.addEventListener('DOMContentLoaded', async function() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    await loadUserVehicles(currentUser.user_id);
    
    //event listeners
    document.getElementById('addVehicleBtn').addEventListener('click', showAddVehicleForm);
    document.getElementById('removeVehicleBtn').addEventListener('click', handleRemoveSelected);
    document.getElementById('viewHistoryBtn').addEventListener('click', viewParkingHistory);
    document.getElementById('downloadHistoryBtn').addEventListener('click', downloadHistory);
});

async function loadUserVehicles(userId) {
    try {
        const response = await fetch(`/api/vehicles?user_id=${userId}`);
        if (!response.ok) throw new Error('Failed to load vehicles');
        
        const vehicles = await response.json();
        displayVehicles(vehicles);
    } catch (error) {
        console.error('Error loading vehicles:', error);
        document.getElementById('vehicleList').innerHTML = 
            '<div class="error-msg">Failed to load vehicles. Please try again.</div>';
    }
}

function displayVehicles(vehicles) {
    const vehicleList = document.getElementById('vehicleList');
    
    if (vehicles.length === 0) {
        vehicleList.innerHTML = `
            <div class="no-vehicles">
                <p>You have no vehicles registered to your account. Add a vehicle below</p>
            </div>
        `;
        return;
    }

    vehicleList.innerHTML = vehicles.map(vehicle => `
        <div class="vehicle-box" data-vehicle-id="${vehicle.vehicle_id}">
            <div class="license-plate">${vehicle.license_plate}</div>
            <input type="checkbox" class="vehicle-checkbox" data-vehicle-id="${vehicle.vehicle_id}">
        </div>
    `).join('');

    //click handler to select vehicles
    document.querySelectorAll('.vehicle-box').forEach(box => {
        box.addEventListener('click', function(e) {
            if (!e.target.classList.contains('vehicle-checkbox')) {
                const checkbox = this.querySelector('.vehicle-checkbox');
                checkbox.checked = !checkbox.checked;
                this.classList.toggle('selected', checkbox.checked);
            }
        });
    });
}

function showAddVehicleForm() {
    const formHtml = `
        <div class="add-vehicle-form">
            <h3>Add New Vehicle</h3>
            <input type="text" id="licensePlateInput" placeholder="Enter license plate" required>
            <div class="form-buttons">
                <button class="vbtnG" id="confirmAddVehicle">Add</button>
                <button class="vbtnR" id="cancelAddVehicle">Cancel</button>
            </div>
        </div>
    `;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = formHtml;
    document.body.appendChild(overlay);

    document.getElementById('confirmAddVehicle').addEventListener('click', async () => {
        const licensePlate = document.getElementById('licensePlateInput').value.trim();
        if (licensePlate) {
            await addVehicle(licensePlate);
            overlay.remove();
        }
    });

    document.getElementById('cancelAddVehicle').addEventListener('click', () => {
        overlay.remove();
    });
}

async function addVehicle(licensePlate) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const response = await fetch('/api/vehicles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: user.user_id,
                license_plate: licensePlate
            })
        });
        
        if (!response.ok) throw new Error('Failed to add vehicle');
        await loadUserVehicles(user.user_id);
    } catch (error) {
        alert('Error adding vehicle: ' + error.message);
    }
}

async function handleRemoveSelected() {
    const selected = Array.from(document.querySelectorAll('.vehicle-checkbox:checked'))
        .map(checkbox => checkbox.dataset.vehicleId);
    
    if (selected.length === 0) {
        alert('Please select at least one vehicle to remove');
        return;
    }

    if (!confirm(`Are you sure you want to remove ${selected.length} vehicle(s)?`)) return;
    
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        await Promise.all(selected.map(id => 
            fetch(`/api/vehicles/${id}`, { method: 'DELETE' })
        ));
        await loadUserVehicles(user.user_id);
    } catch (error) {
        alert('Error removing vehicles: ' + error.message);
    }
}

function viewParkingHistory() {
    alert('');
}

function downloadHistory() {
    alert('');
}