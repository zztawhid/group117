document.addEventListener('DOMContentLoaded', function() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Get booking details from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const bookingType = urlParams.get('type');
    
    if (bookingType === 'reservation') {
        // Advanced booking - display all details from URL params
        const bookingDetails = {
            locationName: urlParams.get('location_name'),
            vehiclePlate: urlParams.get('vehicle_plate'),
            duration: urlParams.get('duration'),
            startTime: urlParams.get('start_time'),
            endTime: urlParams.get('end_time'),
            totalCost: urlParams.get('total_cost'),
            needsDisabled: urlParams.get('needs_disabled') === 'true',
            reservationId: urlParams.get('reservation_id')
        };
        displayReservationDetails(bookingDetails);
    } else {
        // Immediate booking
        const bookingDetails = {
            locationId: urlParams.get('location_id'),
            locationName: urlParams.get('location_name'),
            vehicleId: urlParams.get('vehicle_id'),
            vehiclePlate: urlParams.get('vehicle_plate'),
            duration: urlParams.get('duration'),
            totalCost: urlParams.get('total_cost'),
            needsDisabled: urlParams.get('needs_disabled') === 'true'
        };
        displayBookingDetails(bookingDetails);
    }

    // Set up payment confirmation
    document.getElementById('confirm-payment-btn').addEventListener('click', processPayment);
    
    // Format card inputs
    document.getElementById('card-number').addEventListener('input', formatCardNumber);
    document.getElementById('card-expiry').addEventListener('input', formatCardExpiry);
    document.getElementById('card-cvv').addEventListener('input', formatCardCvv);
});

function displayReservationDetails(details) {
    document.getElementById('summary-location').textContent = details.locationName || 'Not specified';
    document.getElementById('summary-vehicle').textContent = details.vehiclePlate || 'Not specified';
    document.getElementById('summary-space').textContent = 'Will be assigned';
    document.getElementById('summary-bay-type').textContent = details.needsDisabled ? 'Disabled Bay' : 'Standard Bay';
    
    const duration = details.duration;
    document.getElementById('summary-duration').textContent = 
        duration ? `${duration} hour${duration > 1 ? 's' : ''}` : 'Not specified';
    
    document.getElementById('summary-start').textContent = new Date(details.startTime).toLocaleString();
    document.getElementById('summary-end').textContent = new Date(details.endTime).toLocaleString();
    
    if (details.totalCost && details.duration) {
        const totalCost = parseFloat(details.totalCost);
        const hourlyRate = (totalCost / parseInt(details.duration)).toFixed(2);
        
        document.getElementById('summary-rate').textContent = `£${hourlyRate}/hr`;
        document.getElementById('summary-total').textContent = `£${totalCost.toFixed(2)}`;
        
        let discountRate = 0;
        if (duration >= 24) discountRate = 0.2;
        else if (duration >= 12) discountRate = 0.15;
        else if (duration >= 8) discountRate = 0.1;
        
        if (discountRate > 0) {
            const discountAmount = (totalCost * discountRate / (1 - discountRate)).toFixed(2);
            document.getElementById('summary-discount').textContent = `-£${discountAmount}`;
        }
    }
    
    // Store booking details for payment processing
    const confirmBtn = document.getElementById('confirm-payment-btn');
    confirmBtn.dataset.bookingType = 'reservation';
    confirmBtn.dataset.reservationId = details.reservationId;
    confirmBtn.dataset.vehicleId = details.vehicle_id;  // Store vehicle ID
    confirmBtn.dataset.vehiclePlate = details.vehicle_plate;  // Store vehicle plate
}

async function loadReservationDetails(reservationId) {
    try {
        const response = await fetch(`/api/parking/reservations/${reservationId}`);
        if (!response.ok) throw new Error('Failed to load reservation details');
        
        const reservation = await response.json();
        
        // Display reservation details
        document.getElementById('summary-location').textContent = reservation.location_name;
        document.getElementById('summary-vehicle').textContent = reservation.license_plate;
        document.getElementById('summary-space').textContent = reservation.space_number || 'Not assigned';
        document.getElementById('summary-duration').textContent = `${reservation.duration_hours} hour${reservation.duration_hours > 1 ? 's' : ''}`;
        document.getElementById('summary-start').textContent = new Date(reservation.start_time).toLocaleString();
        document.getElementById('summary-end').textContent = new Date(reservation.end_time).toLocaleString();
        document.getElementById('summary-bay-type').textContent = reservation.needs_disabled ? 'Disabled Bay' : 'Standard Bay';
        
        const hourlyRate = (reservation.total_cost / reservation.duration_hours).toFixed(2);
        document.getElementById('summary-rate').textContent = `£${hourlyRate}/hr`;
        document.getElementById('summary-total').textContent = `£${reservation.total_cost.toFixed(2)}`;
        
        // Calculate discount
        let discountRate = 0;
        if (reservation.duration_hours >= 24) discountRate = 0.2;
        else if (reservation.duration_hours >= 12) discountRate = 0.15;
        else if (reservation.duration_hours >= 8) discountRate = 0.1;
        
        if (discountRate > 0) {
            const discountAmount = (reservation.total_cost * discountRate / (1 - discountRate)).toFixed(2);
            document.getElementById('summary-discount').textContent = `-£${discountAmount}`;
        }
        
        // Store reservation ID for payment processing
        document.getElementById('confirm-payment-btn').dataset.reservationId = reservationId;
        
    } catch (error) {
        console.error('Error loading reservation:', error);
        alert('Failed to load reservation details');
    }
}

