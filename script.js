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

// ✅ ✅ ✅ UPDATED: Format bracket display with Quarter/Semi/Final + centered design
function formatBracketsHTML(rounds, isDoubles = false) {
  let html = '<div class="bracket">';

  rounds.forEach((roundObj, i) => {
    const totalRounds = rounds.length;
    const roundNumber = roundObj.round;
    let roundLabel = `Round ${roundNumber}`;

    // ✅ Smart labels based on total rounds and match count
    const matchCount = roundObj.matches.length;

    if (totalRounds === 1) {
      roundLabel = "Final";
    } else if (totalRounds === 2) {
      if (roundNumber === 1) roundLabel = "Semi Final";
      if (roundNumber === 2) roundLabel = "Final";
    } else if (totalRounds >= 3) {
      if (roundNumber === totalRounds) {
        roundLabel = "Final";
      } else if (roundNumber === totalRounds - 1) {
        roundLabel = "Semi Final";
      } else if (roundNumber === totalRounds - 2 && matchCount <= 4) {
        roundLabel = "Quarter Final";
      }
    }

    html += `<div class="round">
      <div class="round-header">${roundLabel}</div>
      <div class="matches">`;

    roundObj.matches.forEach(match => {
      const p1 = formatPlayerName(match.player1, isDoubles);
      const p2 = formatPlayerName(match.player2, isDoubles);
      let winner = match.winner ? formatPlayerName(match.winner, isDoubles) : "TBD";

      html += `
        <div class="match-item">
          <div class="match-line"></div>
          <div class="match-content">
            <div class="match-players">
              <div>${p1}</div>
              <div>vs</div>
              <div>${p2}</div>
            </div>
            <div class="match-winner">
              Winner: <strong>${winner}</strong>
            </div>
          </div>
          <div class="match-line"></div>
        </div>`;
    });

    html += `</div></div>`;
  });

  html += '</div>';
  return html;
}

// ✅ ✅ ✅ UPDATED: Show "TBD" instead of "BYE"
function formatPlayerName(playerObj, isDoubles) {
  if (!playerObj) return "TBD"; // ✅ Changed from "BYE" to "TBD"
  if (!isDoubles) return playerObj.name || "TBD";

  // Doubles playerObj expected as {player1: {}, player2: {}}
  if (playerObj.player1 && playerObj.player2) {
    const p1 = playerObj.player1.name || "TBD";
    const p2 = playerObj.player2.name || "TBD";
    return `${p1} & ${p2}`;
  }
  return playerObj.name || "TBD";
}

// ✅ Format fixture display WITHOUT "Edit" buttons
function formatFixtureEditingHTML(rounds, type) {
  let html = `<div id="${type}-edit-area">`;
  rounds.forEach((roundObj, i) => {
    html += `<h4>Round ${roundObj.round}</h4><ul>`;
    roundObj.matches.forEach((match, j) => {
      html += `<li>Match ${j + 1}: ${formatPlayerName(match.player1, type === "doubles")} vs ${formatPlayerName(match.player2, type === "doubles")}</li>`;
    });
    html += `</ul>`;
  });
  html += `</div>`;
  return html;
}

// Placeholder for editing match (to be implemented) — kept for compatibility
function editMatch(type, roundIndex, matchIndex) {
  alert(`Edit match ${matchIndex + 1} of round ${roundIndex + 1} in ${type} - feature to be implemented.`);
}

// ✅ Format score input — CLEAN: Player [input] vs Player [input] [Update]
function formatFixtureScoreInputHTML(rounds, type) {
  let html = `<div id="${type}-score-area">`;
  rounds.forEach((roundObj, i) => {
    html += `<h4>Round ${roundObj.round}</h4>`;
    roundObj.matches.forEach((match, j) => {
      const p1Name = formatPlayerName(match.player1, type === "doubles");
      const p2Name = formatPlayerName(match.player2, type === "doubles");

      html += `<div class="score-row">
          <span>${p1Name}</span>
          <input type="number" id="${type}-${i}-${j}-score1" min="0" value="${match.score1 ?? ''}" placeholder="0">
          <span class="vs">vs</span>
          <input type="number" id="${type}-${i}-${j}-score2" min="0" value="${match.score2 ?? ''}" placeholder="0">
          <button onclick="updateScore('${type}', ${i}, ${j})">Update</button>
        </div><hr>`;
    });
  });
  html += "</div>";
  return html;
}

// ✅ Update score + auto-propagate winner to next round
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

    // Deep clone to avoid mutation issues
    const rounds = JSON.parse(JSON.stringify(fixtureSnap.data().rounds));

    // Update scores
    rounds[roundIndex].matches[matchIndex].score1 = score1;
    rounds[roundIndex].matches[matchIndex].score2 = score2;

    // Determine winner
    let winner = null;
    if (score1 > score2) {
      winner = rounds[roundIndex].matches[matchIndex].player1;
    } else if (score2 > score1) {
      winner = rounds[roundIndex].matches[matchIndex].player2;
    } else {
      // Draw — no winner yet
      rounds[roundIndex].matches[matchIndex].winner = null;
      await updateDoc(fixtureDoc, { rounds });
      alert("Scores updated. No winner due to draw.");
      if (typeof loadFixturesAdmin === 'function') loadFixturesAdmin();
      if (typeof loadFixtures === 'function') loadFixtures();
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

    alert("Score updated and winner set. Winner propagated to next round.");
    if (typeof loadFixturesAdmin === 'function') loadFixturesAdmin();
    if (typeof loadFixtures === 'function') loadFixtures();
  } catch (error) {
    console.error("❌ Error updating score:", error);
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

// ✅ ✅ ✅ FIXED: Expose ALL required functions to window
try {
  window.toggleRegistration = toggleRegistration;
  window.generateFixtures = generateFixtures;
  window.logoutAdmin = logoutAdmin;
  window.removePlayer = removePlayer;
  window.updateScore = updateScore;
  window.editMatch = editMatch;

  // ✅ CRITICAL for index.html
  window.getRegistrationStatus = getRegistrationStatus;
  window.loadFixtures = loadFixtures;
  window.submitRegistrationForm = submitRegistrationForm;

  console.log("✅ All functions exposed to window scope successfully.");
} catch (err) {
  console.error("❌ Failed to expose functions to window:", err);
      }
