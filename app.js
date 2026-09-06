/**
 * SIGEA AUTH — app.js
 * -------------------------------------------------------------------------
 * Front-end da tela de login do sistema central de autenticação do SIGEA.
 *
 * IMPORTANTE: este arquivo NÃO implementa autenticação real ainda.
 * Ele está estruturado para receber a integração futura com o
 * Firebase Authentication (ver seção "INTEGRAÇÃO FUTURA" no final).
 *
 * Fluxo alvo:
 *   Firebase Authentication → login() → usuário autenticado → UID → módulo
 * -------------------------------------------------------------------------
 */

// ============================================================
// Elementos da tela de login
// ============================================================

const loginForm = document.getElementById("login-form");
const identifierInput = document.getElementById("login-identifier");
const identifierError = document.getElementById("identifier-error");
const passwordInput = document.getElementById("login-password");
const passwordError = document.getElementById("password-error");
const submitButton = document.getElementById("submit-button");
const formStatus = document.getElementById("form-status");

const togglePasswordButton = document.getElementById("toggle-password");
const iconEye = togglePasswordButton.querySelector(".icon-eye");
const iconEyeOff = togglePasswordButton.querySelector(".icon-eye-off");

// Elementos do modal "Esqueci minha senha"
const forgotPasswordLink = document.getElementById("forgot-password-link");
const forgotModal = document.getElementById("forgot-modal");
const forgotCloseButton = document.getElementById("forgot-close");
const forgotForm = document.getElementById("forgot-form");
const forgotIdentifierInput = document.getElementById("forgot-identifier");
const forgotIdentifierError = document.getElementById("forgot-identifier-error");
const forgotSubmitButton = document.getElementById("forgot-submit");
const forgotStatus = document.getElementById("forgot-status");

let lastFocusedBeforeModal = null;

// ============================================================
// Utilidades de UI
// ============================================================

/**
 * Exibe uma mensagem em um bloco de status (erro ou sucesso).
 * @param {HTMLElement} statusEl
 * @param {string} message
 * @param {"error"|"success"} type
 */
function showStatus(statusEl, message, type = "error") {
  statusEl.textContent = message;
  statusEl.hidden = false;
  statusEl.classList.toggle("is-success", type === "success");
}

function clearStatus(statusEl) {
  statusEl.hidden = true;
  statusEl.textContent = "";
  statusEl.classList.remove("is-success");
}

/**
 * Marca/desmarca um campo como inválido e mostra a mensagem de erro associada.
 */
function setFieldError(inputEl, errorEl, message) {
  if (message) {
    inputEl.setAttribute("aria-invalid", "true");
    errorEl.textContent = message;
    errorEl.hidden = false;
  } else {
    inputEl.removeAttribute("aria-invalid");
    errorEl.textContent = "";
    errorEl.hidden = true;
  }
}

/**
 * Alterna o botão para o estado de carregamento (desabilitado + spinner).
 */
function setButtonLoading(buttonEl, isLoading, loadingLabel = "Entrando...") {
  const labelEl = buttonEl.querySelector(".btn-label");
  const spinnerEl = buttonEl.querySelector(".btn-spinner");

  buttonEl.disabled = isLoading;
  spinnerEl.hidden = !isLoading;
  labelEl.textContent = isLoading ? loadingLabel : buttonEl.dataset.defaultLabel;
}

// Guarda o texto original de cada botão para restaurar após o carregamento.
submitButton.dataset.defaultLabel = "ENTRAR";
forgotSubmitButton.dataset.defaultLabel = "Enviar instruções";

// ============================================================
// Validação simples de CPF/e-mail
// ============================================================

/**
 * Verifica se o valor parece um e-mail ou um CPF (11 dígitos, com ou sem
 * pontuação). Validação apenas de formato — a validação real (dígitos
 * verificadores, existência da conta etc.) ficará a cargo do backend.
 * @param {string} value
 * @returns {boolean}
 */
function isValidIdentifier(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(trimmed)) return true;

  const digitsOnly = trimmed.replace(/\D/g, "");
  return digitsOnly.length === 11;
}

// ============================================================
// Mostrar / ocultar senha
// ============================================================

togglePasswordButton.addEventListener("click", () => {
  const isPasswordVisible = passwordInput.type === "text";

  passwordInput.type = isPasswordVisible ? "password" : "text";
  togglePasswordButton.setAttribute("aria-pressed", String(!isPasswordVisible));
  togglePasswordButton.setAttribute(
    "aria-label",
    isPasswordVisible ? "Mostrar senha" : "Ocultar senha"
  );

  iconEye.hidden = !isPasswordVisible;
  iconEyeOff.hidden = isPasswordVisible;
});

// ============================================================
// Envio do formulário de login
// ============================================================

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus(formStatus);

  const identifier = identifierInput.value;
  const password = passwordInput.value;

  let hasError = false;

  if (!isValidIdentifier(identifier)) {
    setFieldError(identifierInput, identifierError, "Informe um CPF ou e-mail válido.");
    hasError = true;
  } else {
    setFieldError(identifierInput, identifierError, "");
  }

  if (!password) {
    setFieldError(passwordInput, passwordError, "Informe sua senha.");
    hasError = true;
  } else {
    setFieldError(passwordInput, passwordError, "");
  }

  if (hasError) return;

  setButtonLoading(submitButton, true, "Entrando...");

  try {
    const user = await login(identifier, password);
    // Estrutura preparada para redirecionamento futuro ao módulo solicitado
    // assim que a autenticação real (Firebase) estiver integrada.
    console.log("Login realizado (placeholder):", user);
    showStatus(formStatus, "Login realizado com sucesso.", "success");
  } catch (error) {
    showStatus(formStatus, error.message || "Não foi possível entrar. Tente novamente.");
  } finally {
    setButtonLoading(submitButton, false);
  }
});

