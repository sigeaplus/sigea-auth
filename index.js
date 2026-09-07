/**
 * SIGEA AUTH — Cloud Functions
 * -------------------------------------------------------------------------
 * Função callable que resolve CPF → e-mail para permitir login por CPF
 * no SIGEA Auth, sem expor a coleção `users` publicamente no Firestore.
 *
 * Por que isso precisa ser uma Cloud Function e não uma consulta direta
 * do navegador:
 *   - No momento do login, o usuário AINDA NÃO está autenticado.
 *   - Para o front-end consultar `users` por CPF diretamente, a regra do
 *     Firestore precisaria permitir leitura antes do login — o que
 *     exporia nome, e-mail e status de todos os usuários publicamente.
 *   - A Cloud Function roda com o Admin SDK (privilégios de servidor),
 *     nunca exposto ao cliente, e devolve apenas o e-mail — nada de
 *     nome, uid ou status.
 *
 * Deploy (a partir da raiz deste diretório functions/):
 *   firebase deploy --only functions:resolveCpfToEmail
 * -------------------------------------------------------------------------
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

/**
 * Remove tudo que não for dígito de uma string.
 * @param {string} value
 * @returns {string}
 */
function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * resolveCpfToEmail
 * -----------------------------------------------------------------------
 * Entrada:  { cpf: string }  — CPF com ou sem pontuação.
 * Saída:    { email: string }
 *
 * Erros (todos com mensagem genérica, para não revelar se o CPF existe
 * ou não, nem o motivo exato da falha):
 *   - "invalid-argument": CPF ausente ou com formato inválido.
 *   - "not-found": CPF não encontrado OU usuário inativo (mesma mensagem
 *     para as duas situações, de propósito).
 */
exports.resolveCpfToEmail = onCall(
  {
    region: "southamerica-east1",
    // Limite simples de execuções concorrentes/abuso; ajustar conforme
    // volume real de uso do SIGEA.
    maxInstances: 10,
  },
  async (request) => {
    const cpfDigits = onlyDigits(request.data && request.data.cpf);

    if (cpfDigits.length !== 11) {
      throw new HttpsError("invalid-argument", "CPF inválido.");
    }

    const usersRef = db.collection("users");
    const querySnapshot = await usersRef
      .where("cpf", "==", cpfDigits)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      // Mensagem genérica — não revela se o CPF existe ou não.
      throw new HttpsError("not-found", "CPF ou senha incorretos.");
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    if (userData.status !== "ativo") {
      // Mesma mensagem genérica do caso "não encontrado", de propósito:
      // não revelamos que o CPF existe mas está desativado.
      throw new HttpsError("not-found", "CPF ou senha incorretos.");
    }

    if (!userData.email) {
      throw new HttpsError("not-found", "CPF ou senha incorretos.");
    }

    return { email: userData.email };
  }
);
