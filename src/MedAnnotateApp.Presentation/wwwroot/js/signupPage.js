document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector("form[method='post'][asp-action='Signup']");
    const validationSummary = document.querySelector(".text-danger"); // Validation summary container

    if (form) {
        form.addEventListener("submit", async function (event) {
            event.preventDefault(); // Prevent traditional form submission

            const formData = new FormData(form); // Gather form data
            const submitButton = form.querySelector("button[type='submit']");

            try {
                // Disable the submit button to prevent multiple clicks
                submitButton.disabled = true;

                const response = await fetch(form.action, {
                    method: "POST",
                    body: formData
                });

                const result = await response.json();

                // Clear previous validation messages
                validationSummary.innerHTML = "";

                if (result.success) {
                    // Redirect if the server provides a redirect URL
                    if (result.redirectUrl) {
                        window.location.href = result.redirectUrl;
                    } else {
                            window.location.href = "/Identity/Login"; // Ensure the fallback URL matches your Login page
                    }
                } else {
                    // Display validation errors
                    if (result.errors && Array.isArray(result.errors)) {
                        result.errors.forEach((error) => {
                            const errorElement = document.createElement("p");
                            errorElement.textContent = error;
                            validationSummary.appendChild(errorElement);
                        });
                    } else {
                        validationSummary.textContent = "An unknown error occurred.";
                    }
                }
            } catch (error) {
                console.error("An error occurred during form submission:", error);
                validationSummary.textContent = "An unexpected error occurred. Please try again.";
            } finally {
                // Re-enable the submit button
                submitButton.disabled = false;
            }
        });
    }
});
