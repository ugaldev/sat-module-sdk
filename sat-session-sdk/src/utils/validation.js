class ValidationUtils {
    isValidRfc(rfc) {
        if (!rfc) return false;
        const rfcPattern = /^([A-ZÑ&]{3,4})(\d{6})([A-Z0-9]{3})$/;
        return rfcPattern.test(rfc.toUpperCase().trim());
    }

    validateCredentials(rfc, password) {
        if (!rfc) return { isValid: false, message: "El RFC es requerido" };

        const normalizedRfc = rfc.toUpperCase().trim();
        if (!this.isValidRfc(normalizedRfc)) {
            return { isValid: false, message: "RFC con formato inválido" };
        }

        if (!password || password.length < 4) {
            return { isValid: false, message: "La contraseña es requerida (mín. 4 caracteres)" };
        }

        return { isValid: true, message: "Formato válido" };
    }
}

module.exports = new ValidationUtils();
