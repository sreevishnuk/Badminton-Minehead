// Global script for common functionality across pages

// Check if user is logged in as admin
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners for login form on login.html
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                // In a real app, you'd have admin users set up in Firebase Authentication
                // For this demo, we'll use a simple admin credential
                // In production, use Firebase Authentication with custom claims or a separate admin collection
                
                // This is a simplified approach - in reality, you'd authenticate with Firebase Auth
                if (email === 'admin@mineheadbadminton.com' && password === 'admin123') {
                    localStorage.setItem('isAdmin', 'true');
                    window.location.href = 'admin.html';
                } else {
                    document.getElementById('loginError').textContent = 'Invalid credentials. Try admin@mineheadbadminton.com / admin123';
                }
            } catch (error) {
                document.getElementById('loginError').textContent = 'Login failed: ' + error.message;
            }
        });
    }
    
    // Check if user is admin on admin page
    if (window.location.pathname.includes('admin.html')) {
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        if (!isAdmin) {
            window.location.href = 'login.html';
        }
    }
});

// Function to handle logout
function logout() {
    localStorage.removeItem('isAdmin');
    window.location.href = 'login.html';
}