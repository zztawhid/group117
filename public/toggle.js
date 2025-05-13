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


