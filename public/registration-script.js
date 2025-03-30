document.addEventListener('DOMContentLoaded', function() {
    // Form handling
    const registrationForm = document.querySelector('.register-form-box form');
    const addVehicleBtn = document.querySelector('.add-vehicle-button');
    const overlay = document.getElementById('overlay');
    const vehicleForm = document.getElementById('myForm');
    const regPlateInput = document.querySelector('#myForm input[name="reg-plate"]');
    
    let licensePlate = ''; // Store the vehicle registration

    // Vehicle form handling
    function openForm() {
        vehicleForm.style.display = 'block';
        overlay.style.display = 'block';
    }

    function closeForm() {
        vehicleForm.style.display = 'none';
        overlay.style.display = 'none';
    }

    overlay.addEventListener('click', closeForm);
    addVehicleBtn.addEventListener('click', openForm);

    // Handle vehicle form submission
    document.querySelector('#myForm .btn').addEventListener('click', function(e) {
        e.preventDefault();
        licensePlate = regPlateInput.value.trim();
        if (licensePlate) {
            addVehicleBtn.textContent = licensePlate;
            closeForm();
        }
    });

    // Password validation
    const passwordInput = document.getElementById('password');
    passwordInput.addEventListener('input', checkPassword);

    function checkPassword() {
        const password = passwordInput.value;
        
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            specialchar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        // Update UI
        Object.keys(requirements).forEach(key => {
            const element = document.getElementById(`password-${key}`);
            element.classList.toggle('valid', requirements[key]);
        });
    }

    // Form submission
    registrationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form values
        const formData = {
            firstName: this.elements['first-name'].value.trim(),
            lastName: this.elements['last-name'].value.trim(),
            phone: this.elements['phone-number'].value.trim(),
            email: this.elements['email'].value.trim(),
            password: this.elements['password'].value,
            confirmPassword: this.elements['again-password'].value,
            licensePlate: licensePlate
        };

        // Validate form
        if (!validateForm(formData)) return;

        try {
            // Disable button during submission
            const submitBtn = this.elements['register'];
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering...';

            // Send to server
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                alert('Registration successful!');
                window.location.href = 'login.html';
            } else {
                throw new Error(result.message || 'Registration failed');
            }
        } catch (error) {
            alert(error.message);
        } finally {
            const submitBtn = this.elements['register'];
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    });

    function validateForm(data) {
        // Check required fields
        if (!data.firstName || !data.lastName || !data.phone || !data.email || 
            !data.password || !data.confirmPassword) {
            alert('Please fill in all fields');
            return false;
        }

        // Check password match
        if (data.password !== data.confirmPassword) {
            alert('Passwords do not match');
            return false;
        }

        // Check password requirements
        const passwordValid = (
            data.password.length >= 8 &&
            /[A-Z]/.test(data.password) &&
            /[a-z]/.test(data.password) &&
            /[0-9]/.test(data.password) &&
            /[!@#$%^&*(),.?":{}|<>]/.test(data.password)
        );

        if (!passwordValid) {
            alert('Password does not meet requirements');
            return false;
        }

        // Check vehicle added if required
        if (!data.licensePlate) {
            alert('Please add your vehicle details');
            return false;
        }

        return true;
    }
});