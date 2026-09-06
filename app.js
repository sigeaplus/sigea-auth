/**
 * SIGEA AUTH — app.js
 * -------------------------------------------------------------------------
 * Front-end da tela de login do sistema central de autenticação do SIGEA.
 *
 * Autenticação real via Firebase Authentication (e-mail/senha), importado
 * como ES Module diretamente do CDN oficial do Firebase (gstatic) — sem
 * bundler, sem build, sem npm.
 *
 * Fluxo:
 *   identificador (CPF ou e-mail) + senha
 *     → se for e-mail: usado diretamente
 *     → se for CPF: resolvido para o e-mail associado (ver resolveIdentifierToEmail)
 *   → signInWithEmailAndPassword(auth, email, senha)
 *   → usuário autenticado → user.uid (identidade universal no ecossistema SIGEA)
 *
 * O SIGEA Auth responde apenas "quem é o usuário" (UID). Permissões de
 * SIDED+, SIPRO+, SICEP+ e demais módulos NÃO são tratadas aqui.
 * -------------------------------------------------------------------------
 */

// ============================================================
// Firebase — inicialização (Web SDK modular via CDN)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

// Configuração Web do Firebase. Estes valores identificam o projeto no
// front-end (não são segredos administrativos) e podem permanecer no
// código do lado do cliente.
const firebaseConfig = {
  apiKey: "AIzaSyCGng9ZcN4WMSVJEmxz-d0o9171svIZc0s",
  authDomain: "sigea-auth-0.firebaseapp.com",
  projectId: "sigea-auth-0",
  storageBucket: "sigea-auth-0.firebasestorage.app",
  messagingSenderId: "400906218593",
  appId: "1:400906218593:web:22f9175235347e9e430e20",
  measurementId: "G-ZVSKPD01N1",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

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

/**
 * Converte um erro (do Firebase Auth ou de validação interna) em uma
 * mensagem amigável para exibir ao usuário, sem expor códigos técnicos.
 * @param {unknown} error
 * @returns {string}
 */
function getFriendlyAuthErrorMessage(error) {
  const code = error && typeof error === "object" ? error.code : null;

  switch (code) {
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/user-disabled":
      return "Esta conta está desativada. Procure a administração do SIGEA.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "CPF/e-mail ou senha incorretos.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    case "auth/network-request-failed":
      return "Falha de conexão. Verifique sua internet e tente novamente.";
    default:
      return (error && error.message) || "Não foi possível concluir a operação. Tente novamente.";
  }
}

// ============================================================
// Validação simples de CPF/e-mail
// ============================================================

/**
 * Verifica se o valor tem formato de e-mail.
 * @param {string} value
 * @returns {boolean}
 */
function isEmail(value) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(value);
}

/**
 * Verifica se o valor parece um e-mail ou um CPF (11 dígitos, com ou sem
 * pontuação). Validação apenas de formato — a validação real (dígitos
 * verificadores, existência da conta etc.) ficará a cargo do backend/Firebase.
 * @param {string} value
 * @returns {boolean}
 */
function isValidIdentifier(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (isEmail(trimmed)) return true;

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
    // Estrutura preparada para redirecionamento futuro ao módulo solicitado,
    // usando user.uid como identidade universal do usuário no ecossistema.
    console.log("Login realizado. UID:", user.uid);
    showStatus(formStatus, "Login realizado com sucesso.", "success");
  } catch (error) {
    showStatus(formStatus, getFriendlyAuthErrorMessage(error));
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
    showStatus(forgotStatus, getFriendlyAuthErrorMessage(error));
  } finally {
    setButtonLoading(forgotSubmitButton, false);
  }
});

// ============================================================
// Firebase Authentication — integração real
// ------------------------------------------------------------
// O Firebase Auth usa e-mail + senha como credencial. O usuário do
// SIGEA pode informar CPF OU e-mail; quando for CPF, o identificador
// precisa ser resolvido para o e-mail associado antes de chamar o
// Firebase. Essa resolução depende de uma estrutura de dados (ex.:
// Firestore) que ainda não existe neste projeto — por isso a função
// resolveIdentifierToEmail() abaixo está deixada claramente preparada
// para implementação posterior, sem dados fictícios.
//
// O UID retornado pelo Firebase (user.uid) é a identidade universal
// do usuário dentro do ecossistema SIGEA. Este arquivo não trata
// permissões dos módulos (SIDED+, SIPRO+, SICEP+) — apenas "quem é
// o usuário".
// ============================================================

