const CURP_REGEX = /^([A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3})([0-9A-Z])(\d)$/;
const CURP_ALFABETO = "0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";

export const validarTelefono = (tel) => /^\d{10}$/.test(String(tel || "").trim());

export const validarCurpMatematica = (curp) => {
  const curpLimpia = String(curp || "").trim().toUpperCase();
  if (!CURP_REGEX.test(curpLimpia)) return false;

  const base17 = curpLimpia.slice(0, 17);
  const digitoCapturado = Number(curpLimpia[17]);

  if (Number.isNaN(digitoCapturado)) return false;

  let suma = 0;
  for (let i = 0; i < base17.length; i += 1) {
    const valor = CURP_ALFABETO.indexOf(base17[i]);
    if (valor < 0) return false;
    suma += valor * (18 - (i + 1));
  }

  const digitoCalculado = (10 - (suma % 10)) % 10;
  return digitoCalculado === digitoCapturado;
};

export const validarEmail = (email) => {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(String(email).toLowerCase());
};

export const validarPassword = (password) => {
  const validations = {
    longitud: password.length >= 8,
    mayuscula: /[A-Z]/.test(password),
    minuscula: /[a-z]/.test(password),
    numero: /[0-9]/.test(password),
    especial: /[^A-Za-z0-9]/.test(password),
  };
  const esValida = Object.values(validations).every(Boolean);
  return { ...validations, esValida };
};

export const validaciones = {
  validarTelefono,
  validarCurpMatematica,
};