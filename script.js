console.log("Loaded updated script.js");

// Firebase setup and imports — TRAILING SPACES REMOVED ✅
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQvr257MnUMdv-i4VkgjaGUPnSho3F_x0",
  authDomain: "minehead-badminton-tournament.firebaseapp.com",
  projectId: "minehead-badminton-tournament",
  storageBucket: "minehead-badminton-tournament.appspot.com",
  messagingSenderId: "237720155580",
  appId: "1:237720155580:web:8faed76ef425f262d727b9",
  measurementId: "G-RG7J53MLE2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Admin login function
async function loginAdmin() {
  const email = document.getElementById('admin-email')?.value.trim();
  const password = document.getElementById('admin-pass')?.value.trim();
  const errorDiv = document.getElementById('login-error');
  if (errorDiv) errorDiv.innerText = '';

  if (!email || !password) {
    if (errorDiv) errorDiv.innerText = 'Please enter email and password.';
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = 'admin.html'; // Redirect on successful login
  } catch (error) {
    if (errorDiv) errorDiv.innerText = error.message || 'Login failed.';
  }
}

// Utility to get/set registration status
const registrationStatusDoc = doc(db, "config", "registration");

async function getRegistrationStatus() {
  const snap = await getDoc(registrationStatusDoc);
  if (!snap.exists()) {
    await setDoc(registrationStatusDoc, { open: true }); // open by default
    return true;
  }
  return snap.data().open;
}

async function setRegistrationStatus(open) {
  await setDoc(registrationStatusDoc, { open });
}

// Registration form submit - call this from register.html
async function submitRegistrationForm(event) {
  event.preventDefault();

  const name = document.getElementById('player-name')?.value.trim();
  const singles = document.getElementById('singles')?.checked;
  const doubles = document.getElementById('doubles')?.checked;

  if (!name) {
    alert("Please enter your name.");
    return;
  }
  if (!singles && !doubles) {
    alert("Select at least one category.");
    return;
  }

  // Check if registration is open
  const open = await getRegistrationStatus();
  if (!open) {
    alert("Registration is currently closed.");
    return;
  }

  let fee = 0;
  if (singles) fee += 2;
  if (doubles) fee += 2;

  // Add player to Firestore "players" collection
  try {
    await addDoc(collection(db, "players"), {
      name,
      singles,
      doubles,
      fee,
      createdAt: new Date().toISOString()
    });
    const successDiv = document.getElementById('registration-success');
    if (successDiv) {
      successDiv.innerText = `Successfully registered. Please pay £${fee}.`;
    }
    const form = document.getElementById('registration-form');
    if (form) form.reset();
  } catch (error) {
    alert("Error registering player: " + error.message);
  }
}

// Load players and show in admin dashboard
async function loadPlayers() {
  const playersListDiv = document.getElementById('players-list');
  if (!playersListDiv) return;

  playersListDiv.innerHTML = 'Loading players...';

  try {
    const querySnapshot = await getDocs(collection(db, "players"));
    if (querySnapshot.empty) {
      playersListDiv.innerHTML = "<p>No players registered yet.</p>";
      return;
    }

    let html = `<table border="1" style="width:100%;border-collapse:collapse;">
      <thead><tr>
      <th>Name</th><th>Singles</th><th>Doubles</th><th>Fee (£)</th><th>Actions</th>
      </tr></thead><tbody>`;

    querySnapshot.forEach(docSnap => {
      const p = docSnap.data();
      html += `<tr>
        <td>${p.name}</td>
        <td>${p.singles ? "Yes" : "No"}</td>
        <td>${p.doubles ? "Yes" : "No"}</td>
        <td>${p.fee}</td>
        <td><button onclick="removePlayer('${docSnap.id}')">Remove</button></td>
      </tr>`;
    });
    html += "</tbody></table>";

    playersListDiv.innerHTML = html;
  } catch (error) {
    playersListDiv.innerHTML = `<p>Error loading players: ${error.message}</p>`;
  }
}

