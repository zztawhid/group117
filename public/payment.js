document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Get booking details from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const bookingDetails = {
        locationId: urlParams.get('location_id'),
        locationName: urlParams.get('location_name'),
        vehicleId: urlParams.get('vehicle_id'),
        vehiclePlate: urlParams.get('vehicle_plate'),
        duration: urlParams.get('duration'),
        totalCost: urlParams.get('total_cost')
    };

    // Display booking details
    displayBookingDetails(bookingDetails);

    // Set up payment confirmation
    document.getElementById('confirm-payment-btn').addEventListener('click', processPayment);
});

function displayBookingDetails(details) {
    // Display basic details
    document.getElementById('summary-location').textContent = details.locationName || 'Not specified';
    document.getElementById('summary-vehicle').textContent = details.vehiclePlate || 'Not specified';
    
    // Format duration
    const duration = details.duration;
    document.getElementById('summary-duration').textContent = 
        duration ? `${duration} hour${duration > 1 ? 's' : ''}` : 'Not specified';
    
    // Calculate and display pricing information
    if (details.totalCost && details.duration) {
        const totalCost = parseFloat(details.totalCost);
        const hourlyRate = (totalCost / parseInt(details.duration)).toFixed(2);
        
        document.getElementById('summary-rate').textContent = `£${hourlyRate}/hr`;
        document.getElementById('summary-total').textContent = `£${totalCost.toFixed(2)}`;
        
        // Calculate discount if applicable
        let discountRate = 0;
        if (duration >= 24) discountRate = 0.2;
        else if (duration >= 12) discountRate = 0.15;
        else if (duration >= 8) discountRate = 0.1;
        
        if (discountRate > 0) {
            const discountAmount = (totalCost * discountRate / (1 - discountRate)).toFixed(2);
            document.getElementById('summary-discount').textContent = `-£${discountAmount}`;
        }
    }
}

async function processPayment() {
    const cardNumber = document.getElementById('card-number').value.trim();
    const expiryDate = document.getElementById('expiry-date').value.trim();
    const cvv = document.getElementById('cvv').value.trim();
    
    // Basic validation
    if (!cardNumber || !expiryDate || !cvv) {
        alert('Please fill in all payment details');
        return;
    }

    // Get booking details from URL
    const urlParams = new URLSearchParams(window.location.search);
    const bookingDetails = {
        locationId: urlParams.get('location_id'),
        vehicleId: urlParams.get('vehicle_id'),
        duration: urlParams.get('duration'),
        totalCost: urlParams.get('total_cost')
    };

    try {
        
        // Create a parking session
        const response = await fetch('/api/parking/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({
                locationId: bookingDetails.locationId,
                vehicleId: bookingDetails.vehicleId,
                duration: bookingDetails.duration,
                amountPaid: bookingDetails.totalCost,
                paymentMethod: 'card'
            })
        });

        if (!response.ok) throw new Error('Failed to create parking session');

        // Redirect to confirmation page
        window.location.href = `confirmation.html?reference=${generateReference()}`;
        
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed. Please try again.');
    }
}

function generateReference() {
    return 'PARK-' + Math.random().toString(36).substr(2, 8).toUpperCase();
}