document.addEventListener('DOMContentLoaded', function() {
    const emergencyBtn = document.getElementById('emergencyBtn');
    const feedbackForm = document.getElementById('feedbackForm');
    const statusElement = document.getElementById('formStatus');

    // Emergency contact
    if (emergencyBtn) {
        emergencyBtn.addEventListener('click', function() {
            window.location.href = 'tel:+4401603592222';
        });
    }

    // Feedback form
    if (feedbackForm && statusElement) {
        feedbackForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const submitBtn = feedbackForm.querySelector('[type="submit"]');
            
            try {
                // Disable button during submission
                submitBtn.disabled = true;
                statusElement.textContent = 'Submitting...';
                statusElement.style.color = 'blue';

                const formData = {
                    message: e.target.elements['fform'].value.trim(),
                    email: e.target.elements['email'].value.trim()
                };

                // Basic client-side validation
                if (!formData.message || !formData.email) {
                    throw new Error('Please fill in all fields');
                }

                if (formData.message.length < 50){
                    throw new Error('Message must be at least 50 characters long');
                }

                if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
                    throw new Error('Please enter a valid email address');
                }

                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Submission failed');
                }

                statusElement.textContent = 'Thank you! Your feedback has been submitted.';
                statusElement.style.color = 'green';
                feedbackForm.reset();
                
            } catch (error) {
                statusElement.textContent = error.message;
                statusElement.style.color = 'red';
                console.error('Feedback submission error:', error);
            } finally {
                submitBtn.disabled = false;
            }
        });
    }
});