// Remove player by doc ID
async function removePlayer(playerId) {
  if (!confirm("Are you sure you want to remove this player?")) return;

  try {
    await deleteDoc(doc(db, "players", playerId));
    alert("Player removed.");
    loadPlayers();
  } catch (error) {
    alert("Failed to remove player: " + error.message);
  }
}

// Enable or disable registration (button toggle)
async function toggleRegistration() {
  const btn = document.querySelector('button[onclick="toggleRegistration()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Updating...";
  }

  try {
    let open = await getRegistrationStatus();
    await setRegistrationStatus(!open);
    alert("Registration is now " + (!open ? "OPEN" : "CLOSED"));
  } catch (error) {
    alert("Error updating registration status: " + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Enable/Disable Registration";
    }
  }
}

// ✅ ✅ ✅ FIXED: Generate fixtures + FORCE CLOSE REGISTRATION
async function generateFixtures() {
  const btn = document.querySelector('button[onclick="generateFixtures()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Generating...";
  }

  try {
    // ✅ FORCE CLOSE REGISTRATION
    await setRegistrationStatus(false);
    console.log("✅ Registration closed automatically.");

    // Fetch players
    const allPlayersSnapshot = await getDocs(collection(db, "players"));
    const players = [];
    allPlayersSnapshot.forEach(docSnap => {
      players.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Filter Singles and Doubles
    const singlesPlayers = players.filter(p => p.singles);
    const doublesPlayers = players.filter(p => p.doubles);

    // Generate singles knockout bracket
    const singlesFixtures = createKnockoutBrackets(singlesPlayers);

    // Generate doubles random pairs + knockout
    const doublesFixtures = createDoublesBrackets(doublesPlayers);

    // ✅ Delete old docs to avoid schema conflicts
    const singlesRef = doc(db, "fixtures", "singles");
    const doublesRef = doc(db, "fixtures", "doubles");

    await deleteDoc(singlesRef).catch(() => {});
    await deleteDoc(doublesRef).catch(() => {});

    // ✅ Save fresh — now using { round: 1, matches: [...] } structure
    await setDoc(singlesRef, { rounds: singlesFixtures });
    await setDoc(doublesRef, { rounds: doublesFixtures });

    console.log("✅ Fixtures saved successfully.");
    alert("Fixtures generated successfully. Registration is now CLOSED.");

    // Reload displays
    if (typeof loadFixtures === 'function') loadFixtures();
    if (typeof loadFixturesAdmin === 'function') loadFixturesAdmin();
  } catch (error) {
    console.error("❌ Error in generateFixtures:", error);
    alert("Failed to generate fixtures: " + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Generate Fixtures";
    }
  }
}

// Create bracket for knockout tournament given a player array
function createKnockoutBrackets(players) {
  const shuffled = shuffleArray(players);
  const totalPlayers = shuffled.length;
  const roundsNeeded = Math.ceil(Math.log2(totalPlayers));
  const bracketSize = Math.pow(2, roundsNeeded);

  // Add byes as needed
  while (shuffled.length < bracketSize) {
    shuffled.push(null); // bye represented by null
  }

  // Create matches for round 1
  let roundMatches = [];
  for (let i = 0; i < bracketSize; i += 2) {
    roundMatches.push({
      player1: shuffled[i],
      player2: shuffled[i + 1],
      winner: null,
      score1: 0,
      score2: 0
    });
  }

  // Prepare rounds array — ✅ FLAT STRUCTURE: { round: 1, matches: [...] }
  const rounds = [];

  // Round 1
  rounds.push({
    round: 1,
    matches: roundMatches
  });

  // Initialize empty rounds for future rounds
  for (let r = 1; r < roundsNeeded; r++) {
    const numMatches = bracketSize / Math.pow(2, r + 1);
    let emptyMatches = [];
    for (let i = 0; i < numMatches; i++) {
      emptyMatches.push({
        player1: null,
        player2: null,
        winner: null,
        score1: 0,
        score2: 0
      });
    }
    rounds.push({
      round: r + 1,
      matches: emptyMatches
    });
  }

  return rounds;
}

// Create doubles brackets with random pairs
function createDoublesBrackets(players) {
  const shuffled = shuffleArray(players);
  let pairs = [];

  // Pair players into teams
  for (let i = 0; i < shuffled.length; i += 2) {
    const p1 = shuffled[i];
    const p2 = (i + 1 < shuffled.length) ? shuffled[i + 1] : null;

    pairs.push({
      team: { player1: p1, player2: p2 },
      opponent: null,
      winner: null,
      score1: 0,
      score2: 0
    });
  }

  const totalPairs = pairs.length;
  const roundsNeeded = Math.ceil(Math.log2(totalPairs));
  const bracketSize = Math.pow(2, roundsNeeded);

  // Add byes if needed
  while (pairs.length < bracketSize) {
    pairs.push({
      team: { player1: null, player2: null },
      opponent: null,
      winner: null,
      score1: 0,
      score2: 0
    });
  }

  // First round matches
  let roundMatches = [];
  for (let i = 0; i < pairs.length; i += 2) {
    roundMatches.push({
      player1: pairs[i].team,
      player2: pairs[i + 1]?.team || null,
      winner: null,
      score1: 0,
      score2: 0
    });
  }

  const rounds = [];

  // Round 1
  rounds.push({
    round: 1,
    matches: roundMatches
  });

  // Empty future rounds
  for (let r = 1; r < roundsNeeded; r++) {
    const numMatches = bracketSize / Math.pow(2, r + 1);
    let emptyMatches = [];
    for (let i = 0; i < numMatches; i++) {
      emptyMatches.push({
        player1: null,
        player2: null,
        winner: null,
        score1: 0,
        score2: 0
      });
    }
    rounds.push({
      round: r + 1,
      matches: emptyMatches
    });
  }

  return rounds;
}

// Shuffle helper
function shuffleArray(arr) {
  const array = arr.slice();
  for(let i = array.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ✅ HELPER: Get display label for round based on number of matches
function getRoundLabel(matchCount, roundNumber) {
  if (matchCount === 4) return "Quarter Finals";
  if (matchCount === 2) return "Semi Finals";
  if (matchCount === 1) return "Final";
  return `Round ${roundNumber}`;
}

// Load fixtures for public view page (fixtures.html)
async function loadFixtures() {
  const singlesDiv = document.getElementById('singles-fixtures');
  const doublesDiv = document.getElementById('doubles-fixtures');

  if (!singlesDiv || !doublesDiv) return;

  singlesDiv.innerHTML = "Loading singles fixtures...";
  doublesDiv.innerHTML = "Loading doubles fixtures...";

  try {
    const singlesSnap = await getDoc(doc(db, "fixtures", "singles"));
    const doublesSnap = await getDoc(doc(db, "fixtures", "doubles"));

    if (singlesSnap.exists() && doublesSnap.exists()) {
      const singlesBrackets = singlesSnap.data().rounds;
      const doublesBrackets = doublesSnap.data().rounds;

      singlesDiv.innerHTML = formatBracketsHTML(singlesBrackets);
      doublesDiv.innerHTML = formatBracketsHTML(doublesBrackets, true);
    } else {
      singlesDiv.innerHTML = "No fixtures generated yet.";
      doublesDiv.innerHTML = "No fixtures generated yet.";
    }
  } catch (error) {
    singlesDiv.innerHTML = "Error loading fixtures: " + error.message;
    doublesDiv.innerHTML = "Error loading fixtures: " + error.message;
  }
}

// Admin fixture editor view loading — NOW INCLUDES WINNER SELECTION
async function loadFixturesAdmin() {
  const editDiv = document.getElementById('edit-fixtures');
  if (!editDiv) return;

  editDiv.innerHTML = "Loading fixtures...";

  try {
    const singlesSnap = await getDoc(doc(db, "fixtures", "singles"));
    const doublesSnap = await getDoc(doc(db, "fixtures", "doubles"));

    if (!(singlesSnap.exists() && doublesSnap.exists())) {
      editDiv.innerHTML = "<p>No fixtures found. Generate fixtures first.</p>";
      return;
    }

    const singlesBrackets = singlesSnap.data().rounds;
    const doublesBrackets = doublesSnap.data().rounds;

    editDiv.innerHTML = '<h3>Singles Fixtures</h3>' + formatFixtureWinnerSelectionHTML(singlesBrackets, "singles");
    editDiv.innerHTML += '<h3>Doubles Fixtures</h3>' + formatFixtureWinnerSelectionHTML(doublesBrackets, "doubles");

  } catch (error) {
    editDiv.innerHTML = "Error loading fixtures: " + error.message;
  }
}

// ✅ Inject CSS once for styling TBD and player names
function injectFixtureStyles() {
  if (document.getElementById('fixture-styles')) return; // avoid duplicates

  const style = document.createElement('style');
  style.id = 'fixture-styles';
  style.textContent = `
    .tbd {
      font-size: 0.85em;
      color: #888;
      font-style: italic;
    }
    .player-name {
      font-size: 1.1em;
      font-weight: 500;
    }
    .winner-select {
      margin: 8px 0;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #f9f9f9;
    }
    .winner-select label {
      display: block;
      margin-bottom: 4px;
      font-weight: bold;
    }
    .winner-select select {
      width: 100%;
      padding: 6px;
      margin-top: 4px;
    }
    .update-btn {
      margin-top: 8px;
      padding: 6px 12px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .update-btn:hover {
      background: #218838;
    }
  `;
  document.head.appendChild(style);
}

// Format player or pair names for display — ✅ UPDATED: "BYE" → "TBD" + HTML with classes
function formatPlayerName(playerObj, isDoubles) {
  if (!playerObj) {
    return `<span class="tbd">TBD</span>`;
  }

  if (!isDoubles) {
    const name = playerObj.name || "TBD";
    return name === "TBD"
      ? `<span class="tbd">TBD</span>`
      : `<span class="player-name">${name}</span>`;
  }

  // Doubles playerObj expected as {player1: {}, player2: {}}
  if (playerObj.player1 && playerObj.player2) {
    const name1 = playerObj.player1.name || "TBD";
    const name2 = playerObj.player2.name || "TBD";
    const display1 = name1 === "TBD" ? `<span class="tbd">TBD</span>` : `<span class="player-name">${name1}</span>`;
    const display2 = name2 === "TBD" ? `<span class="tbd">TBD</span>` : `<span class="player-name">${name2}</span>`;
    return `${display1} & ${display2}`;
  }

  return `<span class="tbd">TBD</span>`;
}

// ✅ Format fixture display WITH WINNER SELECTION DROPDOWN
function formatFixtureWinnerSelectionHTML(rounds, type) {
  injectFixtureStyles(); // ✅ Inject styles once

  let html = `<div id="${type}-winner-selection">`;
  rounds.forEach((roundObj, i) => {
    const matchCount = roundObj.matches.length;
    const roundLabel = getRoundLabel(matchCount, roundObj.round);
    html += `<h4>${roundLabel}</h4>`;
    roundObj.matches.forEach((match, j) => {
      const p1Name = formatPlayerName(match.player1, type === "doubles");
      const p2Name = formatPlayerName(match.player2, type === "doubles");

      // Skip if both players are TBD (not scheduled yet)
      if (p1Name.includes("TBD") && p2Name.includes("TBD")) {
        html += `<div class="winner-select">
          <p>Match ${j + 1}: Not yet scheduled</p>
        </div><hr>`;
        return;
      }

      // Build winner options
      let options = `<option value="">-- Select Winner --</option>`;
      if (!p1Name.includes("TBD")) {
        options += `<option value="player1">${p1Name.replace(/<[^>]*>/g, '')}</option>`;
      }
      if (!p2Name.includes("TBD")) {
        options += `<option value="player2">${p2Name.replace(/<[^>]*>/g, '')}</option>`;
      }

      html += `<div class="winner-select">
          <label>Match ${j + 1}: ${p1Name} vs ${p2Name}</label>
          <select id="${type}-${i}-${j}-winner">
            ${options}
          </select>
          <button class="update-btn" onclick="updateWinner('${type}', ${i}, ${j})">Set Winner</button>
        </div><hr>`;
    });
  });
  html += "</div>";
  return html;
}

// ✅ Update winner + auto-propagate to next round
async function updateWinner(type, roundIndex, matchIndex) {
  try {
    const winnerSelect = document.getElementById(`${type}-${roundIndex}-${matchIndex}-winner`);
    if (!winnerSelect) {
      alert("Winner selector missing.");
      return;
    }

    const winnerChoice = winnerSelect.value;
    if (!winnerChoice) {
      alert("Please select a winner.");
      return;
    }

    // Load fixture doc & rounds
    const fixtureDoc = doc(db, "fixtures", type);
    const fixtureSnap = await getDoc(fixtureDoc);
    if (!fixtureSnap.exists()) {
      alert("Fixtures not found.");
      return;
    }

    // Deep clone to avoid mutation issues
    const rounds = JSON.parse(JSON.stringify(fixtureSnap.data().rounds));

    // Determine winner object
    let winner = null;
    if (winnerChoice === "player1") {
      winner = rounds[roundIndex].matches[matchIndex].player1;
    } else if (winnerChoice === "player2") {
      winner = rounds[roundIndex].matches[matchIndex].player2;
    }

    if (!winner) {
      alert("Invalid winner selection.");
      return;
    }

    // Set winner
    rounds[roundIndex].matches[matchIndex].winner = winner;

    // ➡️ PROPAGATE WINNER TO NEXT ROUND (if exists)
    const nextRoundIndex = roundIndex + 1;
    if (nextRoundIndex < rounds.length) {
      // In knockout, winner of match N goes to match floor(N/2) in next round
      const nextMatchIndex = Math.floor(matchIndex / 2);

      // Which slot? Even matchIndex → player1, Odd → player2
      const slot = matchIndex % 2 === 0 ? "player1" : "player2";

      // Assign winner to next round match
      if (rounds[nextRoundIndex].matches[nextMatchIndex]) {
        rounds[nextRoundIndex].matches[nextMatchIndex][slot] = winner;
        console.log(`✅ Winner "${formatPlayerName(winner, type === 'doubles')}" propagated to Round ${nextRoundIndex + 1}, Match ${nextMatchIndex + 1}, slot: ${slot}`);
      }
    }

    // Save back updated rounds
    await updateDoc(fixtureDoc, { rounds });

    alert("Winner set and propagated to next round.");
    loadFixturesAdmin(); // Refresh admin view
    if (typeof loadFixtures === 'function') loadFixtures(); // Refresh public view
  } catch (error) {
    console.error("❌ Error updating winner:", error);
    alert("Failed to update winner: " + error.message);
  }
}

// Logout admin (simple redirect)
function logoutAdmin() {
  window.location.href = "index.html";
}

// Initializers for pages
window.addEventListener("load", () => {
  console.log("Page loaded — initializing components...");

  // Detect page and run relevant functions
  if (document.getElementById('registration-form')) {
    const form = document.getElementById('registration-form');
    if (form) {
      form.addEventListener('submit', submitRegistrationForm);
    }
  }

  if (document.getElementById('players-list')) {
    loadPlayers();
  }

  if (document.getElementById('singles-fixtures') || document.getElementById('doubles-fixtures')) {
    loadFixtures();
  }

  if (document.getElementById('edit-fixtures')) {
    loadFixturesAdmin();
  }

  // Login button handler
  const loginBtn = document.getElementById('admin-login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', loginAdmin);
  }
});

// ✅ ✅ ✅ FIXED: Expose ALL required functions to window
try {
  window.toggleRegistration = toggleRegistration;
  window.generateFixtures = generateFixtures;
  window.logoutAdmin = logoutAdmin;
  window.removePlayer = removePlayer;
  window.updateWinner = updateWinner;
  window.loadPlayers = loadPlayers;
  window.loadFixturesAdmin = loadFixturesAdmin;

  // ✅ CRITICAL for index.html
  window.getRegistrationStatus = getRegistrationStatus;
  window.loadFixtures = loadFixtures;
  window.submitRegistrationForm = submitRegistrationForm;

  console.log("✅ All functions exposed to window scope successfully.");
} catch (err) {
  console.error("❌ Failed to expose functions to window:", err);
}
