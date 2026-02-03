class AuthUtils {
    isTokenExpiringSoon(expiresAt, thresholdSeconds = 60) {
        if (!expiresAt) return true;
        const expiryDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
        const timeLeft = expiryDate.getTime() - Date.now();
        return timeLeft < (thresholdSeconds * 1000);
    }

    calculateExpiryDate(expiresIn) {
        return new Date(Date.now() + (expiresIn * 1000)).toISOString();
    }
}

module.exports = new AuthUtils();
