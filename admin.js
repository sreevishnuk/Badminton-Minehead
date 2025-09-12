import { auth, db, storage } from './firebase-config.js';

// DOM Elements
const registrationStatus = document.getElementById('registrationStatus');
const toggleRegistrationBtn = document.getElementById('toggleRegistration');
const generateFixturesBtn = document.getElementById('generateFixturesBtn');
const resetFixturesBtn = document.getElementById('resetFixturesBtn');
const logoutBtn = document.getElementById('logoutBtn');
const singlesPlayersList = document.getElementById('singlesPlayersList');
const doublesPlayersList = document.getElementById('doublesPlayersList');
const addPlayerForm = document.getElementById('addPlayerForm');
const singlesFixtures = document.getElementById('singlesFixtures');
const doublesFixtures = document.getElementById('doublesFixtures');

// Navigation
const adminNavLinks = document.querySelectorAll('.admin-nav a');
const adminSections = document.querySelectorAll('.admin-section');

// State
let registrationOpen = true;

// Initialize Admin Dashboard
document.addEventListener('DOMContentLoaded', async function() {
    // Set up navigation
    adminNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links and sections
            adminNavLinks.forEach(l => l.classList.remove('active'));
            adminSections.forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked link and corresponding section
            this.classList.add('active');
            const targetId = this.getAttribute('href');
            document.querySelector(targetId).classList.add('active');
        });
    });
    
    // Setup logout button
    logoutBtn.addEventListener('click', logout);
    
    // Load current registration status
    await loadRegistrationStatus();
    
    // Setup toggle registration button
    toggleRegistrationBtn.addEventListener('click', toggleRegistration);
    
    // Setup add player form
    addPlayerForm.addEventListener('submit', addNewPlayer);
    
    // Setup fixtures generation
    generateFixturesBtn.addEventListener('click', generateFixtures);
    resetFixturesBtn.addEventListener('click', resetFixtures);
    
    // Listen for changes in players collection
    setupPlayerListeners();
    
    // Load existing players
    loadPlayers();
    
    // Load existing fixtures
    loadFixtures();
});

// Toggle registration status
async function toggleRegistration() {
    registrationOpen = !registrationOpen;
    
    if (registrationOpen) {
        registrationStatus.textContent = 'Open';
        registrationStatus.classList.remove('closed');
        toggleRegistrationBtn.textContent = 'Close Registration';
    } else {
        registrationStatus.textContent = 'Closed';
        registrationStatus.classList.add('closed');
        toggleRegistrationBtn.textContent = 'Open Registration';
    }
    
    // Save to Firestore
    await db.collection('tournament').doc('settings').set({
        registrationOpen: registrationOpen
    }, { merge: true });
}

// Load registration status from Firestore
async function loadRegistrationStatus() {
    try {
        const doc = await db.collection('tournament').doc('settings').get();
        if (doc.exists) {
            const data = doc.data();
            registrationOpen = data.registrationOpen !== undefined ? data.registrationOpen : true;
            
            if (registrationOpen) {
                registrationStatus.textContent = 'Open';
                registrationStatus.classList.remove('closed');
                toggleRegistrationBtn.textContent = 'Close Registration';
            } else {
                registrationStatus.textContent = 'Closed';
                registrationStatus.classList.add('closed');
                toggleRegistrationBtn.textContent = 'Open Registration';
            }
        }
    } catch (error) {
        console.error('Error loading registration status:', error);
    }
}

// Add new player
async function addNewPlayer(e) {
    e.preventDefault();
    
    const playerName = document.getElementById('playerName').value.trim();
    const playerEmail = document.getElementById('playerEmail').value.trim();
    const playerPhone = document.getElementById('playerPhone').value.trim();
    const registerSingles = document.getElementById('singles').checked;
    const registerDoubles = document.getElementById('doubles').checked;
    
    if (!playerName) {
        alert('Please enter a player name');
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
            createdAt: new Date().toISOString(),
            id: crypto.randomUUID()
        };
        
        await db.collection('players').add(playerData);
        
        // Reset form
        addPlayerForm.reset();
        
        // Show success message
        alert('Player added successfully!');
        
    } catch (error) {
        console.error('Error adding player:', error);
        alert('Failed to add player: ' + error.message);
    }
}

