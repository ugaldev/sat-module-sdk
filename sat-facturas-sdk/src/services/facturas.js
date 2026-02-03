const axios = require("axios");
const validationUtils = require("../utils/validation");
const formatterUtils = require("../utils/formatter");
const dateUtils = require("../utils/dates");

class SatFactura {
    constructor(config = {}) {
        this.satFacHost = config.facHost || 'zuul-fac-movil.cnh.cloudb.sat.gob.mx';
        this.cfdiService = config.cfdiService;
        this.commonHeaders = {
            "User-Agent": "Dart/3.4 (dart:io)",
            "Content-Type": "application/json; charset=UTF-8",
            "Accept-Encoding": "gzip",
            Host: this.satFacHost,
        };
    }

    // --- MÉTODOS PRIVADOS DE REFACTORIZACIÓN (HELPERS) ---

    /**
     * Helper central para peticiones POST al SAT
     */
    async _post(endpoint, data, token = null) {
        const url = endpoint.startsWith('http') ? endpoint : `https://${this.satFacHost}${endpoint}`;
        const headers = { ...this.commonHeaders };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        return axios.post(url, data, { headers });
    }

    /**
     * Asegura que el comprobante esté envuelto en la propiedad 'comprobante'
     */
    _ensureWrap(data) {
        if (!data) return null;
        return data.comprobante ? data : { comprobante: data };
    }

    // --- MÉTODOS PÚBLICOS ---

    validarLocal(comprobante) {
        return validationUtils.validarCFDI(comprobante);
    }

    async login(rfc, password) {
        try {
            if (!rfc || !password) return { success: false, message: "RFC y password son requeridos" };
            if (!validationUtils.isValidRfc(rfc)) return { success: false, message: "RFC con formato inválido" };

            const respuesta = await this._post('/api/zuul/auth/nam/token', { username: rfc, password });
            return { success: true, data: respuesta.data };
        } catch (error) {
            console.error("Error al autenticar:", error.message);
            return { success: false, message: "Error al autenticar en el servicio de facturas", error: error.response?.data || error.message };
        }
    }

    async facturasDetalladas(token, options) {
        try {
            const res = await this.getFacturasCompletas(token, options);
            if (!res.success) return res;

            // Refactorizado: Procesamiento secuencial para evitar bloqueos del SAT por ráfagas
            const facturasProcesadas = [];
            for (const fac of res.facturas) {
                try {
                    if (!fac.blobpath) continue;
                    const xmlRes = await this.getXml(token, {
                        rfcEmisor: fac.rfcEmisor,
                        uuid: fac.uuid,
                        blobpath: fac.blobpath
                    });

                    let base64 = "";
                    if (xmlRes.success) {
                        const data = xmlRes.data;
                        base64 = typeof data === 'string' ? data :
                            (data?.Respuesta?.xmlBase64 || data?.xmlBase64 || data?.xml || data?.bodyResponse?.xmlBase64);
                    }

                    if (base64) {
                        const xmlCrudo = Buffer.from(base64, 'base64').toString('utf-8');
                        if (this.cfdiService) {
                            facturasProcesadas.push(this.cfdiService.xmlToJson(xmlCrudo, fac.blobpath, fac.estado));
                        }
                    }
                } catch (err) {
                    console.error(`Error procesando detalle para UUID ${fac.uuid}:`, err.message);
                }
            }

            return { success: true, count: facturasProcesadas.length, facturas: facturasProcesadas };
        } catch (error) {
            console.error("Error en facturasDetalladas:", error.message);
            return { success: false, message: "Error al procesar facturas detalladas" };
        }
    }

