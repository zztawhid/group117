/*  <!-- Right before your closing </body> tag -->
<script>
document.addEventListener('DOMContentLoaded', function() {
    // Select all FAQ questions
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    // Add click event to each question
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            // Get the parent FAQ item
            const faqItem = this.parentElement;
            
            // Toggle active class
            faqItem.classList.toggle('active');
            
            // Optional: Close other FAQs (accordion behavior)
            document.querySelectorAll('.faq-item').forEach(item => {
                if (item !== faqItem && item.classList.contains('active')) {
                    item.classList.remove('active');
                }
            });
        });
    });
    
    // Debugging check
    console.log('FAQ script loaded. Found', faqQuestions.length, 'FAQ questions.');
});
</script> */

function toggleDropdown() {
    const topnav = document.querySelector('.topnav');
    topnav.classList.toggle('slide-in');
}

function toggleLanguageDropdown() {
    console.log('toggleLanguageDropdown clicked');
    const languageDropdown = document.querySelector('#language-dropdown');
    languageDropdown.classList.toggle('hidden');
}

function changeLanguage(lang) {
    // changes the language of the website and changes the flag based on user preferences
    const mainFlag = document.querySelector('.header-button img');

    if (lang === 'en') {
        mainFlag.src = 'images/england.jpg';
        mainFlag.alt = 'English Flag';
        alert('Language changed to English');
    } else if (lang === 'fr') {
        mainFlag.src = 'images/france.png';
        mainFlag.alt = 'French Flag';
        alert('Langue changée en Français');
    } else if (lang === 'cn') {
        mainFlag.src = 'images/china.png';
        mainFlag.alt = 'Chinese Flag';
        alert('语言已更改为中文');
    }

    // Hide the dropdown after selection
    toggleLanguageDropdown();
}

/* PLEASE FINISH THIS JS FILE TO LISTEN FOR CLICK EVENT AND CREATE A WORKING DROP DOWN MENU
IF CSS IS NEEDED TO MAKE IT LOOK BETTER PLEASE LET TAYLOR KNOW THE CHANGES*/
