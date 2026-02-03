class FormatterUtils {
    parseSatToken(accessToken) {
        try {
            if (!accessToken || typeof accessToken !== "string") return null;

            const parts = accessToken.split(".");
            if (parts.length !== 3) return null;

            let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const padLength = 4 - (base64.length % 4);
            if (padLength < 4) base64 += "=".repeat(padLength);

            const jsonString = Buffer.from(base64, "base64").toString("utf-8");
            const tokenData = JSON.parse(jsonString);

            return {
                rfc: tokenData.rfc || null,
                nombreCompleto: tokenData.fullname || tokenData.nombreCompleto || null,
                email: tokenData.email || null,
                tipoContribuyente: tokenData.tipoContribuyente || null,
                cn: tokenData.cn || null,
                exp: tokenData.exp ? new Date(tokenData.exp * 1000) : null,
            };
        } catch (error) {
            console.error("Error decodificando token SAT:", error.message);
            return null;
        }
    }

    formatSatLoginResponse(rawData) {
        return {
            accessToken: rawData.access_token,
            expiresIn: rawData.expires_in,
            tokenType: rawData.token_type,
            expiresAt: new Date(Date.now() + (rawData.expires_in * 1000)).toISOString()
        };
    }
}

module.exports = new FormatterUtils();