    async validarReceptor(token, receptor, rfcEmisor) {
        try {
            const payload = {
                "RFCReceptor": receptor.rfc,
                "NombreRazonSocial": receptor.nombre,
                "PaisResidenciaFiscal": receptor.paisResidenciaFiscal || "",
                "ClaveIdentidadFiscal": receptor.claveIdentidadFiscal || "",
                "Correo": receptor.correo || null,
                "Rfc": rfcEmisor,
                "UsoFactura": receptor.usoCFDI || "S01",
                "Frecuencia": receptor.frecuencia || 0,
                "Asignacion": receptor.asignacion || 0,
                "CodigoPostal": receptor.codigoPostal,
                "RegimenFiscal": receptor.regimenFiscal,
                "RegimenFiscalDescripcion": receptor.regimenFiscal + " - " + (receptor.regimenFiscalDescripcion || "")
            };

            const respuesta = await this._post('/api/facmovil/favoritos/cliente-frecuente/valida', payload, token);
            return { success: true, data: respuesta.data };
        } catch (error) {
            return { success: false, message: "Error al validar receptor", error: error.response?.data || error.message };
        }
    }

    async eliminarReceptorFavorito(token, receptor, rfcEmisor) {
        try {
            const url = `https://${this.satFacHost}/api/facmovil/favoritos/cliente-frecuente`;
            const payload = {
                "RFCReceptor": receptor.rfc,
                "NombreRazonSocial": receptor.nombre,
                "PaisResidenciaFiscal": receptor.paisResidenciaFiscal || "",
                "ClaveIdentidadFiscal": receptor.claveIdentidadFiscal || "",
                "Correo": receptor.correo || null,
                "Rfc": rfcEmisor,
                "UsoFactura": receptor.usoCFDI || "S01",
                "Frecuencia": receptor.frecuencia || null,
                "Asignacion": receptor.asignacion || 0,
                "CodigoPostal": receptor.codigoPostal,
                "RegimenFiscal": receptor.regimenFiscal,
                "RegimenFiscalDescripcion": receptor.regimenFiscal + " - " + (receptor.regimenFiscalDescripcion || "")
            };

            const respuesta = await axios({
                method: 'DELETE',
                url,
                data: payload,
                headers: { ...this.commonHeaders, Authorization: `Bearer ${token}` }
            });
            return { success: true, data: respuesta.data };
        } catch (error) {
            return { success: false, message: "Error al eliminar receptor favorito", error: error.response?.data || error.message };
        }
    }

    async refreshToken(token, refreshToken) {
        try {
            if (!token || !refreshToken) return { success: false, message: "Token y refresh token son requeridos" };
            const respuesta = await this._post('/api/zuul/auth/nam/refresh/token',
                { access_token: "", refresh_token: refreshToken }, token);
            return { success: true, data: respuesta.data };
        } catch (error) {
            console.error("Error al refrescar token:", error.message);
            return { success: false, message: "Error al refrescar sesión de facturas" };
        }
    }

    async consultar(token, options) {
        try {
            const validation = validationUtils.validateConsultarOptions(options);
            if (!validation.isValid) return { success: false, message: validation.message };

            const { rfc, tipo = "emitidas", estado = null, uuid = null } = options;
            const sanitizedDates = dateUtils.sanitizeRange(options.fechaInicio, options.fechaFin);
            const isEmitidas = tipo === "emitidas";

            const requestBody = {
                RfcEmisor: uuid ? (isEmitidas ? rfc : "") : (isEmitidas ? rfc : ""),
                RfcReceptor: uuid ? (isEmitidas ? "" : rfc) : (isEmitidas ? "" : rfc),
                FechaInicialPeriodo: uuid ? null : sanitizedDates.start,
                FechaFinalPeriodo: uuid ? null : sanitizedDates.end,
                CanalConsulta: 4,
                EstadoComprobante: uuid ? null : estado,
                Uuid: uuid,
                RfcTercero: null,
                FiltroComplementos: 0,
                Complementos: []
            };

            const respuesta = await this._post('/api/facmovil/facturas/consultaCfdi', requestBody, token);

            return {
                success: true,
                rangeUsed: { fechaInicio: sanitizedDates.start, fechaFin: sanitizedDates.end },
                data: respuesta.data,
                processed: formatterUtils.processConsultaResponse(respuesta.data)
            };
        } catch (error) {
            console.error("Error al consultar facturas:", error.message);
            return { success: false, message: "Error al consultar lista de facturas" };
        }
    }

