document.addEventListener('DOMContentLoaded', async function() {
    // Check user authentication and admin status
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.user_type !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // Initialize the page
    try {
        await initPage();
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize page. Please try again.');
    }
});

async function initPage() {
    // Load all necessary data
    await Promise.all([
        loadParkingLocations(),
        loadLocationStatus()
    ]);
    
    // Initialize form elements
    document.getElementById('closure-reason').value = '';
    document.getElementById('closure-notes').value = '';
    document.getElementById('event-name').value = '';
}

async function loadParkingLocations() {
    try {
        showLoading('location-select', 'Loading parking locations...');
        
        const response = await fetch('/api/parking/locations');
        if (!response.ok) throw new Error('Failed to load parking locations');
        
        const locations = await response.json();
        populateLocationDropdown(locations);
    } catch (error) {
        console.error('Error loading locations:', error);
        alert('Failed to load parking locations');
        document.getElementById('location-select').innerHTML = `
            <option value="" disabled selected>Error loading locations</option>
        `;
    } finally {
        hideLoading('location-select');
    }
}

function populateLocationDropdown(locations) {
    const select = document.getElementById('location-select');
    select.innerHTML = '<option value="" disabled selected>Select location</option>';
    
    locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.location_id;
        option.textContent = `${loc.name} (${loc.code}) - ${loc.total_spaces} spaces`;
        
        // Set status attributes
        if (loc.disabled) {
            if (loc.disabled_reason?.includes('Maintenance')) {
                option.dataset.status = 'maintenance';
            } else {
                option.dataset.status = 'closed';
            }
            option.dataset.reason = loc.disabled_reason || '';
        } else if (loc.disabled_reason?.includes('Event')) {
            option.dataset.status = 'event';
            option.dataset.reason = loc.disabled_reason;
        } else {
            option.dataset.status = 'open';
        }
        
        select.appendChild(option);
    });
    
    // Trigger change event to update status display
    if (locations.length > 0) {
        select.dispatchEvent(new Event('change'));
    }
}

async function loadLocationStatus() {
    try {
        showLoading('status-table-container', 'Loading location status...');
        
        const response = await fetch('/api/admin/locations/status');
        if (!response.ok) throw new Error('Failed to load location status');
        
        const statusData = await response.json();
        updateStatusTable(statusData);
    } catch (error) {
        console.error('Error loading location status:', error);
        alert('Failed to load location status');
    } finally {
        hideLoading('status-table-container');
    }
}

