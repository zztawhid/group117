// Check authentication state
async function checkAuthState() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

// Edit Profile Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    checkAuthState().then(user => {
        if (!user) return;
        
        // Load user data
        loadUserData();
        
        // Set up edit profile button
        document.querySelector('.edit-profile').addEventListener('click', openEditProfilePopup);
        
        // Set up profile picture edit
        document.querySelector('.edit-icon').addEventListener('click', openImageUploadPopup);
        
        // Set up close account button
        document.querySelector('.close-account').addEventListener('click', openCloseAccountPopup);
    });
});

// Load user data from server
async function loadUserData() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            throw new Error('No user data found');
        }
        
        // Fetch updated user data from server
        const response = await fetch(`/api/auth/user?userId=${user.user_id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }
        
        const userData = await response.json();
        
        // Update the display
        updateUserDisplay(userData);
        
        // Save to localStorage
        localStorage.setItem('user', JSON.stringify(userData));
        
    } catch (error) {
        console.error('Error loading user data:', error);
        // Fallback to localStorage data if available
        const localUser = JSON.parse(localStorage.getItem('user')) || {
            full_name: 'Bob Smith',
            email: 'email@email.co.uk',
            phone_number: '07972931203'
        };
        
        updateUserDisplay(localUser);
    }
}

// Update the user display fields
function updateUserDisplay(userData) {
    document.getElementById('name').value = userData.full_name || '';
    document.getElementById('email').value = userData.email || '';
    document.getElementById('telephone').value = userData.phone_number || '';
}

function openEditProfilePopup() {
    const user = JSON.parse(localStorage.getItem('user'));

    // Fill the form with current values
    document.getElementById('edit-name').value = user.full_name;
    document.getElementById('edit-email').value = user.email;
    document.getElementById('edit-telephone').value = user.phone_number;

    // Show the popup
    document.getElementById('edit-profile-popup').style.display = 'flex';
}

function closeEditProfilePopup() {
    document.getElementById('edit-profile-popup').style.display = 'none';
}

async function saveProfileChanges() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            throw new Error('No user logged in');
        }
        
        // Get new values
        const updatedData = {
            full_name: document.getElementById('edit-name').value,
            email: document.getElementById('edit-email').value,
            phone_number: document.getElementById('edit-telephone').value
        };
        
        // Validate inputs
        if (!updatedData.full_name || !updatedData.email || !updatedData.phone_number) {
            throw new Error('All fields are required');
        }
        
        // Send update to server
        const response = await fetch(`/api/auth/user/${user.user_id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update profile');
        }
        
        const result = await response.json();
        
        // Update local storage and display
        localStorage.setItem('user', JSON.stringify(result.user));
        updateUserDisplay(result.user);
        
        // Close popup
        closeEditProfilePopup();
        
        alert('Profile updated successfully!');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile: ' + error.message);
    }
}

// Profile Picture Functionality
let selectedImageFile = null;

function openImageUploadPopup() {
    document.getElementById('image-upload-popup').style.display = 'flex';
    document.getElementById('image-upload').value = '';
    selectedImageFile = null;
    document.getElementById('upload-button').disabled = true;
    document.getElementById('upload-status').style.display = 'none';

    // Show current profile image in preview
    const currentImage = document.querySelector('.profile-pic').src;
    document.getElementById('image-preview').src = currentImage;
}

function closeImageUploadPopup() {
    document.getElementById('image-upload-popup').style.display = 'none';
}

document.getElementById('image-upload').addEventListener('change', function(e) {
    const uploadButton = document.getElementById('upload-button');
    const statusMessage = document.getElementById('upload-status');

    statusMessage.style.display = 'none';

    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
        const maxSize = 2 * 1024 * 1024; // 2MB

        if (!validTypes.includes(file.type)) {
            showStatus('Please select a valid image file (JPEG, PNG, GIF)', 'error');
            uploadButton.disabled = true;
            return;
        }

        if (file.size > maxSize) {
            showStatus('Image must be less than 2MB', 'error');
            uploadButton.disabled = true;
            return;
        }

        selectedImageFile = file;
        const reader = new FileReader();

        reader.onload = function(event) {
            document.getElementById('image-preview').src = event.target.result;
            uploadButton.disabled = false;
        }

        reader.readAsDataURL(file);
    } else {
        uploadButton.disabled = true;
    }
});

function uploadProfileImage() {
    if (!selectedImageFile) return;

    const uploadButton = document.getElementById('upload-button');
    const statusMessage = document.getElementById('upload-status');

    // Show loading state
    uploadButton.classList.add('uploading');
    uploadButton.disabled = true;
    statusMessage.style.display = 'none';

    // Simulate upload (in a real app, you would upload to server)
    setTimeout(function() {
        const reader = new FileReader();
        reader.onload = function(event) {
            // Update profile picture
            document.querySelector('.profile-pic').src = event.target.result;

            // Save to localStorage
            localStorage.setItem('profileImage', event.target.result);

            // Reset button state
            uploadButton.classList.remove('uploading');
            uploadButton.disabled = false;
            
            // Close popup after delay
            setTimeout(closeImageUploadPopup, 1500);
        };
        reader.readAsDataURL(selectedImageFile);
    }, 1500);
}

function showStatus(message, type) {
    const statusElement = document.getElementById('upload-status');
    statusElement.textContent = message;
    statusElement.className = 'status-message ' + type;
    statusElement.style.display = 'block';
}

// Close Account Functionality
function openCloseAccountPopup() {
    document.getElementById('close-account-popup').style.display = 'flex';
}

function closeCloseAccountPopup() {
    document.getElementById('close-account-popup').style.display = 'none';
}

function confirmCloseAccount() {
    alert('Account closure request sent. You will receive a confirmation email.');
    
    // For demo purposes, just clear local data
    localStorage.removeItem('user');
    localStorage.removeItem('profileImage');
    closeCloseAccountPopup();

    // Redirect to login page
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1500);
}

// Load saved image on page load
window.addEventListener('load', function() {
    const savedImage = localStorage.getItem('profileImage');
    if (savedImage) {
        document.querySelector('.profile-pic').src = savedImage;
    }
});