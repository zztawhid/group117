document.addEventListener('DOMContentLoaded', function() {
    //Form selection from registration page
    const registrationForm = document.querySelector('.register-form-box form');
    const addVehicleBtn = document.querySelector('.add-vehicle-button');
    const overlay = document.getElementById('overlay');
    const vehicleForm = document.getElementById('myForm');
    const regPlateInput = document.querySelector('#myForm input[name="reg-plate"]');
    
    let licensePlate = '';

    // Vehicle open pop up form handling
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

        Object.keys(requirements).forEach(key => {
            const element = document.getElementById(`password-${key}`);
            element.classList.toggle('valid', requirements[key]);
        });
    }

    // Name validation (letters only)
    function validateName(name) {
        return /^[A-Za-z\s]+$/.test(name);
    }

    // Form submission
    registrationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear previous errors - iterates through each elements, and el.remove() removes each element from the DOM 
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(el => el.remove());

        // Get form values
        const formData = {
            firstName: this.elements['first-name'].value.trim(),
            lastName: this.elements['last-name'].value.trim(),
            phone: this.elements['phone-number'].value.trim(),
            email: this.elements['email'].value.trim(),
            password: this.elements['password'].value,
            confirmPassword: this.elements['again-password'].value,
            licensePlate: licensePlate,
            mailingList: this.elements['simple-checkbox'].checked
        };

        // Validate form
        if (!validateForm(formData)) return;

        try {
            const submitBtn = this.elements['register'];
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering...';

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
                const errorElement = document.createElement('div');
                errorElement.className = 'error-message';
                errorElement.style.color = 'red';
                errorElement.textContent = result.message;
                registrationForm.prepend(errorElement);
            }
        } catch (error) {
            console.error(error);
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

        // Validate names (letters only)
        if (!validateName(data.firstName) || !validateName(data.lastName)) {
            alert('Name can only contain letters');
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

        // Check vehicle added
        if (!data.licensePlate) {
            alert('Please add your vehicle details');
            return false;
        }

        return true;
    }
});