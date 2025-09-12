import { auth, db } from './firebase-config.js';

// DOM Elements
const registrationForm = document.getElementById('playerRegistrationForm');
const registrationStatus = document.getElementById('registrationStatus');
const registrationSection = document.getElementById('registrationSection');
const registrationSuccess = document.getElementById('registrationSuccess');
const singlesFixtures = document.getElementById('singlesFixtures');
const doublesFixtures = document.getElementById('doublesFixtures');
const matchResults = document.getElementById('matchResults');

// State
let registrationOpen = false;
let fixtures = { singles: [], doubles: [] };

// Initialize Player Page
document.addEventListener('DOMContentLoaded', async function() {
    // Load registration status
    await loadRegistrationStatus();
    
    // Load fixtures
    await loadFixtures();
    
    // Load match results
    await loadResults();
    
    // Setup registration form
    registrationForm.addEventListener('submit', handleRegistration);
    
    // Update UI based on registration status
    updateRegistrationUI();
});

// Load registration status from Firestore
async function loadRegistrationStatus() {
    try {
        const doc = await db.collection('tournament').doc('settings').get();
        if (doc.exists) {
            const data = doc.data();
            registrationOpen = data.registrationOpen !== undefined ? data.registrationOpen : true;
        }
    } catch (error) {
        console.error('Error loading registration status:', error);
        registrationOpen = true; // Default to open if there's an error
    }
}

// Load fixtures from Firestore
async function loadFixtures() {
    try {
        const doc = await db.collection('tournament').doc('fixtures').get();
        if (doc.exists) {
            const data = doc.data();
            fixtures = {
                singles: data.singles || [],
                doubles: data.doubles || []
            };
            displayFixtures(fixtures.singles, 'singlesFixtures');
            displayFixtures(fixtures.doubles, 'doublesFixtures');
        } else {
            singlesFixtures.innerHTML = '<p>No fixtures generated yet. Please check back later.</p>';
            doublesFixtures.innerHTML = '<p>No fixtures generated yet. Please check back later.</p>';
        }
    } catch (error) {
        console.error('Error loading fixtures:', error);
        singlesFixtures.innerHTML = '<p>Error loading fixtures. Please try again later.</p>';
        doublesFixtures.innerHTML = '<p>Error loading fixtures. Please try again later.</p>';
    }
}

// Load match results from Firestore
async function loadResults() {
    try {
        const querySnapshot = await db.collection('tournament').doc('fixtures').collection('results').orderBy('timestamp', 'desc').limit(10).get();
        
        if (querySnapshot.empty) {
            matchResults.innerHTML = '<p>No results available yet.</p>';
            return;
        }
        
        let html = '';
        querySnapshot.forEach(doc => {
            const result = doc.data();
            html += `<div class="result-item">
                <strong>${result.player1.name} vs ${result.player2.name}</strong>
                <br>Score: ${result.score1}-${result.score2}
                <br>Winner: ${result.winner.name}
                <br><small>${new Date(result.timestamp).toLocaleString()}</small>
            </div>`;
        });
        
        matchResults.innerHTML = html;
    } catch (error) {
        console.error('Error loading results:', error);
        matchResults.innerHTML = '<p>Error loading results. Please try again later.</p>';
    }
}

// Update UI based on registration status
function updateRegistrationUI() {
    if (registrationOpen) {
        registrationStatus.innerHTML = `
            <p>Registration is currently open! Sign up now to participate in the tournament.</p>
            <p>Choose either Singles, Doubles, or both categories.</p>
        `;
        registrationSection.style.display = 'block';
        registrationSuccess.style.display = 'none';
    } else {
        registrationStatus.innerHTML = `
            <p>Registration is currently closed. The tournament fixtures have been generated.</p>
            <p>Please check the fixtures below for your match schedule.</p>
        `;
        registrationSection.style.display = 'none';
        registrationSuccess.style.display = 'none';
    }
}

// Handle player registration
async function handleRegistration(e) {
    e.preventDefault();
    
    if (!registrationOpen) {
        alert('Registration is currently closed. Please check back later.');
        return;
    }
    
    const playerName = document.getElementById('playerName').value.trim();
    const playerEmail = document.getElementById('playerEmail').value.trim();
    const playerPhone = document.getElementById('playerPhone').value.trim();
    const registerSingles = document.getElementById('singles').checked;
    const registerDoubles = document.getElementById('doubles').checked;
    
    if (!playerName) {
        alert('Please enter your full name');
        return;
    }
    
    if (!registerSingles && !registerDoubles) {
        alert('Please select at least one category (Singles or Doubles)');
        return;
    }
    
    try {
        const playerData = {
            name: playerName,
            email: playerEmail || '',
            phone: playerPhone || '',
            singles: registerSingles,
            doubles: registerDoubles,
            createdAt: new Date().toISOString()
        };
        
        await db.collection('players').add(playerData);
        
        // Show success message
        registrationForm.reset();
        registrationSuccess.style.display = 'block';
        registrationStatus.style.display = 'none';
        
        // Show confirmation
        alert('Thank you for registering! You will receive your fixture details shortly.');
        
    } catch (error) {
        console.error('Error registering player:', error);
        alert('Failed to register: ' + error.message);
    }
}

// Display fixtures in the HTML
function displayFixtures(fixturesData, containerId) {
    const container = document.getElementById(containerId);
    
    if (!fixturesData || fixturesData.length === 0) {
        container.innerHTML = '<p>No fixtures generated yet. Please check back later.</p>';
        return;
    }
    
    let html = '';
    
    fixturesData.forEach(round => {
        html += `<div class="round-title">${round.label}</div>`;
        
        round.matches.forEach(match => {
            html += `<div class="match">`;
            
            // Player 1
            if (match.player1) {
                html += `<div class="match-player"><span>${match.player1.name}</span></div>`;
            } else {
                html += `<div class="match-player"><span>-</span></div>`;
            }
            
            // Score area
            if (match.played) {
                html += `<div class="match-score">`;
                html += `<span>${match.score1 || '-'}</span> - <span>${match.score2 || '-'}</span>`;
                if (match.winner) {
                    html += `<div class="match-winner">Winner: ${match.winner.name}</div>`;
                }
                html += `</div>`;
            } else {
                html += `<div class="match-score">TBD</div>`;
            }
            
            // Player 2
            if (match.player2) {
                html += `<div class="match-player"><span>${match.player2.name}</span></div>`;
            } else {
                html += `<div class="match-player"><span>-</span></div>`;
            }
            
            html += `</div>`;
        });
    });
    
    container.innerHTML = html;
}