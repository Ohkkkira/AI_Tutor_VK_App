const tg = window.Telegram.WebApp;

tg.expand();

const BACKEND_URL = "https://aitutorbot.onrender.com";

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

document.getElementById("accept-btn")
.addEventListener("click", async () => {

  const btn = document.getElementById("accept-btn");
  btn.disabled = true;

  try {

    const response = await fetch(`${BACKEND_URL}/webapp-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData: tg.initData,
        challenge: randomChallenge.title,
        text: randomChallenge.text
      })
    });

    if (!response.ok) {
      throw new Error("Server responded " + response.status);
    }

    tg.HapticFeedback.notificationOccurred("success");
    tg.close();

  } catch (e) {

    console.error(e);
    tg.HapticFeedback.notificationOccurred("error");
    tg.showAlert("Something went wrong. Please try again.");
    btn.disabled = false;

  }

});