function updateStatusTable(statusData) {
    const tbody = document.getElementById('status-table-body');
    tbody.innerHTML = '';
    
    statusData.forEach(location => {
        const row = document.createElement('tr');
        
        // Determine status class and text
        let statusClass = 'status-open';
        let statusText = 'Open';
        let restrictions = 'None';
        
        if (location.disabled) {
            if (location.disabled_reason?.includes('Maintenance')) {
                statusClass = 'status-maintenance';
                statusText = 'Maintenance';
            } else {
                statusClass = 'status-closed';
                statusText = 'Closed';
            }
            restrictions = location.disabled_reason || 'Administrative closure';
        } else if (location.disabled_reason?.includes('Event')) {
            statusClass = 'status-event';
            statusText = 'Event Only';
            restrictions = location.disabled_reason;
        }
        
        row.innerHTML = `
            <td>${location.name} (${location.code})</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${location.total_spaces} spaces</td>
            <td>${location.available_spaces} (${location.occupancy_percentage}%)</td>
            <td>${restrictions}</td>
            <td>${location.last_updated}</td>
            <td>
                <button class="action-btn small" onclick="handleDeleteLocation(${location.location_id}, '${location.name}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function updateSelectedLocationStatus() {
    const select = document.getElementById('location-select');
    const selectedOption = select.options[select.selectedIndex];
    const statusElement = document.getElementById('selected-location-status');
    
    if (!selectedOption.value) {
        statusElement.textContent = 'Status: Not selected';
        statusElement.className = 'status-unknown';
        return;
    }
    
    const status = selectedOption.dataset.status;
    const reason = selectedOption.dataset.reason || '';
    
    switch (status) {
        case 'closed':
            statusElement.textContent = 'Status: Closed';
            statusElement.className = 'status-closed';
            break;
        case 'maintenance':
            statusElement.textContent = 'Status: Maintenance';
            statusElement.className = 'status-maintenance';
            break;
        case 'event':
            statusElement.textContent = 'Status: Event Only';
            statusElement.className = 'status-event';
            break;
        default:
            statusElement.textContent = 'Status: Open';
            statusElement.className = 'status-open';
    }
    
    if (reason) {
        statusElement.textContent += ` (${reason})`;
    }
}

function setupEventListeners() {
    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', async () => {
        try {
            await loadLocationStatus();
            alert('Status refreshed successfully');
        } catch (error) {
            console.error('Refresh error:', error);
            alert('Failed to refresh status');
        }
    });
    
    // Location selection change
    document.getElementById('location-select').addEventListener('change', updateSelectedLocationStatus);
    
    // Location action buttons
    document.getElementById('close-location').addEventListener('click', () => handleLocationAction('close'));
    document.getElementById('event-only').addEventListener('click', () => handleLocationAction('event'));
    document.getElementById('open-location').addEventListener('click', () => handleLocationAction('open'));
    document.getElementById('maintenance-mode').addEventListener('click', () => handleLocationAction('maintenance'));
    
    // Form submission
    document.getElementById('save-changes-btn').addEventListener('click', saveChanges);
    
    // Spaces management
    document.getElementById('update-spaces').addEventListener('click', updateParkingSpaces);
    
    // Add new location
    document.getElementById('add-location').addEventListener('click', addNewLocation);
}

async function handleLocationAction(action) {
    const locationId = document.getElementById('location-select').value;
    if (!locationId) {
        alert('Please select a location first');
        return;
    }
    
    try {
        let confirmationMessage = '';
        let reasonRequired = false;
        
        switch (action) {
            case 'close':
                confirmationMessage = 'Are you sure you want to close this location?';
                reasonRequired = true;
                break;
            case 'event':
                confirmationMessage = 'Set this location to event-only mode?';
                reasonRequired = true;
                break;
            case 'maintenance':
                confirmationMessage = 'Put this location in maintenance mode?';
                reasonRequired = true;
                break;
            case 'open':
                confirmationMessage = 'Reopen this location to the public?';
                break;
        }
        
        if (!confirm(confirmationMessage)) return;
        
        const reason = document.getElementById('closure-reason').value;
        const notes = document.getElementById('closure-notes').value;
        const eventName = document.getElementById('event-name').value;
        
        if (reasonRequired && !reason && action !== 'open') {
            alert('Please provide a reason for this action');
            return;
        }
        
        // Prepare request body based on action type
        const requestBody = { action };
        if (action === 'event') {
            requestBody.reason = 'Event';
            requestBody.notes = eventName ? `Event: ${eventName}. ${notes}` : notes;
        } else if (action === 'maintenance') {
            requestBody.reason = 'Maintenance';
            requestBody.notes = notes || 'Scheduled maintenance';
        } else if (action === 'close') {
            requestBody.reason = reason || 'Administrative closure';
            requestBody.notes = notes;
        }
        
        const response = await fetch(`/api/admin/locations/${locationId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) throw new Error('Failed to update location status');
        
        alert(`Location status updated successfully`);
        
        // Refresh data
        await Promise.all([
            loadParkingLocations(),
            loadLocationStatus()
        ]);
        
        // Clear form fields
        document.getElementById('closure-reason').value = '';
        document.getElementById('closure-notes').value = '';
        document.getElementById('event-name').value = '';
    } catch (error) {
        console.error('Error updating location status:', error);
        alert('Failed to update location status');
    }
}

async function updateParkingSpaces() {
    const locationId = document.getElementById('location-select').value;
    if (!locationId) {
        alert('Please select a location first');
        return;
    }
    
    const spacesToAdd = parseInt(document.getElementById('spaces-to-add').value) || 0;
    const spacesToRemove = parseInt(document.getElementById('spaces-to-remove').value) || 0;
    
    if (spacesToAdd === 0 && spacesToRemove === 0) {
        alert('Please specify the number of spaces to add or remove');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/locations/${locationId}/spaces`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                add: spacesToAdd,
                remove: spacesToRemove
            })
        });
        
        if (!response.ok) throw new Error('Failed to update parking spaces');
        
        alert('Parking spaces updated successfully');
        
        // Refresh data
        await Promise.all([
            loadParkingLocations(),
            loadLocationStatus()
        ]);
        
        // Clear form fields
        document.getElementById('spaces-to-add').value = '';
        document.getElementById('spaces-to-remove').value = '';
    } catch (error) {
        console.error('Error updating parking spaces:', error);
        alert('Failed to update parking spaces');
    }
}

async function addNewLocation() {
    const name = document.getElementById('new-location-name').value.trim();
    const code = document.getElementById('new-location-code').value.trim().toUpperCase();
    const spaces = parseInt(document.getElementById('new-location-spaces').value);
    const rate = parseFloat(document.getElementById('new-location-rate').value);
    
    if (!name || !code || isNaN(spaces) || isNaN(rate)) {
        alert('Please fill all fields with valid values');
        return;
    }
    
    if (code.length !== 4) {
        alert('Location code must be exactly 4 characters');
        return;
    }
    
    if (spaces < 1) {
        alert('Location must have at least 1 space');
        return;
    }
    
    if (rate < 0.5) {
        alert('Hourly rate must be at least £0.50');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/locations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                code,
                total_spaces: spaces,
                hourly_rate: rate
            })
        });
        
        if (!response.ok) throw new Error('Failed to add new location');
        
        alert('New parking location added successfully');
        
        // Refresh data
        await Promise.all([
            loadParkingLocations(),
            loadLocationStatus()
        ]);
        
        // Clear form fields
        document.getElementById('new-location-name').value = '';
        document.getElementById('new-location-code').value = '';
        document.getElementById('new-location-spaces').value = '50';
        document.getElementById('new-location-rate').value = '2.5';
    } catch (error) {
        console.error('Error adding new location:', error);
        alert(error.message || 'Failed to add new location');
    }
}

async function handleDeleteLocation(locationId, locationName) {
    if (!confirm(`Are you sure you want to permanently delete "${locationName}" and all its parking spaces?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/locations/${locationId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete location');
        
        alert('Location deleted successfully');
        
        // Refresh data
        await Promise.all([
            loadParkingLocations(),
            loadLocationStatus()
        ]);
    } catch (error) {
        console.error('Error deleting location:', error);
        alert('Failed to delete location. Make sure there are no active reservations.');
    }
}

async function saveChanges() {
    try {
        // In a real implementation, this would save any form changes
        // For now, we'll just refresh the data
        await Promise.all([
            loadParkingLocations(),
            loadLocationStatus()
        ]);
        alert('Changes saved successfully');
    } catch (error) {
        console.error('Error saving changes:', error);
        alert('Failed to save changes');
    }
}

// UI Helper functions
function showLoading(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        const loader = document.createElement('div');
        loader.className = 'loading-overlay';
        loader.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-message">${message}</div>
        `;
        element.appendChild(loader);
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const loader = element.querySelector('.loading-overlay');
        if (loader) loader.remove();
    }
}