function displayBookingDetails(details) {
    document.getElementById('summary-location').textContent = details.locationName || 'Not specified';
    document.getElementById('summary-vehicle').textContent = details.vehiclePlate || 'Not specified';
    document.getElementById('summary-space').textContent = 'Will be assigned on arrival';
    document.getElementById('summary-bay-type').textContent = details.needsDisabled ? 'Disabled Bay' : 'Standard Bay';
    
    const duration = details.duration;
    document.getElementById('summary-duration').textContent = 
        duration ? `${duration} hour${duration > 1 ? 's' : ''}` : 'Not specified';
    
    const now = new Date();
    document.getElementById('summary-start').textContent = now.toLocaleString();
    
    const endTime = new Date(now.getTime() + parseInt(duration) * 60 * 60 * 1000);
    document.getElementById('summary-end').textContent = endTime.toLocaleString();
    
    if (details.totalCost && details.duration) {
        const totalCost = parseFloat(details.totalCost);
        const hourlyRate = (totalCost / parseInt(details.duration)).toFixed(2);
        
        document.getElementById('summary-rate').textContent = `£${hourlyRate}/hr`;
        document.getElementById('summary-total').textContent = `£${totalCost.toFixed(2)}`;
        
        let discountRate = 0;
        if (duration >= 24) discountRate = 0.2;
        else if (duration >= 12) discountRate = 0.15;
        else if (duration >= 8) discountRate = 0.1;
        
        if (discountRate > 0) {
            const discountAmount = (totalCost * discountRate / (1 - discountRate)).toFixed(2);
            document.getElementById('summary-discount').textContent = `-£${discountAmount}`;
        }
    }
    
    // Store booking details for payment processing
    document.getElementById('confirm-payment-btn').dataset.bookingDetails = JSON.stringify(details);
}

function formatCardNumber(e) {
    let value = e.target.value.replace(/\D/g, '');
    let formatted = '';
    
    for (let i = 0; i < value.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += value[i];
    }
    
    e.target.value = formatted;
}

function formatCardExpiry(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (value.length > 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    
    e.target.value = value;
}

function formatCardCvv(e) {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
}

async function processPayment() {
    const cardName = document.getElementById('card-name').value.trim();
    const cardNumber = document.getElementById('card-number').value.replace(/\s/g, '');
    const cardExpiry = document.getElementById('card-expiry').value.trim();
    const cardCvv = document.getElementById('card-cvv').value.trim();
    
    // Basic validation
    if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
        alert('Please fill in all card details');
        return;
    }
    
    // Validate card number with Luhn algorithm
    if (!validateCardWithLuhn(cardNumber)) {
        alert('Invalid card number. Please check and try again.');
        return;
    }
    
    // Validate expiry date
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
        alert('Invalid expiry date. Please use MM/YY format.');
        return;
    }
    
    // Validate CVV
    if (!/^\d{3,4}$/.test(cardCvv)) {
        alert('Invalid CVV. Please enter 3 or 4 digits.');
        return;
    }
    
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const confirmBtn = document.getElementById('confirm-payment-btn');
        const bookingType = confirmBtn.dataset.bookingType;
        
        if (bookingType === 'reservation') {
            // Process reservation payment
            const reservationId = confirmBtn.dataset.reservationId;
            
            const response = await fetch('/api/payment/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reservation_id: reservationId,
                    card_number: cardNumber,
                    card_expiry: cardExpiry,
                    card_cvv: cardCvv,
                    card_name: cardName
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Payment failed');
            }
            
            const result = await response.json();
            
            // Get reservation details for confirmation
            const urlParams = new URLSearchParams(window.location.search);
            showConfirmation(
                `RES-${reservationId}`,
                'Assigned on arrival',
                urlParams.get('duration'),
                urlParams.get('total_cost')
            );
            
        } else {
            // Immediate booking (existing code)
            const bookingDetails = JSON.parse(confirmBtn.dataset.bookingDetails);
            
            const response = await fetch('/api/parking/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user.user_id,
                    vehicle_id: bookingDetails.vehicleId,
                    location_id: bookingDetails.locationId,
                    duration: bookingDetails.duration,
                    amount_paid: bookingDetails.totalCost,
                    needs_disabled: bookingDetails.needsDisabled
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Booking failed');
            }
            
            const result = await response.json();
            showConfirmation(result.reference, result.space_number, bookingDetails.duration, bookingDetails.totalCost);
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        alert(error.message || 'Payment failed. Please try again.');
    }
}

function validateCardWithLuhn(cardNumber) {
    // Remove all non-digit characters
    cardNumber = cardNumber.replace(/\D/g, '');
    
    // Check if empty or not all digits
    if (!cardNumber || !/^\d+$/.test(cardNumber)) {
        return false;
    }
    
    let sum = 0;
    let shouldDouble = false;
    
    // Loop through digits from right to left
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber.charAt(i));
        
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    
    return (sum % 10) === 0;
}

function showConfirmation(reference, spaceNumber, duration, amount) {
    document.getElementById('confirmation-ref').textContent = reference;
    document.getElementById('confirmation-space').textContent = spaceNumber || 'Will be assigned on arrival';
    
    if (duration) {
        const now = new Date();
        const endTime = new Date(now.getTime() + parseInt(duration) * 60 * 60 * 1000);
        document.getElementById('confirmation-time').textContent = 
            `${now.toLocaleTimeString()} to ${endTime.toLocaleTimeString()}`;
    }
    
    document.getElementById('confirmation-amount').textContent = `£${parseFloat(amount).toFixed(2)}`;
    
    document.getElementById('confirmation-modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('confirmation-modal').classList.add('hidden');
}

function redirectToHome() {
    window.location.href = 'main.html';
}