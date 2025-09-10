console.log("Loaded updated script.js");

// Firebase setup and imports — REMOVED TRAILING SPACES
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

// Generate fixtures - knockout bracket for singles and doubles
async function generateFixtures() {
  const btn = document.querySelector('button[onclick="generateFixtures()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Generating...";
  }

  try {
    // Only generate if registration is closed
    let open = await getRegistrationStatus();
    if (open) {
      alert("Close registration before generating fixtures.");
      return;
    }

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
    alert("Fixtures generated successfully.");

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
      player1: { player1: p1, player2: p2 },
      player2: null,
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
      player1: { player1: null, player2: null },
      player2: null,
      winner: null,
      score1: 0,
      score2: 0
    });
  }

  // First round matches
  let roundMatches = [];
  for (let i = 0; i < pairs.length; i += 2) {
    roundMatches.push({
      player1: pairs[i].player1,
      player2: pairs[i + 1]?.player1 || null,
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

// Admin fixture editor view loading
async function loadFixturesAdmin() {
  const editDiv = document.getElementById('edit-fixtures');
  const scoresDiv = document.getElementById('enter-scores');
  if (!editDiv || !scoresDiv) return;

  editDiv.innerHTML = "Loading fixtures...";
  scoresDiv.innerHTML = "Loading fixtures...";

  try {
    const singlesSnap = await getDoc(doc(db, "fixtures", "singles"));
    const doublesSnap = await getDoc(doc(db, "fixtures", "doubles"));

    if (!(singlesSnap.exists() && doublesSnap.exists())) {
      editDiv.innerHTML = "<p>No fixtures found. Generate fixtures first.</p>";
      scoresDiv.innerHTML = "";
      return;
    }

    const singlesBrackets = singlesSnap.data().rounds;
    const doublesBrackets = doublesSnap.data().rounds;

    editDiv.innerHTML = '<h3>Singles Fixtures</h3>' + formatFixtureEditingHTML(singlesBrackets, "singles");
    editDiv.innerHTML += '<h3>Doubles Fixtures</h3>' + formatFixtureEditingHTML(doublesBrackets, "doubles");

    scoresDiv.innerHTML = '<h3>Update Scores & Winners</h3>' +
      formatFixtureScoreInputHTML(singlesBrackets, "singles") +
      formatFixtureScoreInputHTML(doublesBrackets, "doubles");

  } catch (error) {
    editDiv.innerHTML = "Error loading fixtures: " + error.message;
    scoresDiv.innerHTML = "Error loading fixtures: " + error.message;
  }
}

// Format bracket display HTML (read-only)
function formatBracketsHTML(rounds, isDoubles = false) {
  let html = '<div class="bracket">';

  rounds.forEach((roundObj, i) => {
    html += `<div class="round"><strong>Round ${roundObj.round}</strong><ul>`;
    roundObj.matches.forEach(match => {
      const p1 = formatPlayerName(match.player1, isDoubles);
      const p2 = formatPlayerName(match.player2, isDoubles);
      let winner = match.winner ? formatPlayerName(match.winner, isDoubles) : "TBD";
      html += `<li>${p1} vs ${p2} - <em>Winner: ${winner}</em></li>`;
    });
    html += '</ul></div>';
  });

  html += '</div>';
  return html;
}

// Format player or pair names for display
function formatPlayerName(playerObj, isDoubles) {
  if (!playerObj) return "BYE";
  if (!isDoubles) return playerObj.name || "Unknown";

  // Doubles playerObj expected as {player1: {}, player2: {}}
  if (playerObj.player1 && playerObj.player2) {
    return `${playerObj.player1.name || "Unknown"} & ${playerObj.player2.name || "Unknown"}`;
  }
  return playerObj.name || "Unknown";
}

// Format editable fixture HTML for admin (basic)
function formatFixtureEditingHTML(rounds, type) {
  let html = `<div id="${type}-edit-area">`;
  rounds.forEach((roundObj, i) => {
    html += `<h4>Round ${roundObj.round}</h4>`;
    roundObj.matches.forEach((match, j) => {
      html += `<div>
        <span>Match ${j + 1}: ${formatPlayerName(match.player1, type === "doubles")} vs ${formatPlayerName(match.player2, type === "doubles")}</span>
        <button onclick="editMatch('${type}', ${i}, ${j})">Edit</button>
      </div>`;
    });
  });
  html += `</div>`;
  return html;
}

// Placeholder for editing match (to be implemented)
function editMatch(type, roundIndex, matchIndex) {
  alert(`Edit match ${matchIndex + 1} of round ${roundIndex + 1} in ${type} - feature to be implemented.`);
}

// Format score input for admin
function formatFixtureScoreInputHTML(rounds, type) {
  let html = `<div id="${type}-score-area">`;
  rounds.forEach((roundObj, i) => {
    html += `<h4>Round ${roundObj.round}</h4>`;
    roundObj.matches.forEach((match, j) => {
      const p1Name = formatPlayerName(match.player1, type === "doubles");
      const p2Name = formatPlayerName(match.player2, type === "doubles");
      html += `<div>
          <span>Match ${j + 1}: ${p1Name} vs ${p2Name}</span><br>
          <label>Score ${p1Name}: <input type="number" id="${type}-${i}-${j}-score1" min="0" value="${match.score1 ?? ''}"></label>
          <label>Score ${p2Name}: <input type="number" id="${type}-${i}-${j}-score2" min="0" value="${match.score2 ?? ''}"></label>
          <button onclick="updateScore('${type}', ${i}, ${j})">Update Score</button>
        </div><hr>`;
    });
  });
  html += "</div>";
  return html;
}

// Update score and decide winner for a match
async function updateScore(type, roundIndex, matchIndex) {
  try {
    const score1Input = document.getElementById(`${type}-${roundIndex}-${matchIndex}-score1`);
    const score2Input = document.getElementById(`${type}-${roundIndex}-${matchIndex}-score2`);
    if (!score1Input || !score2Input) {
      alert("Score inputs missing.");
      return;
    }
    const score1 = parseInt(score1Input.value);
    const score2 = parseInt(score2Input.value);
    if (isNaN(score1) || isNaN(score2)) {
      alert("Enter valid numeric scores.");
      return;
    }

    // Load fixture doc & rounds
    const fixtureDoc = doc(db, "fixtures", type);
    const fixtureSnap = await getDoc(fixtureDoc);
    if (!fixtureSnap.exists()) {
      alert("Fixtures not found.");
      return;
    }

    const rounds = [...fixtureSnap.data().rounds]; // shallow clone

    // Update scores
    rounds[roundIndex].matches[matchIndex].score1 = score1;
    rounds[roundIndex].matches[matchIndex].score2 = score2;

    // Determine winner player object
    if (score1 > score2) {
      rounds[roundIndex].matches[matchIndex].winner = rounds[roundIndex].matches[matchIndex].player1;
    } else if (score2 > score1) {
      rounds[roundIndex].matches[matchIndex].winner = rounds[roundIndex].matches[matchIndex].player2;
    } else {
      rounds[roundIndex].matches[matchIndex].winner = null; // draw or undecided
    }

    // Save back updated rounds
    await updateDoc(fixtureDoc, { rounds });

    alert("Score updated and winner set.");
    if (typeof loadFixturesAdmin === 'function') loadFixturesAdmin();
    if (typeof loadFixtures === 'function') loadFixtures();
  } catch (error) {
    alert("Failed to update score: " + error.message);
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

  if (document.getElementById('edit-fixtures') || document.getElementById('enter-scores')) {
    loadFixturesAdmin();
  }

  // Login button handler
  const loginBtn = document.getElementById('admin-login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', loginAdmin);
  }
});

// Expose functions to global scope for HTML onclick handlers
try {
  window.toggleRegistration = toggleRegistration;
  window.generateFixtures = generateFixtures;
  window.logoutAdmin = logoutAdmin;
  window.removePlayer = removePlayer;
  window.updateScore = updateScore;
  window.editMatch = editMatch;
  console.log("✅ Functions exposed to window scope successfully.");
} catch (err) {
  console.error("❌ Failed to expose functions to window:", err);
      }
