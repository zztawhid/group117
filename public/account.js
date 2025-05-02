// Edit Profile Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Set up edit profile button
    document.querySelector('.edit-profile').addEventListener('click', openEditProfilePopup);

    // Initialize with current values
    const currentUser = JSON.parse(localStorage.getItem('user')) || {
        name: 'Bob Smith',
        email: 'email@email.co.uk',
        telephone: '07972931203'
    };
    localStorage.setItem('user', JSON.stringify(currentUser));
});

function openEditProfilePopup() {
    const user = JSON.parse(localStorage.getItem('user'));

    // Fill the form with current values
    document.getElementById('edit-name').value = user.name;
    document.getElementById('edit-email').value = user.email;
    document.getElementById('edit-telephone').value = user.telephone;

    // Show the popup
    document.getElementById('edit-profile-popup').style.display = 'flex';
}

function closeEditProfilePopup() {
    document.getElementById('edit-profile-popup').style.display = 'none';
}

function saveProfileChanges() {
    const user = JSON.parse(localStorage.getItem('user'));

    // Get new values
    user.name = document.getElementById('edit-name').value;
    user.email = document.getElementById('edit-email').value;
    user.telephone = document.getElementById('edit-telephone').value;

    // Save to localStorage (in a real app, you would send to server)
    localStorage.setItem('user', JSON.stringify(user));

    // Update the display
    document.getElementById('name').value = user.name;
    document.getElementById('email').value = user.email;
    document.getElementById('telephone').value = user.telephone;

    // Close popup
    closeEditProfilePopup();

    alert('Profile updated successfully!');
}



// Close Account Functionality
document.addEventListener('DOMContentLoaded', function() {
    document.querySelector('.close-account').addEventListener('click', openCloseAccountPopup);
});

function openCloseAccountPopup() {
    document.getElementById('close-account-popup').style.display = 'flex';
}

function closeCloseAccountPopup() {
    document.getElementById('close-account-popup').style.display = 'none';
}

function confirmCloseAccount() {
    // In a real app, you would send a request to your backend
    alert('Account closure request sent. You will receive a confirmation email.');

    // For demo purposes, just clear local data
    localStorage.removeItem('user');
    closeCloseAccountPopup();

    // Redirect to login page
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1500);
}


// Payment Methods Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Load saved payment methods
    loadPaymentMethods();

    // Set up add payment button
    document.querySelector('.add-payment-btn').addEventListener('click', showAddPaymentPopup);

    // Set up remove buttons (event delegation)
    document.getElementById('savedPayments').addEventListener('click', function(e) {
        if (e.target.closest('.remove-payment')) {
            const paymentElement = e.target.closest('.payment-method');
            const cardLast4 = paymentElement.querySelector('.card-number').textContent.slice(-4);
            if (confirm(`Remove payment method ending in ${cardLast4}?`)) {
                removePaymentMethod(paymentElement.dataset.paymentId);
            }
        }
    });
});

function loadPaymentMethods() {
    // In a real app, you would fetch from your API
    const savedPayments = JSON.parse(localStorage.getItem('savedPayments')) || [];
    const container = document.getElementById('savedPayments');

    if (savedPayments.length === 0) {
        container.innerHTML = '<p class="no-payments">No saved payment methods</p>';
        return;
    }

    container.innerHTML = savedPayments.map(payment => `
        <div class="payment-method" data-payment-id="${payment.id}">
            <div class="payment-icon">
                <i class="fab ${getCardIcon(payment.cardType)}"></i>
            </div>
            <div class="payment-details">
                <span class="card-type">${payment.cardType.toUpperCase()}</span>
                <span class="card-number">•••• •••• •••• ${payment.last4}</span>
                <span class="card-expiry">Expires ${payment.expiry}</span>
            </div>
            <button class="remove-payment">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function getCardIcon(cardType) {
    const icons = {
        visa: 'fa-cc-visa',
        mastercard: 'fa-cc-mastercard',
        amex: 'fa-cc-amex',
        discover: 'fa-cc-discover'
    };
    return icons[cardType.toLowerCase()] || 'fa-credit-card';
}

function showAddPaymentPopup() {
    // Implement your payment method add popup
    alert('Payment form needs completing here');

}

function removePaymentMethod(paymentId) {
    // In a real app, you would call your API
    const savedPayments = JSON.parse(localStorage.getItem('savedPayments')) || [];
    const updatedPayments = savedPayments.filter(p => p.id !== paymentId);
    localStorage.setItem('savedPayments', JSON.stringify(updatedPayments));
    loadPaymentMethods();
}