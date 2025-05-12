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
    document.getElementById('viewHistoryBtn').addEventListener('click', showHistoryPopup);
    document.getElementById('downloadHistoryBtn').addEventListener('click', downloadParkingHistory);
});

// Vehicle Management Functions
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

// Parking History Functions
async function showHistoryPopup() {
    const popup = document.getElementById('parking-history-popup');
    popup.style.display = 'flex';
    await loadHistoryData();
}

function closePopup() {
    document.getElementById('parking-history-popup').style.display = 'none';
}

async function loadHistoryData() {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">Loading history...</td></tr>';

    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const response = await fetch(`/api/parking/history?user_id=${user.user_id}`);
        
        if (!response.ok) throw new Error('Failed to load history');
        
        const data = await response.json();

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No parking history found</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(item => `
            <tr data-plate="${item.license_plate}">
                <td>${formatDate(item.time_in)}</td>
                <td>${formatTime(item.time_in)}</td>
                <td>${item.time_out ? formatTime(item.time_out) : 'Active'}</td>
                <td>${item.location || 'Unknown'}</td>
                <td>${calculateDuration(item.time_in, item.time_out)}</td>
                <td>${item.cost ? '£' + parseFloat(item.cost).toFixed(2) : '-'}</td>
            </tr>
        `).join('');

        // Add vehicle plate filter if multiple vehicles
        const uniquePlates = [...new Set(data.map(item => item.license_plate))];
        if (uniquePlates.length > 1) {
            addVehicleFilter(uniquePlates);
        }

    } catch (error) {
        console.error('Error loading history:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="error-msg">
                    Failed to load history. Please try again.
                    <button onclick="loadHistoryData()">Retry</button>
                </td>
            </tr>
        `;
    }
}

function addVehicleFilter(plates) {
    const popupHeader = document.querySelector('.popup-header');
    
    // Check if filter already exists
    if (document.getElementById('vehicle-filter')) return;
    
    const filterHtml = `
        <div id="vehicle-filter" class="vehicle-filter">
            <label for="plate-select">Filter by vehicle:</label>
            <select id="plate-select" onchange="filterHistoryByVehicle()">
                <option value="all">All Vehicles</option>
                ${plates.map(plate => `
                    <option value="${plate}">${plate}</option>
                `).join('')}
            </select>
        </div>
    `;
    
    popupHeader.insertAdjacentHTML('afterend', filterHtml);
}

function filterHistoryByVehicle() {
    const selectedPlate = document.getElementById('plate-select').value;
    const rows = document.querySelectorAll('#history-table-body tr');
    
    rows.forEach(row => {
        const rowPlate = row.dataset.plate || '';
        if (selectedPlate === 'all' || rowPlate === selectedPlate) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

async function downloadParkingHistory() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const response = await fetch(`/api/parking/history/all?user_id=${user.user_id}`);
        
        if (!response.ok) throw new Error('Failed to fetch history');
        
        const data = await response.json();

        if (data.length === 0) {
            alert('No parking history available to download');
            return;
        }

        const headers = ['Date', 'Entry Time', 'Exit Time', 'Location', 'Duration', 'Cost', 'Vehicle'];
        const rows = data.map(item => [
            formatDate(item.time_in),
            formatTime(item.time_in),
            item.time_out ? formatTime(item.time_out) : 'Active',
            item.location || 'Unknown',
            calculateDuration(item.time_in, item.time_out),
            item.cost ? '£' + parseFloat(item.cost).toFixed(2) : '-',
            item.license_plate
        ]);

        createCSVDownload(headers, rows);

    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to generate download. Please try again.');
    }
}

function createCSVDownload(headers, rows) {
    const csvContent = [
        headers.join(','),
        ...rows.map(row => Array.isArray(row) ? row.join(',') : row)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `UEA_Parking_History_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

// Helper Functions
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function formatTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function calculateDuration(start, end) {
    if (!start) return 'N/A';
    if (!end) return 'Active';
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate - startDate;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
}