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

// Helper function to validate phone number
function validatePhoneNumber(phoneNumber) {
    // Remove spaces and check if length is exactly 11 digits
    const digitsOnly = phoneNumber.replace(/\s/g, '');
    return digitsOnly.length === 11 && /^\d+$/.test(digitsOnly);
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

        // Validate phone number length
        if (!validatePhoneNumber(updatedData.phone_number)) {
            throw new Error('Phone number must be exactly 11 digits');
        }
        
        // Send update to server
        const response = await fetch(`/api/auth/user/${user.user_id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedData)
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Unexpected response: ${text.substring(0, 100)}`);
        }
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Failed to update profile');
        }
        
        // Update local storage and display
        localStorage.setItem('user', JSON.stringify(result.user));
        updateUserDisplay(result.user);
        
        // Close popup
        closeEditProfilePopup();

        
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile: ' + error.message);
    }
}

// Profile Picture Functionality
let selectedImageFile = null;

document.addEventListener('DOMContentLoaded', function() {
    // Image upload change handler
    document.getElementById('image-upload').addEventListener('change', handleImageSelect);

    // Upload button click handler
    document.getElementById('upload-button').addEventListener('click', uploadProfileImage);
});

function openImageUploadPopup() {
    document.getElementById('image-upload-popup').style.display = 'flex';
    document.getElementById('image-upload').value = ''; // Reset file input
    selectedImageFile = null;
    document.getElementById('upload-button').disabled = true;
    document.getElementById('upload-status').textContent = '';

    // Show current profile image in preview
    const savedImage = localStorage.getItem('profileImage');
    const previewImg = document.getElementById('image-preview');
    if (savedImage) {
        previewImg.src = savedImage;
    } else {
        // Fallback to default profile picture
        previewImg.src = document.querySelector('.profile-pic').src;
    }
}

function closeImageUploadPopup() {
    document.getElementById('image-upload-popup').style.display = 'none';
}

function handleImageSelect(e) {
    const file = e.target.files[0];
    const statusElement = document.getElementById('upload-status');
    const uploadButton = document.getElementById('upload-button');

    // Reset status
    statusElement.textContent = '';
    statusElement.className = 'status-message';

    if (!file) {
        uploadButton.disabled = true;
        return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        showStatus('Please select a JPEG, PNG, or GIF image', 'error');
        uploadButton.disabled = true;
        return;
    }

    selectedImageFile = file;

    // Create preview
    const reader = new FileReader();
    reader.onload = function(event) {
        document.getElementById('image-preview').src = event.target.result;
        uploadButton.disabled = false;
    };
    reader.onerror = function() {
        showStatus('Error reading image file', 'error');
        uploadButton.disabled = true;
    };
    reader.readAsDataURL(file);
}

function uploadProfileImage() {
    if (!selectedImageFile) return;

    const uploadButton = document.getElementById('upload-button');
    const statusElement = document.getElementById('upload-status');

    // Show loading state
    uploadButton.classList.add('uploading');
    uploadButton.disabled = true;

    setTimeout(() => {
        const reader = new FileReader();
        reader.onload = function(event) {
            // Save to localStorage
            localStorage.setItem('profileImage', event.target.result);

            // Update profile picture on page
            document.querySelector('.profile-pic').src = event.target.result;

            // Show success
            showStatus('Profile picture updated!', 'success');

            // Close popup after delay
            setTimeout(closeImageUploadPopup, 1000);
        };
        reader.onerror = function() {
            showStatus('Error saving image', 'error');
            uploadButton.classList.remove('uploading');
            uploadButton.disabled = false;
        };
        reader.readAsDataURL(selectedImageFile);
    }, 500); // Simulate network delay
}

function showStatus(message, type) {
    const statusElement = document.getElementById('upload-status');
    statusElement.textContent = message;
    statusElement.className = 'status-message ' + type;
}

// Load saved image when page loads
window.addEventListener('load', function() {
    const savedImage = localStorage.getItem('profileImage');
    if (savedImage) {
        document.querySelector('.profile-pic').src = savedImage;
    }
});

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