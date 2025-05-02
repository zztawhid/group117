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

function downloadHistory() {
    alert('Download history feature coming soon!');
}








// Show the popup
function showHistoryPopup() {
    const popup = document.getElementById('parking-history-popup');
    popup.style.display = 'flex';
    loadHistoryData(); // You'll implement this
}

// Close the popup
function closePopup() {
    document.getElementById('parking-history-popup').style.display = 'none';
}

// Example data loading function
async function loadHistoryData() {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '<tr><td colspan="6" class="loading-msg">Loading history...</td></tr>';

    try {
        // Replace with actual API call
        const response = await fetch('/api/parking-history');
        const data = await response.json();

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No parking history found</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(item => `
            <tr>
                <td>${new Date(item.entry_time).toLocaleDateString()}</td>
                <td>${new Date(item.entry_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                <td>${item.exit_time ? new Date(item.exit_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active'}</td>
                <td>${item.location || 'Unknown'}</td>
                <td>${calculateDuration(item.entry_time, item.exit_time)}</td>
                <td>${item.cost ? '£' + item.cost.toFixed(2) : '-'}</td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="error-msg">Failed to load history</td></tr>';
    }
}

function calculateDuration(start, end) {
    if (!end) return 'Active';
    const diff = new Date(end) - new Date(start);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

function downloadHistory() {
    // Implement your download functionality
    alert('Download feature will be implemented here');
}

// Update your existing event listener
document.getElementById('viewHistoryBtn').addEventListener('click', showHistoryPopup);

// Make the download function reusable
function downloadParkingHistory() {
    try {
        // Try to get the table from the popup first
        let table = document.querySelector('#parking-history-popup .history-table');

        // If popup isn't open, fall back to getting data from API directly
        if (!table || table.querySelectorAll('tbody tr').length === 0) {
            downloadAllHistoryFromAPI();
            return;
        }

        // Proceed with table download if popup is open with data
        const headers = Array.from(table.querySelectorAll('thead th'))
            .map(header => `"${header.textContent.trim().replace(/"/g, '""')}"`);

        const rows = Array.from(table.querySelectorAll('tbody tr')).map(row => {
            return Array.from(row.querySelectorAll('td'))
                .map(cell => `"${cell.textContent.trim().replace(/"/g, '""')}"`)
                .join(',');
        });

        createCSVDownload(headers, rows);

    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to generate download. Please try again.');
    }
}

// New function to handle API-based download
async function downloadAllHistoryFromAPI() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const response = await fetch(`/api/parking-history/all?user_id=${user.user_id}`);

        if (!response.ok) throw new Error('Failed to fetch history');

        const data = await response.json();

        if (data.length === 0) {
            alert('No parking history available to download');
            return;
        }

        const headers = ['Date', 'Entry Time', 'Exit Time', 'Location', 'Duration', 'Cost'];
        const rows = data.map(item => {
            const exitTime = item.exit_time ?
                new Date(item.exit_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) :
                'Active';

            return [
                `"${new Date(item.entry_time).toLocaleDateString()}"`,
                `"${new Date(item.entry_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}"`,
                `"${exitTime}"`,
                `"${item.location || 'Unknown'}"`,
                `"${calculateDuration(item.entry_time, item.exit_time)}"`,
                `"${item.cost ? '£' + item.cost.toFixed(2) : '-'}"`
            ].join(',');
        });

        createCSVDownload(headers, rows);

    } catch (error) {
        console.error('API download failed:', error);
        alert('Failed to download complete history. Please try again or view your history first.');
    }
}

// Shared CSV creation function
function createCSVDownload(headers, rows) {
    const csvContent = [
        headers.join(','),
        ...rows
    ].join('\r\n');

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

// Update your event listeners
document.getElementById('downloadHistoryBtn').addEventListener('click', downloadParkingHistory);
document.getElementById('download-history-button').addEventListener('click', downloadParkingHistory);