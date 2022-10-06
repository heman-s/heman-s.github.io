(function () {
    // https://dashboard.emailjs.com/admin/account
    emailjs.init('cNHRcAI4RRO1qgz91');
})();
        
window.onload = function () {
    document.getElementById('contactForm').addEventListener('submit', function (event) {
        const form = document.getElementById('contactForm');
        const email = form.elements['email'];

        var mailformat = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

        if (email.value.match(mailformat)) {
            event.preventDefault();
            // generate a five digit number for the contact_number variable
            this.contact_number.value = Math.random() * 100000 | 0;
            // these IDs from the previous steps
            emailjs.sendForm('service_hawf34r', 'template_8618927', this)
                .then(function () {
                    window.alert("Email Sent Successfully\n\nWe'll get back to you shortly");
                }, function (error) {
                    window.alert("Error sending email\n\nTry again later");
                });
        }
        else {
            window.alert("Invalid Email Entered");
        }
    });
}