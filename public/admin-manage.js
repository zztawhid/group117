let currentUsers = [];
let currentPage = 1;
const usersPerPage = 10;
let currentSortColumn = null;
let sortDirection = 1; // 1 for ascending, -1 for descending

document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is admin
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.user_type !== 'admin') {
        window.location.href = 'main.html';
        return;
    }

    // Load users
    await loadUsers();
});

async function loadUsers() {
    try {
        showLoading(true);
        const response = await fetch('/api/admin/users', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }
        
        currentUsers = await response.json();
        renderTable();
        updatePagination();
    } catch (error) {
        showStatusMessage('Error loading users: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function renderTable() {
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '';

    const filteredUsers = filterUsersBySearch();
    const paginatedUsers = paginateUsers(filteredUsers);

    if (paginatedUsers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="no-results">No users found</td></tr>';
        return;
    }

    paginatedUsers.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.user_id}</td>
            <td>${user.full_name}</td>
            <td>${user.email}</td>
            <td>${user.phone_number}</td>
            <td>
                <select class="user-type-select" data-user-id="${user.user_id}">
                    <option value="admin" ${user.user_type === 'admin' ? 'selected' : ''}>Admin</option>
                    <option value="driver" ${user.user_type === 'driver' ? 'selected' : ''}>Driver</option>
                </select>
            </td>
            <td>
                <button class="action-btn save-btn" data-user-id="${user.user_id}">Save</button>
                <button class="action-btn delete-btn" data-user-id="${user.user_id}">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Add event listeners to buttons
    document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = this.getAttribute('data-user-id');
            const row = this.closest('tr');
            const select = row.querySelector('.user-type-select');
            const newType = select.value;
            
            await updateUser(userId, { user_type: newType });
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = this.getAttribute('data-user-id');
            if (confirm('Are you sure you want to delete this user?')) {
                await deleteUser(userId);
            }
        });
    });
}

function filterUsersBySearch() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    if (!searchTerm) return currentUsers;

    return currentUsers.filter(user => 
        user.user_id.toString().includes(searchTerm) ||
        user.full_name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        (user.phone_number && user.phone_number.includes(searchTerm))
    );
}

function paginateUsers(users) {
    const startIndex = (currentPage - 1) * usersPerPage;
    return users.slice(startIndex, startIndex + usersPerPage);
}

function updatePagination() {
    const filteredUsers = filterUsersBySearch();
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
}

function changePage(delta) {
    const filteredUsers = filterUsersBySearch();
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    
    const newPage = currentPage + delta;
    if (newPage > 0 && newPage <= totalPages) {
        currentPage = newPage;
        renderTable();
        updatePagination();
    }
}

function filterUsers() {
    currentPage = 1;
    renderTable();
    updatePagination();
}


function sortTable(columnIndex) {
    // Update sort indicators
    if (currentSortColumn === columnIndex) {
        sortDirection *= -1; // Toggle direction
    } else {
        currentSortColumn = columnIndex;
        sortDirection = 1;
    }
    
    // Remove all sort indicators
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.textContent = '↕';
    });
    
    // Add sort indicator to current column
    const headers = document.querySelectorAll('th');
    headers[columnIndex].querySelector('.sort-icon').textContent = 
        sortDirection === 1 ? '↑' : '↓';
    
    // Sort the users
    currentUsers.sort((a, b) => {
        let aValue, bValue;
        
        switch(columnIndex) {
            case 0: aValue = a.user_id; bValue = b.user_id; break;
            case 1: aValue = a.full_name; bValue = b.full_name; break;
            case 2: aValue = a.email; bValue = b.email; break;
            case 3: aValue = a.phone_number || ''; bValue = b.phone_number || ''; break;
            default: return 0;
        }
        
        if (aValue < bValue) return -1 * sortDirection;
        if (aValue > bValue) return 1 * sortDirection;
        return 0;
    });
    
    renderTable();
}

async function updateUser(userId, data) {
    try {
        showLoading(true);
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('Failed to update user');
        }
        
        showStatusMessage('User updated successfully', 'success');
        await loadUsers(); // Refresh the table
    } catch (error) {
        showStatusMessage('Error updating user: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteUser(userId) {
    try {
        showLoading(true);
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete user');
        }
        
        showStatusMessage('User deleted successfully', 'success');
        await loadUsers(); // Refresh the table
    } catch (error) {
        showStatusMessage('Error deleting user: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function showStatusMessage(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status-message';
    }, 5000);
}

function showLoading(show) {
    const loadingElement = document.createElement('div');
    loadingElement.id = 'loadingOverlay';
    loadingElement.innerHTML = '<div class="loading-spinner"></div>';
    
    if (show) {
        document.body.appendChild(loadingElement);
    } else {
        const existing = document.getElementById('loadingOverlay');
        if (existing) existing.remove();
    }
}

// Make functions available globally for HTML event handlers
window.filterUsers = filterUsers;
window.clearSearch = clearSearch;
window.changePage = changePage;
window.sortTable = sortTable;