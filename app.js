// VK Bridge is loaded in index.html and exposed as the global `vkBridge`
vkBridge.send("VKWebAppInit");

const BACKEND_URL = "https://ai-tutor-vk.vercel.app";

// VK opens the mini app with launch params in the URL query string:
// ?vk_user_id=...&vk_app_id=...&sign=...
// The backend validates this exact string, so we pass it as-is.
const launchParams = window.location.search.slice(1);

const challenges = [

  {
    title: "Convince Me",
    text: "Try to persuade me to visit your country. Tell me why I would love it there.",
    image: "images/travel.jpg"
  },

  {
    title: "Movie Night",
    text: "Describe your favorite movie without saying its title. I'll try to guess it.",
    image: "images/movie.jpg"
  },

  {
    title: "Small Talk Test",
    text: "Imagine we just met at a conference. Start a natural conversation with me.",
    image: "images/conference.jpg"
  },

  {
    title: "Dream Life",
    text: "Tell me what your perfect day looks like from morning to night.",
    image: "images/dream.jpg"
  },

  {
    title: "Explain the Meme",
    text: "Explain a meme from your country as if I've never seen it before.",
    image: "images/meme.jpg"
  }

];

const randomChallenge =
  challenges[Math.floor(Math.random() * challenges.length)];

document.getElementById("challenge-title").innerText =
  randomChallenge.title;

document.getElementById("challenge-text").innerText =
  randomChallenge.text;

document.getElementById("challenge-image").src =
  randomChallenge.image;

// Haptic feedback works only in VK mobile clients,
// so failures (e.g. on desktop) are silently ignored
function haptic(type) {
  vkBridge
    .send("VKWebAppTapticNotificationOccurred", { type })
    .catch(() => {});
}

document.getElementById("accept-btn")
.addEventListener("click", async () => {

  const btn = document.getElementById("accept-btn");
  btn.disabled = true;

  try {

    const response = await fetch(`${BACKEND_URL}/webapp-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData: launchParams,
        challenge: randomChallenge.title,
        text: randomChallenge.text
      })
    });

    if (!response.ok) {
      throw new Error("Server responded " + response.status);
    }

    haptic("success");

    btn.innerText = "Challenge sent! Check the chat ✓";

    // Close the mini app (supported in VK mobile clients;
    // on desktop the user just sees the confirmation above)
    vkBridge.send("VKWebAppClose", { status: "success" })
      .catch(() => {});

  } catch (e) {

    console.error(e);
    haptic("error");
    alert("Something went wrong. Please try again.");
    btn.disabled = false;

  }

});