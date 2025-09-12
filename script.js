// script.js
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from 'firebase/auth';

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (!email || !password) {
                loginError.textContent = 'Please enter both email and password.';
                return;
            }

            loginError.textContent = '';

            try {
                // Sign in using Firebase Auth
                const userCredential = await signInWithEmailAndPassword(auth, email, password);

                // Check if user is an admin via custom claim (you'll set this in Firebase Console later)
                const user = userCredential.user;
                const idTokenResult = await user.getIdTokenResult();

                if (idTokenResult.claims.admin === true) {
                    localStorage.setItem('isAdmin', 'true');
                    window.location.href = 'admin.html';
                } else {
                    // User is not an admin — show error
                    loginError.textContent = 'Access denied. You are not authorized as an admin.';
                    await auth.signOut(); // Log out non-admin users
                }
            } catch (error) {
                console.error('Login error:', error);
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    loginError.textContent = 'Invalid credentials. Please check your email and password.';
                } else if (error.code === 'auth/invalid-email') {
                    loginError.textContent = 'Invalid email format.';
                } else {
                    loginError.textContent = 'Login failed: ' + error.message;
                }
            }
        });
    }
});
