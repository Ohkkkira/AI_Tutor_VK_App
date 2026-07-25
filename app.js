const BACKEND_URL = "https://ai-tutor-vk.vercel.app";

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


function haptic(type) {
  if (!window.vkBridge) return;

  vkBridge
    .send("VKWebAppTapticNotificationOccurred", { type })
    .catch(() => {});
}


/*
 * Получаем подписанные launch parameters VK.
 *
 * Важно:
 * Не используем только window.location.search,
 * потому что VK Mini App передаёт launch params через Bridge.
 */
async function getLaunchParams() {

  if (window.vkBridge) {
    try {

      const result = await vkBridge.send(
        "VKWebAppGetLaunchParams"
      );

      console.log(
        "VK launch params result:",
        result
      );

      if (
        result &&
        result.vk_user_id &&
        result.sign
      ) {

        const params = new URLSearchParams();

        Object.entries(result).forEach(
          ([key, value]) => {

            if (
              value !== undefined &&
              value !== null
            ) {
              params.set(
                key,
                String(value)
              );
            }

          }
        );

        return params.toString();
      }

      console.warn(
        "VKWebAppGetLaunchParams returned incomplete data"
      );

    } catch (error) {

      console.error(
        "VKWebAppGetLaunchParams failed:",
        error
      );

    }
  }


  /*
   * Fallback для обычного браузера.
   */

  const search =
    window.location.search.slice(1);

  if (search) {
    return search;
  }


  const hash =
    window.location.hash.replace(/^#/, "");

  if (
    hash &&
    hash.includes("vk_user_id")
  ) {
    return hash;
  }


  return "";
}


async function initMiniApp() {

  /*
   * Инициализируем VK Bridge.
   */

  if (window.vkBridge) {

    try {

      await vkBridge.send(
        "VKWebAppInit"
      );

      console.log(
        "VK Bridge initialized"
      );

    } catch (error) {

      console.error(
        "VKWebAppInit failed:",
        error
      );

    }
  }


  /*
   * Получаем launch params.
   */

  const launchParams =
    await getLaunchParams();

  console.log(
    "VK launch params found:",
    Boolean(launchParams)
  );


  const button =
    document.getElementById(
      "accept-btn"
    );


  if (!button) {

    console.error(
      "Element #accept-btn was not found"
    );

    return;
  }


  button.addEventListener(
    "click",
    async () => {

      button.disabled = true;


      try {

        if (!launchParams) {

          throw new Error(
            "VK launch parameters were not found. Open the app from VK."
          );

        }


        console.log(
          "Sending challenge to backend..."
        );


        const response =
          await fetch(
            `${BACKEND_URL}/webapp-data`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({

                initData:
                  launchParams,

                challenge:
                  randomChallenge.title,

                text:
                  randomChallenge.text

              })
            }
          );


        let result = {};


        try {

          result =
            await response.json();

        } catch (_) {

          result = {};

        }


        console.log(
          "Backend response:",
          response.status,
          result
        );


        if (!response.ok) {

          throw new Error(
            result.error ||
            `Backend returned HTTP ${response.status}`
          );

        }


        haptic("success");


        button.innerText =
          "Challenge sent! Check the chat ✓";


        /*
         * Закрываем Mini App после успешной отправки.
         */

        if (window.vkBridge) {

          vkBridge
            .send(
              "VKWebAppClose",
              {
                status: "success"
              }
            )
            .catch(() => {});

        }


      } catch (error) {

        console.error(
          "Challenge request failed:",
          error
        );


        haptic("error");


        alert(
          `Ошибка: ${
            error.message ||
            "Unknown error"
          }`
        );


        button.disabled = false;

      }

    }
  );
}


/*
 * Запускаем приложение.
 */

initMiniApp();