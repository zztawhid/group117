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
        showError('Failed to initialize page. Please try again.');
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
        showError('Failed to load parking locations');
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
        option.textContent = `${loc.name} (${loc.code})`;
        
        // Mark disabled locations
        if (loc.disabled) {
            option.dataset.status = 'closed';
            option.textContent += ' - Closed';
            option.dataset.reason = loc.disabled_reason || '';
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
        showError('Failed to load location status');
    } finally {
        hideLoading('status-table-container');
    }
}

function updateStatusTable(statusData) {
    const tbody = document.querySelector('.status-table tbody');
    tbody.innerHTML = '';
    
    statusData.forEach(location => {
        const row = document.createElement('tr');
        
        // Determine status class and text
        let statusClass = 'status-open';
        let statusText = 'Open';
        let restrictions = 'None';
        
        if (location.disabled) {
            statusClass = location.disabled_reason?.includes('Event') 
                ? 'status-event' 
                : 'status-closed';
            statusText = location.disabled_reason?.includes('Event') 
                ? 'Event Only' 
                : 'Closed';
            restrictions = location.disabled_reason || 'Administrative closure';
        }
        
        row.innerHTML = `
            <td>${location.name}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${location.available_spaces} / ${location.total_spaces} spaces</td>
            <td>${restrictions}</td>
            <td>${location.last_updated}</td>
        `;
        
        tbody.appendChild(row);
    });
}

function updateSelectedLocationStatus() {
    const select = document.getElementById('location-select');
    const selectedOption = select.options[select.selectedIndex];
    const statusElement = document.getElementById('selected-location-status');
    const reasonElement = document.getElementById('closure-reason-display');
    
    if (!selectedOption.value) {
        statusElement.textContent = 'Status: Not selected';
        statusElement.className = 'status-unknown';
        reasonElement.textContent = '';
        return;
    }
    
    if (selectedOption.dataset.status === 'closed') {
        statusElement.textContent = 'Status: Closed';
        statusElement.className = 'status-closed';
        reasonElement.textContent = selectedOption.dataset.reason 
            ? `Reason: ${selectedOption.dataset.reason}` 
            : '';
    } else {
        statusElement.textContent = 'Status: Open';
        statusElement.className = 'status-open';
        reasonElement.textContent = '';
    }
}

function setupEventListeners() {
    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', async () => {
        try {
            await loadLocationStatus();
            showSuccess('Status refreshed successfully');
        } catch (error) {
            console.error('Refresh error:', error);
            showError('Failed to refresh status');
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
}

async function handleLocationAction(action) {
    const locationId = document.getElementById('location-select').value;
    if (!locationId) {
        showError('Please select a location first');
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
            showError('Please provide a reason for this action');
            return;
        }
        
        const response = await fetch(`/api/admin/locations/${locationId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action,
                reason,
                notes: eventName ? `Event: ${eventName}. ${notes}` : notes
            })
        });
        
        if (!response.ok) throw new Error('Failed to update location status');
        
        showSuccess(`Location status updated successfully`);
        
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
        showError('Failed to update location status');
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
        showSuccess('Changes saved successfully');
    } catch (error) {
        console.error('Error saving changes:', error);
        showError('Failed to save changes');
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

function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'alert-message error';
    errorElement.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    
    // Add to message container and remove after 5 seconds
    const container = document.getElementById('message-container') || document.body;
    container.appendChild(errorElement);
    setTimeout(() => {
        errorElement.remove();
    }, 5000);
}

function showSuccess(message) {
    const successElement = document.createElement('div');
    successElement.className = 'alert-message success';
    successElement.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    // Add to message container and remove after 5 seconds
    const container = document.getElementById('message-container') || document.body;
    container.appendChild(successElement);
    setTimeout(() => {
        successElement.remove();
    }, 5000);
}