// Load players from Firestore
async function loadPlayers() {
    try {
        const snapshot = await db.collection('players').orderBy('name').get();
        
        singlesPlayersList.innerHTML = '';
        doublesPlayersList.innerHTML = '';
        
        snapshot.docs.forEach(doc => {
            const player = doc.data();
            const playerItem = document.createElement('li');
            playerItem.innerHTML = `
                ${player.name} 
                <button class="delete-btn" data-id="${doc.id}">Delete</button>
            `;
            
            if (player.singles) {
                singlesPlayersList.appendChild(playerItem);
            }
            
            if (player.doubles) {
                doublesPlayersList.appendChild(playerItem);
            }
            
            // Add delete event listener
            playerItem.querySelector('.delete-btn').addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this player?')) {
                    await db.collection('players').doc(doc.id).delete();
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading players:', error);
    }
}

// Set up listeners for player collection changes
function setupPlayerListeners() {
    db.collection('players').onSnapshot((snapshot) => {
        loadPlayers();
    });
}

// Generate fixtures for both Singles and Doubles
async function generateFixtures() {
    if (!registrationOpen) {
        alert('Cannot generate fixtures while registration is closed.');
        return;
    }
    
    // Get all players
    const snapshot = await db.collection('players').get();
    const players = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    
    // Separate players by category
    const singlesPlayers = players.filter(p => p.singles);
    const doublesPlayers = players.filter(p => p.doubles);
    
    // Validate that we have enough players
    if (singlesPlayers.length < 2) {
        alert('Not enough players registered for Singles. Need at least 2 players.');
        return;
    }
    
    if (doublesPlayers.length < 2) {
        alert('Not enough players registered for Doubles. Need at least 2 players.');
        return;
    }
    
    // Create random pairings for Singles
    const singlesFixturesData = createKnockoutBracket(singlesPlayers, 'Singles');
    
    // Create random pairings for Doubles
    const doublesFixturesData = createKnockoutBracket(doublesPlayers, 'Doubles');
    
    // Save fixtures to Firestore
    await db.collection('tournament').doc('fixtures').set({
        singles: singlesFixturesData,
        doubles: doublesFixturesData,
        generatedAt: new Date().toISOString()
    });
    
    // Display fixtures
    displayFixtures(singlesFixturesData, 'singlesFixtures');
    displayFixtures(doublesFixturesData, 'doublesFixtures');
    
    // Close registration after generating fixtures
    registrationOpen = false;
    registrationStatus.textContent = 'Closed';
    registrationStatus.classList.add('closed');
    toggleRegistrationBtn.textContent = 'Open Registration';
    
    // Save updated registration status
    await db.collection('tournament').doc('settings').set({
        registrationOpen: false
    }, { merge: true });
    
    alert('Fixtures generated successfully! Registration has been closed.');
}

// Create knockout bracket for a category
function createKnockoutBracket(players, category) {
    // Shuffle players randomly
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    
    // Calculate number of rounds needed
    let numPlayers = shuffled.length;
    let round = 1;
    let nextRoundPlayers = [];
    let bracket = [];
    
    // Keep track of rounds
    const rounds = [];
    
    // Create initial round (Quarterfinals or Round of 16 depending on player count)
    let currentRound = [];
    
    // Determine the base size (next power of 2)
    let baseSize = 1;
    while (baseSize < numPlayers) {
        baseSize *= 2;
    }
    
    // If we have fewer than 8 players, start with quarterfinals
    // If we have 8-15 players, start with quarterfinals
    // If we have 16+ players, start with round of 16
    let firstRoundLabel = 'Quarterfinal';
    if (numPlayers > 16) {
        firstRoundLabel = 'Round of 16';
    } else if (numPlayers > 8) {
        firstRoundLabel = 'Quarterfinal';
    } else if (numPlayers > 4) {
        firstRoundLabel = 'Semifinal';
    } else if (numPlayers > 2) {
        firstRoundLabel = 'Final';
    }
    
    // Handle byes for uneven numbers
    if (numPlayers > 2) {
        const byesNeeded = baseSize - numPlayers;
        
        // First round matches
        for (let i = 0; i < numPlayers - byesNeeded; i += 2) {
            currentRound.push({
                id: crypto.randomUUID(),
                round: firstRoundLabel,
                player1: shuffled[i],
                player2: shuffled[i + 1],
                score1: null,
                score2: null,
                winner: null,
                played: false
            });
        }
        
        // Byes for remaining players
        for (let i = numPlayers - byesNeeded; i < numPlayers; i++) {
            currentRound.push({
                id: crypto.randomUUID(),
                round: firstRoundLabel,
                player1: shuffled[i],
                player2: null,
                score1: null,
                score2: null,
                winner: shuffled[i],
                played: true,
                bye: true
            });
        }
    } else if (numPlayers === 2) {
        // Final match
        currentRound.push({
            id: crypto.randomUUID(),
            round: 'Final',
            player1: shuffled[0],
            player2: shuffled[1],
            score1: null,
            score2: null,
            winner: null,
            played: false
        });
    } else if (numPlayers === 1) {
        // Single player wins by default
        currentRound.push({
            id: crypto.randomUUID(),
            round: 'Final',
            player1: shuffled[0],
            player2: null,
            score1: null,
            score2: null,
            winner: shuffled[0],
            played: true,
            bye: true
        });
    }
    
    rounds.push({
        label: firstRoundLabel,
        matches: [...currentRound]
    });
    
    // Continue creating rounds until we have a winner
    let currentRoundMatches = [...currentRound];
    
    while (currentRoundMatches.length > 1) {
        const nextRound = [];
        const nextRoundLabel = getNextRoundLabel(currentRoundMatches.length);
        
        // Pair winners from previous round
        for (let i = 0; i < currentRoundMatches.length; i += 2) {
            if (i + 1 < currentRoundMatches.length) {
                // Both players are present
                nextRound.push({
                    id: crypto.randomUUID(),
                    round: nextRoundLabel,
                    player1: currentRoundMatches[i].winner,
                    player2: currentRoundMatches[i + 1].winner,
                    score1: null,
                    score2: null,
                    winner: null,
                    played: false
                });
            } else {
                // Odd number - last winner advances automatically
                nextRound.push({
                    id: crypto.randomUUID(),
                    round: nextRoundLabel,
                    player1: currentRoundMatches[i].winner,
                    player2: null,
                    score1: null,
                    score2: null,
                    winner: currentRoundMatches[i].winner,
                    played: true,
                    bye: true
                });
            }
        }
        
        rounds.push({
            label: nextRoundLabel,
            matches: [...nextRound]
        });
        
        currentRoundMatches = nextRound;
    }
    
    return rounds;
}

// Helper function to determine next round label
function getNextRoundLabel(numMatches) {
    if (numMatches === 2) {
        return 'Final';
    } else if (numMatches === 4) {
        return 'Semifinal';
    } else if (numMatches === 8) {
        return 'Quarterfinal';
    } else if (numMatches === 16) {
        return 'Round of 16';
    } else if (numMatches === 32) {
        return 'Round of 32';
    } else {
        return `Round ${Math.ceil(Math.log2(numMatches))}`;
    }
}

// Display fixtures in the HTML
function displayFixtures(fixturesData, containerId) {
    const container = document.getElementById(containerId);
    
    if (!fixturesData || fixturesData.length === 0) {
        container.innerHTML = '<p>No fixtures generated yet.</p>';
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
                html += `<div class="match-score">`;
                html += `<input type="number" min="0" max="2" value="" placeholder="0" style="width: 30px;">`;
                html += ` - `;
                html += `<input type="number" min="0" max="2" value="" placeholder="0" style="width: 30px;">`;
                html += `</div>`;
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
    
    // Add event listeners for score updates
    const scoreInputs = container.querySelectorAll('.match-score input');
    scoreInputs.forEach(input => {
        input.addEventListener('change', function() {
            // This would normally update the score in Firestore
            // For simplicity, we're just showing the UI
            const matchDiv = this.closest('.match');
            const inputs = matchDiv.querySelectorAll('input');
            const scores = [inputs[0].value, inputs[1].value];
            
            if (scores[0] !== '' && scores[1] !== '') {
                const winner = parseInt(scores[0]) > parseInt(scores[1]) ? 1 : 2;
                const winnerName = matchDiv.querySelectorAll('.match-player')[winner - 1].querySelector('span').textContent;
                
                // Update UI to show winner
                const winnerSpan = document.createElement('div');
                winnerSpan.className = 'match-winner';
                winnerSpan.textContent = `Winner: ${winnerName}`;
                matchDiv.appendChild(winnerSpan);
            }
        });
    });
}

// Load fixtures from Firestore
async function loadFixtures() {
    try {
        const doc = await db.collection('tournament').doc('fixtures').get();
        if (doc.exists) {
            const data = doc.data();
            displayFixtures(data.singles, 'singlesFixtures');
            displayFixtures(data.doubles, 'doublesFixtures');
        }
    } catch (error) {
        console.error('Error loading fixtures:', error);
    }
}

// Reset fixtures
async function resetFixtures() {
    if (confirm('Are you sure you want to reset all fixtures? This cannot be undone.')) {
        await db.collection('tournament').doc('fixtures').delete();
        
        // Clear the display
        document.getElementById('singlesFixtures').innerHTML = '<p>No fixtures generated yet. Click "Generate Fixtures" to create the bracket.</p>';
        document.getElementById('doublesFixtures').innerHTML = '<p>No fixtures generated yet. Click "Generate Fixtures" to create the bracket.</p>';
        
        // Reopen registration
        registrationOpen = true;
        registrationStatus.textContent = 'Open';
        registrationStatus.classList.remove('closed');
        toggleRegistrationBtn.textContent = 'Close Registration';
        
        // Save updated registration status
        await db.collection('tournament').doc('settings').set({
            registrationOpen: true
        }, { merge: true });
        
        alert('Fixtures have been reset and registration reopened.');
    }
}

// Logout function
function logout() {
    // Sign out from Firebase Auth (if implemented)
    // For now, just clear local storage and redirect
    localStorage.removeItem('isAdmin');
    window.location.href = 'login.html';
}