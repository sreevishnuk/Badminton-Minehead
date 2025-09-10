// Firebase SDK Config
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBQvr257MnUMdv-i4VkgjaGUPnSho3F_x0",
  authDomain: "minehead-badminton-tournament.firebaseapp.com",
  projectId: "minehead-badminton-tournament",
  storageBucket: "minehead-badminton-tournament.appspot.com",
  messagingSenderId: "237720155580",
  appId: "1:237720155580:web:8faed76ef425f262d727b9",
  measurementId: "G-RG7J53MLE2"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Add Firestore SDK for data storage:
import { getFirestore } from "firebase/firestore";
const db = getFirestore(app);


// Login Function
function loginAdmin() {
  const password = document.getElementById('admin-pass').value;
  if (password === "adminPassword") { // Replace with your admin password
    window.location.href = 'admin.html';
  } else {
    document.getElementById('login-error').innerText = "Incorrect password!";
  }
}

// Registration Form Submission
document.getElementById('registration-form').onsubmit = async function(e) {
  e.preventDefault();
  const name = document.getElementById('player-name').value;
  const singles = document.getElementById('singles').checked;
  const doubles = document.getElementById('doubles').checked;
  let fee = (singles ? 2 : 0) + (doubles ? 2 : 0);

  if (!singles && !doubles) {
    alert('Select at least one category');
    return;
  }

  // Save player info in Firestore
  await addDoc(collection(db, "players"), {
    name,
    singles,
    doubles,
    fee
  });

  document.getElementById('registration-success').innerText = "Registration successful! Fee: £" + fee;
}

// Admin Dashboard Functions
async function toggleRegistration() {
  // Toggle registration status in Firestore
}

async function generateFixtures() {
  // Get registered players, randomize and save bracket fixtures for Singles & Doubles
  // In doubles, shuffle all double players, then pair them randomly
}

// Editing and scoring logic similar: fetch fixtures, allow admin to edit, save back

// Displaying Fixtures
async function loadFixtures() {
  // Fetch and display fixtures from Firestore for singles and doubles
}