// ============================================================
// Modal "Esqueci minha senha"
// ============================================================

function openForgotModal() {
  lastFocusedBeforeModal = document.activeElement;

  clearStatus(forgotStatus);
  setFieldError(forgotIdentifierInput, forgotIdentifierError, "");
  forgotForm.reset();

  forgotModal.hidden = false;
  document.body.style.overflow = "hidden";
  forgotIdentifierInput.focus();

  document.addEventListener("keydown", handleModalKeydown);
}

function closeForgotModal() {
  forgotModal.hidden = true;
  document.body.style.overflow = "";

  document.removeEventListener("keydown", handleModalKeydown);

  if (lastFocusedBeforeModal instanceof HTMLElement) {
    lastFocusedBeforeModal.focus();
  }
}

function handleModalKeydown(event) {
  if (event.key === "Escape") {
    closeForgotModal();
    return;
  }

  // Mantém o foco preso dentro do modal (focus trap simples).
  if (event.key === "Tab") {
    const focusableEls = forgotModal.querySelectorAll(
      'button, input, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

forgotPasswordLink.addEventListener("click", openForgotModal);
forgotCloseButton.addEventListener("click", closeForgotModal);

forgotModal.addEventListener("click", (event) => {
  if (event.target === forgotModal) {
    closeForgotModal();
  }
});

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus(forgotStatus);

  const identifier = forgotIdentifierInput.value;

  if (!isValidIdentifier(identifier)) {
    setFieldError(
      forgotIdentifierInput,
      forgotIdentifierError,
      "Informe um CPF ou e-mail válido."
    );
    return;
  }
  setFieldError(forgotIdentifierInput, forgotIdentifierError, "");

  setButtonLoading(forgotSubmitButton, true, "Enviando...");

  try {
    await handleForgotPassword(identifier);
    showStatus(
      forgotStatus,
      "Se os dados estiverem corretos, você receberá as instruções em instantes.",
      "success"
    );
  } catch (error) {
    showStatus(forgotStatus, error.message || "Não foi possível enviar as instruções.");
  } finally {
    setButtonLoading(forgotSubmitButton, false);
  }
});

// ============================================================
// INTEGRAÇÃO FUTURA — Firebase Authentication
// ------------------------------------------------------------
// As funções abaixo são placeholders. Elas definem a interface que
// será usada pelo restante da aplicação (e pelos módulos SIDED+,
// SIPRO+, SICEP+) para autenticação, mas ainda não se conectam a
// nenhum backend real.
//
// Quando o Firebase for integrado, este arquivo (ou um módulo
// dedicado, ex.: js/firebase.js) deverá:
//
//   import { initializeApp } from "firebase/app";
//   import { getAuth, signInWithEmailAndPassword, ... } from "firebase/auth";
//
//   const firebaseConfig = { ... };
//   const app = initializeApp(firebaseConfig);
//   const auth = getAuth(app);
//
// O login aceitará CPF OU e-mail, mas o Firebase Auth continuará
// usando e-mail como credencial. Quando o identificador informado
// for um CPF, será necessário resolvê-lo para o e-mail associado
// (ex.: via endpoint /resolve-identifier) antes de chamar o Firebase.
// O UID retornado pelo Firebase será a identidade universal do
// usuário dentro do ecossistema SIGEA.
// ============================================================

/**
 * Autentica o usuário com CPF/e-mail + senha.
 *
 * Placeholder: hoje apenas simula uma resposta assíncrona e não
 * realiza nenhuma autenticação real. Deve ser substituída pela
 * chamada ao Firebase Authentication (signInWithEmailAndPassword,
 * possivelmente precedida da resolução de CPF → e-mail).
 *
 * @param {string} identifier - CPF ou e-mail informado pelo usuário.
 * @param {string} password - Senha informada pelo usuário.
 * @returns {Promise<{uid: string|null, identifier: string}>}
 */
async function login(identifier, password) {
  // TODO (Firebase): resolver CPF → e-mail quando necessário, depois
  // chamar signInWithEmailAndPassword(auth, email, password).
  throw new Error(
    "Autenticação ainda não configurada. Integração com Firebase pendente."
  );
}

/**
 * Encerra a sessão do usuário atual.
 *
 * Placeholder: deve futuramente chamar signOut(auth) do Firebase
 * e limpar qualquer estado local relacionado ao usuário autenticado.
 *
 * @returns {Promise<void>}
 */
async function logout() {
  // TODO (Firebase): await signOut(auth);
  throw new Error("logout() ainda não implementado — aguardando integração com Firebase.");
}

/**
 * Retorna o usuário atualmente autenticado, se houver.
 *
 * Placeholder: deve futuramente ler o estado de autenticação do
 * Firebase (ex.: via onAuthStateChanged ou auth.currentUser) e
 * retornar os dados relevantes (UID, e-mail, etc.).
 *
 * @returns {{uid: string, email: string}|null}
 */
function getCurrentUser() {
  // TODO (Firebase): return auth.currentUser (mapeado para o formato usado no app).
  return null;
}

/**
 * Dispara o fluxo de recuperação de senha para o CPF/e-mail informado.
 *
 * Placeholder: deve futuramente resolver CPF → e-mail (se necessário)
 * e chamar sendPasswordResetEmail(auth, email) do Firebase.
 *
 * @param {string} identifier - CPF ou e-mail informado pelo usuário.
 * @returns {Promise<void>}
 */
async function handleForgotPassword(identifier) {
  // TODO (Firebase): await sendPasswordResetEmail(auth, email);
  throw new Error(
    "Recuperação de senha ainda não configurada. Integração com Firebase pendente."
  );
}
