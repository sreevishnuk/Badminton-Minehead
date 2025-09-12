// script.js
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');

    if (!loginForm) {
        console.error('Login form not found!');
        return;
    }

    // Firebase SDK loaded via CDN in login.html — now available globally as `firebase`
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            loginError.textContent = 'Please enter both email and password.';
            return;
        }

        loginError.textContent = 'Signing in...';

        try {
            // Initialize Firebase app (if not already done)
            if (!firebase.apps.length) {
                firebase.initializeApp({
                    apiKey: "AIzaSyBQvr257MnUMdv-i4VkgjaGUPnSho3F_x0",
                    authDomain: "minehead-badminton-tournament.firebaseapp.com",
                    projectId: "minehead-badminton-tournament",
                    storageBucket: "minehead-badminton-tournament.firebasestorage.app",
                    messagingSenderId: "237720155580",
                    appId: "1:237720155580:web:8faed76ef425f262d727b9",
                    measurementId: "G-RG7J53MLE2"
                });
            }

            const auth = firebase.auth();
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Get custom claims to check admin status
            const idTokenResult = await user.getIdTokenResult();

            if (idTokenResult.claims.admin === true) {
                localStorage.setItem('isAdmin', 'true');
                window.location.href = 'admin.html';
            } else {
                loginError.textContent = 'Access denied. You are not authorized as an admin.';
                await auth.signOut();
            }
        } catch (error) {
            console.error('Login error:', error);

            let message = 'Login failed: ';
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    message += 'Invalid email or password.';
                    break;
                case 'auth/invalid-email':
                    message += 'Invalid email format.';
                    break;
                case 'auth/too-many-requests':
                    message += 'Too many attempts. Try again later.';
                    break;
                default:
                    message += error.message;
            }

            loginError.textContent = message;
        }
    });
});
