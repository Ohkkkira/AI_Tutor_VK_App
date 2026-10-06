const BACKEND_URL = "https://ai-tutor-vk.vercel.app";

/*
 * ID сообщества бота (club240091971).
 * Нужен для VKWebAppSendPayload.
 */
const GROUP_ID = 240091971;

const DEFAULT_BUTTON_TEXT = "Accept Challenge";
const SUCCESS_BUTTON_TEXT = "Challenge sent! Check the chat ✓";

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

/*
 * Текущий челлендж. Раньше был const и выбирался один раз
 * при загрузке страницы, поэтому после восстановления
 * свёрнутого WebView показывался тот же самый.
 */
let randomChallenge = null;

/*
 * Флаг, чтобы не сбрасывать UI посреди отправки запроса.
 */
let isSending = false;


/*
 * Выбирает новый челлендж (по возможности не повторяя текущий)
 * и возвращает UI в исходное состояние.
 */
function renderChallenge() {

  if (isSending) return;

  let next;

  do {
    next = challenges[
      Math.floor(Math.random() * challenges.length)
    ];
  } while (
    challenges.length > 1 &&
    randomChallenge &&
    next.title === randomChallenge.title
  );

  randomChallenge = next;

  document.getElementById("challenge-title").innerText =
    randomChallenge.title;

  document.getElementById("challenge-text").innerText =
    randomChallenge.text;

  document.getElementById("challenge-image").src =
    randomChallenge.image;

  const button = document.getElementById("accept-btn");

  if (button) {
    button.disabled = false;
    button.innerText = DEFAULT_BUTTON_TEXT;
  }
}


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


/*
 * Основной способ отправки: через ВКонтакте.
 *
 * VKWebAppSendPayload передаёт данные боту сообщества,
 * а бот получает их событием app_payload через Callback API.
 * Запрос идёт с серверов ВК на Vercel, поэтому не зависит
 * от того, доступен ли vercel.app из сети пользователя.
 */
async function sendViaPayload(challenge) {

  if (!window.vkBridge) {
    throw new Error("VK Bridge is not available");
  }

  const result = await vkBridge.send(
    "VKWebAppSendPayload",
    {
      group_id: GROUP_ID,
      payload: {
        challenge: challenge.title,
        text: challenge.text
      }
    }
  );

  if (!result || result.result !== true) {
    throw new Error("VKWebAppSendPayload returned no result");
  }
}


/*
 * Запасной способ: прямой запрос к бэкенду.
 * Срабатывает, только если VKWebAppSendPayload недоступен
 * (например, приложение открыто не из чата с ботом).
 */
async function sendViaBackend(challenge, launchParams) {

  if (!launchParams) {
    throw new Error(
      "VK launch parameters were not found. Open the app from VK."
    );
  }

  const response = await fetch(
    `${BACKEND_URL}/webapp-data`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        initData: launchParams,
        challenge: challenge.title,
        text: challenge.text
      })
    }
  );

  let result = {};

  try {
    result = await response.json();
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
}


/*
 * Подписываемся на события, которые означают,
 * что пользователь вернулся в уже открытое приложение.
 *
 * Мобильный ВК после VKWebAppClose часто не уничтожает WebView,
 * а сворачивает его. При повторном открытии страница
 * восстанавливается из памяти вместе со всем состоянием JS,
 * поэтому кнопка оставалась в статусе "Challenge sent!".
 */
function subscribeToRestoreEvents() {

  if (window.vkBridge) {

    vkBridge.subscribe((event) => {

      const type =
        event &&
        event.detail &&
        event.detail.type;

      if (type === "VKWebAppViewRestore") {

        console.log(
          "Mini App restored, resetting UI"
        );

        renderChallenge();
      }

    });
  }


  /*
   * Страховка на случай восстановления страницы
   * из back/forward cache в WebView или браузере.
   */
  window.addEventListener(
    "pageshow",
    (event) => {
      if (event.persisted) {
        renderChallenge();
      }
    }
  );
}


async function initMiniApp() {

  /*
   * Первичная отрисовка челленджа.
   */

  renderChallenge();


  /*
   * Подписка ставится до VKWebAppInit,
   * чтобы не пропустить ранние события.
   */

  subscribeToRestoreEvents();


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

      if (isSending) return;

      isSending = true;
      button.disabled = true;


      try {

        console.log(
          "Sending challenge via VKWebAppSendPayload..."
        );


        try {

          await sendViaPayload(
            randomChallenge
          );

        } catch (payloadError) {

          console.warn(
            "VKWebAppSendPayload failed, falling back to backend:",
            payloadError
          );

          await sendViaBackend(
            randomChallenge,
            launchParams
          );

        }


        haptic("success");


        button.innerText =
          SUCCESS_BUTTON_TEXT;


        isSending = false;


        /*
         * Возвращаем UI в исходное состояние через паузу.
         * Даже если ВК восстановит свёрнутое приложение
         * без события VKWebAppViewRestore, пользователь
         * не увидит "залипшую" кнопку.
         */

        setTimeout(
          renderChallenge,
          1500
        );


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


        const isNetworkError =
          error instanceof TypeError;

        alert(
          isNetworkError
            ? "Не удалось связаться с сервером. Проверьте чат: если челлендж не пришёл, попробуйте ещё раз."
            : `Ошибка: ${
                error.message ||
                "Unknown error"
              }`
        );


        isSending = false;
        button.disabled = false;

      }

    }
  );
}


/*
 * Запускаем приложение.
 */

initMiniApp();