/**
 * Resolve um identificador informado como e-mail.
 *
 * Se `identifier` já for um e-mail, é retornado como está. Se for um
 * CPF, esta função deveria consultar a estrutura que associa CPF → e-mail
 * (por exemplo, uma coleção no Firestore) e retornar o e-mail vinculado
 * a essa conta.
 *
 * PENDENTE: a estrutura de CPF ainda não existe no projeto (Firestore
 * não foi modelado para isso nesta etapa). Por isso, para CPF, esta
 * função apenas lança um erro claro em vez de simular/inventar dados.
 *
 * @param {string} identifier - CPF ou e-mail informado pelo usuário.
 * @returns {Promise<string>} O e-mail a ser usado no Firebase Authentication.
 */
async function resolveIdentifierToEmail(identifier) {
  const trimmed = identifier.trim();

  if (isEmail(trimmed)) {
    return trimmed;
  }

  // TODO (futuro): buscar no Firestore (ou endpoint equivalente) o
  // e-mail associado a este CPF, ex.:
  //   const snapshot = await getDoc(doc(db, "usuarios_cpf", digitsOnly(trimmed)));
  //   if (!snapshot.exists()) throw new Error("CPF não encontrado.");
  //   return snapshot.data().email;
  throw new Error(
    "Login por CPF ainda não está disponível. Utilize seu e-mail por enquanto."
  );
}

/**
 * Autentica o usuário com CPF/e-mail + senha via Firebase Authentication.
 *
 * @param {string} identifier - CPF ou e-mail informado pelo usuário.
 * @param {string} password - Senha informada pelo usuário.
 * @returns {Promise<{uid: string, email: string|null}>}
 */
async function login(identifier, password) {
  const email = await resolveIdentifierToEmail(identifier);

  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // user.uid é a identidade universal do usuário dentro do ecossistema
  // SIGEA. Cada módulo (SIDED+, SIPRO+, SICEP+) consultará suas próprias
  // permissões para esse UID — nada disso é resolvido aqui.
  return { uid: user.uid, email: user.email };
}

/**
 * Encerra a sessão do usuário atual.
 * @returns {Promise<void>}
 */
async function logout() {
  await signOut(auth);
}

/**
 * Retorna o usuário atualmente autenticado, se houver.
 *
 * Baseado em `auth.currentUser`, que reflete o estado já resolvido pelo
 * Firebase no momento da chamada (ver onAuthStateChanged abaixo para
 * reagir a mudanças de estado de forma assíncrona/reativa).
 *
 * @returns {{uid: string, email: string|null}|null}
 */
function getCurrentUser() {
  const user = auth.currentUser;
  if (!user) return null;
  return { uid: user.uid, email: user.email };
}

/**
 * Dispara o fluxo de recuperação de senha para o CPF/e-mail informado.
 *
 * Se for e-mail, o link de redefinição é enviado diretamente pelo
 * Firebase. Se for CPF, depende da mesma resolução CPF → e-mail
 * descrita em resolveIdentifierToEmail() (ainda pendente).
 *
 * @param {string} identifier - CPF ou e-mail informado pelo usuário.
 * @returns {Promise<void>}
 */
async function handleForgotPassword(identifier) {
  const email = await resolveIdentifierToEmail(identifier);
  await sendPasswordResetEmail(auth, email);
}

// ============================================================
// Estado de sessão — onAuthStateChanged
// ------------------------------------------------------------
// Observa mudanças no estado de autenticação (login, logout, sessão
// restaurada ao recarregar a página). Por enquanto apenas registra o
// estado; o redirecionamento para o módulo solicitado será plugado
// aqui futuramente.
// ============================================================

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Sessão SIGEA ativa. UID:", user.uid);
  } else {
    console.log("Nenhuma sessão SIGEA ativa.");
  }
});
