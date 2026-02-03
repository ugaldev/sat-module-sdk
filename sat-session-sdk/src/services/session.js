const axios = require("axios");
const validationUtils = require("../utils/validation");
const formatterUtils = require("../utils/formatter");

class SatSession {
    constructor(config = {}) {
        this.satLoginHost = config.loginHost || 'login.cloudb.sat.gob.mx';
        this.satInfoHost = config.infoHost || 'sm-sat-movilzuul-sm-servicios-moviles.cnh.cloudb.sat.gob.mx';
        this.clientId = "fe7bad7c-6dea-4834-8f40-1fa99620613b";

        this.commonHeaders = {
            "User-Agent": "Dart/3.5 (dart:io)",
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
        };
    }

    // --- HELPERS PRIVADOS DE REFACTORIZACIÓN ---

    /**
     * Helper central para peticiones a los servicios de sesión/info
     */
    async _request(method, host, endpoint, data = null, token = null, isUrlEncoded = false) {
        const url = `https://${host}${endpoint}`;
        const headers = {
            ...this.commonHeaders,
            Host: host,
            "Content-Type": isUrlEncoded ? "application/x-www-form-urlencoded" : "application/json"
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const config = { method, url, headers, timeout: 30000 };
        if (data) config.data = isUrlEncoded ? data.toString() : data;

        return axios(config);
    }

    /**
     * Construye los parámetros estándar de OAuth para el SAT
     */
    _getAuthParams(grantType, extraParams = {}) {
        const params = new URLSearchParams();
        params.append("grant_type", grantType);
        params.append("client_id", this.clientId);
        params.append("scope", "satmovil");
        params.append("resourceServer", "satmovil");

        for (const [key, value] of Object.entries(extraParams)) {
            params.append(key, value);
        }
        return params;
    }

    // --- MÉTODOS PÚBLICOS ---

    async login(rfc, password) {
        try {
            const validation = validationUtils.validateCredentials(rfc, password);
            if (!validation.isValid) return { success: false, message: validation.message };

            const params = this._getAuthParams("password", { username: rfc, password });
            const respuesta = await this._request('POST', this.satLoginHost, '/nidp/oauth/nam/token', params, null, true);

            if (!this._isValidSatResponse(respuesta.data)) {
                return { success: false, message: "Respuesta inválida del SAT" };
            }

            return {
                success: true,
                message: "Login exitoso",
                data: respuesta.data,
                userInfo: formatterUtils.parseSatToken(respuesta.data.access_token),
            };
        } catch (error) {
            console.error(`Error en login SAT para ${rfc}:`, error.message);
            return {
                success: false,
                message: error.response?.data?.error_description || "Error de conexión con el SAT"
            };
        }
    }

    _isValidSatResponse(satResponse) {
        return !!(satResponse?.access_token && satResponse?.token_type === "bearer");
    }

    async refreshToken(refreshToken) {
        try {
            const params = this._getAuthParams("refresh_token", { refresh_token: refreshToken });
            const respuesta = await this._request('POST', this.satLoginHost, '/nidp/oauth/nam/token', params, null, true);

            return {
                success: true,
                data: respuesta.data,
                userInfo: formatterUtils.parseSatToken(respuesta.data.access_token),
            };
        } catch (error) {
            console.error("Error en refresh token:", error.message);
            return { success: false, message: "No se pudo refrescar la sesión del SAT" };
        }
    }

    async getFiscalInfo(token, rfc) {
        try {
            const respuesta = await this._request('GET', this.satInfoHost, `/satmovil/v1/dwh/miinformacion/${rfc}`, null, token);

            if (respuesta.data?.status !== "OK") {
                return { success: false, message: respuesta.data?.message || "Error obteniendo información fiscal" };
            }

            const bodyResponse = respuesta.data?.bodyResponse;
            const processedData = {
                raw: respuesta.data,
                idTaxpayer: null,
                fiscalInfo: null,
                efirma: [],
                certificados: [],
                contactos: []
            };

            if (bodyResponse) {
                if (bodyResponse[3]?.[0]) {
                    const { idTaxpayer, ...fiscalData } = bodyResponse[3][0];
                    processedData.idTaxpayer = idTaxpayer;
                    processedData.fiscalInfo = fiscalData;
                }
                if (bodyResponse[1]) processedData.efirma = bodyResponse[1];
                if (bodyResponse[2]) processedData.certificados = bodyResponse[2];
                if (bodyResponse[0]) processedData.contactos = bodyResponse[0];
            }

            return { success: true, data: processedData };
        } catch (error) {
            console.error("Error obteniendo info SAT:", error.message);
            return { success: false, message: "Error al conectar con el servicio de información fiscal" };
        }
    }

    async getCsf(token, rfc) {
        try {
            const respuesta = await this._request('GET', this.satInfoHost, `/satmovil/v1/csf/${rfc}`, null, token);

            if (respuesta.data?.status !== "OK" || !respuesta.data?.bodyResponse?.constancia) {
                return { success: false, message: respuesta.data?.message || "Error obteniendo CSF" };
            }

            return {
                success: true,
                data: {
                    pdfBuffer: Buffer.from(respuesta.data.bodyResponse.constancia, "base64"),
                    fileName: `CSF_${rfc}.pdf`,
                }
            };
        } catch (error) {
            console.error(`Error obteniendo CSF para ${rfc}:`, error.message);
            return { success: false, message: "Error al descargar la CSF" };
        }
    }

    async getCum(token, rfc) {
        try {
            const respuesta = await this._request('GET', this.satInfoHost, `/satmovil/v1/opinionc/${rfc}`, null, token);

            if (respuesta.data?.status !== "OK" || !respuesta.data?.bodyResponse?.constancia) {
                return { success: false, message: respuesta.data?.message || "Error obteniendo CUM" };
            }

            return {
                success: true,
                data: {
                    pdfBuffer: Buffer.from(respuesta.data.bodyResponse.constancia, "base64"),
                    fileName: `CUM_${rfc}.pdf`,
                }
            };
        } catch (error) {
            console.error(`Error obteniendo CUM para ${rfc}:`, error.message);
            return { success: false, message: "Error al descargar la opinión de cumplimiento" };
        }
    }
}

module.exports = SatSession;