    async myFacturaInfo(token, rfc) {
        try {
            if (!token || !rfc) return { success: false, message: "Token y RFC son requeridos" };
            const respuesta = await this._post('/api/facmovil/user/perfil', { rfc }, token);
            const alerts = await this._checkAlerts(token, rfc);
            const { puedeFacturar = false, codigosPostales = [] } = respuesta.data?.userInfoDTO || {};
            return { success: true, data: { puedeFacturar, codigosPostales, alerts } };
        } catch (error) {
            console.error("Error al obtener información de factura:", error.message);
            return { success: false, message: "No se pudo obtener el perfil de facturación" };
        }
    }

    async getFacturasCompletas(token, options) {
        try {
            const [vigentesRes, canceladasRes] = await Promise.all([
                this.consultar(token, { ...options, estado: 1 }),
                this.consultar(token, { ...options, estado: 0 })
            ]);

            let todasFacturas = [];
            if (vigentesRes.success) {
                todasFacturas = [...todasFacturas, ...vigentesRes.processed.map(f => ({ ...f, Estado: 1 }))];
            }
            if (canceladasRes.success) {
                todasFacturas = [...todasFacturas, ...canceladasRes.processed.map(f => ({ ...f, Estado: 0 }))];
            }

            return { success: true, count: todasFacturas.length, facturas: todasFacturas };
        } catch (error) {
            console.error("Error en getFacturasCompletas:", error.message);
            return { success: false, message: "Error al consolidar la lista de facturas" };
        }
    }

    async _checkAlerts(token, rfc) {
        try {
            const respuesta = await this._post('/api/facmovil/notificaciones/consultaAlertas', { rfc }, token);
            return respuesta.data;
        } catch (error) {
            return null;
        }
    }

    async getXml(token, options) { return this._makeRequest('obtenerXml', token, options); }
    async getPdf(token, options) { return this._makeRequest('obtenerPdf', token, options); }

    async _makeRequest(endpoint, token, options) {
        try {
            const { rfcEmisor, blobpath, uuid, xmlBase64 = "", pdfCartaPorte30 = null } = options;
            if (!rfcEmisor || !blobpath || !uuid) return { success: false, message: "Faltan datos requeridos" };

            const payload = { rfcEmisor, uuid, blobpath, pdfCartaPorte30, xmlBase64: xmlBase64 || "" };
            const respuesta = await this._post(`/api/facmovil/ri/${endpoint}`, payload, token);
            return { success: true, data: respuesta.data };
        } catch (error) {
            console.error(`Error en ${endpoint}:`, error.message);
            return { success: false, message: `Error al ejecutar ${endpoint}` };
        }
    }

    async validarFactura(token, comprobante) {
        try {
            if (!token || !comprobante) return { success: false, message: "Token y comprobante requeridos" };
            const payload = this._ensureWrap(comprobante);
            const respuesta = await this._post('/api/facmovil/genera-cfdi/v2/valida-xml', payload, token);
            return { success: true, data: respuesta.data };
        } catch (error) {
            if (error.response?.status === 400 && error.response?.data?.listaErrores) {
                return { success: true, data: error.response.data };
            }
            return { success: false, message: "Error en la validación del SAT", error: error.response?.data || error.message };
        }
    }

    async timbrar(token, comprobanteSellado, rfc) {
        try {
            if (!token || !comprobanteSellado || !rfc) return { success: false, message: "Faltan datos" };
            const url = `/api/facmovil/genera-cfdi/v2/timbrarXml?rfc=${rfc.toLowerCase()}`;
            const payload = this._ensureWrap(comprobanteSellado);
            const respuesta = await this._post(url, payload, token);
            return { success: true, data: respuesta.data };
        } catch (error) {
            return { success: false, message: "Error al timbrar", status: error.response?.status, error: error.response?.data || error.message };
        }
    }
}

module.exports = SatFactura;
