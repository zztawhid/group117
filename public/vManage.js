document.addEventListener('DOMContentLoaded', async function() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    await loadUserVehicles(currentUser.user_id);
    
    // Event listeners
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
        
        // Disable add button if user has 4 vehicles
        if (vehicles.length >= 4) {
            document.getElementById('addVehicleBtn').disabled = true;
            document.getElementById('addVehicleBtn').textContent = 'Maximum vehicles reached';
        }
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

    // Click handler to select vehicles
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
    const user = JSON.parse(localStorage.getItem('user'));
    fetch(`/api/vehicles?user_id=${user.user_id}`)
        .then(response => response.json())
        .then(vehicles => {
            if (vehicles.length >= 4) {
                alert('You have reached the maximum limit of 4 vehicles. Please remove a vehicle before adding another.');
                return;
            }

            const formHtml = `
                <div class="add-vehicle-form">
                    <h3>Add New Vehicle</h3>
                    <input type="text" id="licensePlateInput" 
                           placeholder="Enter license plate (e.g., AB12 CDE)" 
                           maxlength="8"
                           pattern="[A-Za-z0-9 ]{2,8}"
                           title="Please enter a valid UK license plate (2-8 alphanumeric characters)"
                           required>
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

            // Auto-capitalize and format input
            const input = document.getElementById('licensePlateInput');
            input.addEventListener('input', function() {
                this.value = this.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
            });

            document.getElementById('confirmAddVehicle').addEventListener('click', async () => {
                let licensePlate = document.getElementById('licensePlateInput').value.trim();
                
                // Format the license plate (remove extra spaces)
                licensePlate = licensePlate.replace(/\s+/g, ' ').trim();
                
                if (licensePlate) {
                    if (!validateLicensePlate(licensePlate)) {
                        alert('Please enter a valid license plate (2-8 alphanumeric characters)');
                        return;
                    }
                    await addVehicle(licensePlate);
                    overlay.remove();
                }
            });

            document.getElementById('cancelAddVehicle').addEventListener('click', () => {
                overlay.remove();
            });
        });
}

function validateLicensePlate(plate) {
    // Basic UK license plate validation (can be customized)
    const regex = /^[A-Z0-9 ]{2,8}$/;
    return regex.test(plate);
}

async function addVehicle(licensePlate) {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        
        // Check vehicle count before adding
        const response = await fetch(`/api/vehicles?user_id=${user.user_id}`);
        const vehicles = await response.json();
        
        if (vehicles.length >= 4) {
            alert('You have reached the maximum limit of 4 vehicles.');
            return;
        }

        const addResponse = await fetch('/api/vehicles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: user.user_id,
                license_plate: licensePlate
            })
        });
        
        if (!addResponse.ok) throw new Error('Failed to add vehicle');
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
    alert('Parking history feature coming soon!');
}

function downloadHistory() {
    alert('Download history feature coming soon!');
}