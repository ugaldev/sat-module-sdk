class ValidationUtils {
    /**
     * Valida el formato de un RFC (Persona Física o Moral).
     * @param {string} rfc 
     * @returns {boolean}
     */
    isValidRfc(rfc) {
        if (!rfc) return false;
        const rfcPattern = /^([A-ZÑ&]{3,4})(\d{6})([A-Z0-9]{3})$/;
        return rfcPattern.test(rfc.toUpperCase().trim());
    }

    /**
     * Valida los parámetros de consulta de facturas.
     * @param {Object} options 
     * @returns {Object} { isValid, message }
     */
    validateConsultarOptions(options) {
        const { rfc, tipo } = options;

        if (!rfc) {
            return { isValid: false, message: "El RFC es requerido para la consulta" };
        }

        if (!this.isValidRfc(rfc)) {
            return { isValid: false, message: "El RFC proporcionado tiene un formato inválido" };
        }

        if (!tipo || !["emitidas", "recibidas"].includes(tipo)) {
            return { isValid: false, message: "El tipo de consulta debe ser 'emitidas' o 'recibidas'" };
        }

        return { isValid: true };
    }

    /**
     * Validador de estructura JSON para CFDI 4.0 (Local)
     * Soporta tanto PascalCase como camelCase.
     * @param {Object} data - Objeto de la factura
     */
    validarCFDI(data) {
        const errores = [];
        const c = data?.comprobante || data?.Comprobante || data;

        if (!c || (typeof c !== 'object')) {
            return { valido: false, errores: ['La estructura de la factura es inválida o inexistente.'] };
        }

        // Helper para obtener valor ignorando case
        const get = (obj, key) => {
            if (!obj) return undefined;
            return obj[key] !== undefined ? obj[key] : obj[key.charAt(0).toLowerCase() + key.slice(1)];
        };

        const check = (obj, key, label) => {
            if (get(obj, key) === undefined || get(obj, key) === null || get(obj, key) === '') {
                errores.push(`${label}: El campo "${key}" es obligatorio.`);
                return false;
            }
            return true;
        };

        // 1. Validar Datos Generales
        check(c, 'Fecha', 'Comprobante');
        check(c, 'TipoDeComprobante', 'Comprobante');
        check(c, 'LugarExpedicion', 'Comprobante');
        check(c, 'Moneda', 'Comprobante');
        check(c, 'SubTotal', 'Comprobante');
        check(c, 'Total', 'Comprobante');
        check(c, 'Exportacion', 'Comprobante');
        check(c, 'MetodoPago', 'Comprobante');
        check(c, 'FormaPago', 'Comprobante');

        // 2. Validar Emisor
        const emisor = get(c, 'Emisor');
        if (!emisor) {
            errores.push('Emisor: El nodo Emisor es obligatorio.');
        } else {
            check(emisor, 'Rfc', 'Emisor');
            check(emisor, 'Nombre', 'Emisor');
            check(emisor, 'RegimenFiscal', 'Emisor');
        }

        // 3. Validar Receptor
        const receptor = get(c, 'Receptor');
        if (!receptor) {
            errores.push('Receptor: El nodo Receptor es obligatorio.');
        } else {
            check(receptor, 'Rfc', 'Receptor');
            check(receptor, 'Nombre', 'Receptor');
            check(receptor, 'DomicilioFiscalReceptor', 'Receptor');
            check(receptor, 'RegimenFiscalReceptor', 'Receptor');
            check(receptor, 'UsoCFDI', 'Receptor');
        }

        // 4. Lógica de Información Global (Obligatoria para Público en General)
        const rfcReceptor = get(receptor, 'Rfc');
        if (rfcReceptor === 'XAXX010101000') {
            const ig = get(c, 'InformacionGlobal');
            if (!ig) {
                errores.push('Información Global: Es obligatorio para RFC de Público en General (XAXX010101000).');
            } else {
                check(ig, 'Periodicidad', 'Información Global');
                check(ig, 'Meses', 'Información Global');
                check(ig, 'Año', 'Información Global');
            }
        }

        // 5. Validar Conceptos
        const conceptosNode = get(c, 'Conceptos');
        let conceptos = [];
        if (Array.isArray(conceptosNode)) {
            conceptos = conceptosNode;
        } else if (conceptosNode && (typeof conceptosNode === 'object')) {
            conceptos = get(conceptosNode, 'Concepto') || [];
        }

        if (!Array.isArray(conceptos) || conceptos.length === 0) {
            errores.push('Conceptos: Debe existir al menos un concepto.');
        } else {
            conceptos.forEach((con, index) => {
                const label = `Concepto[${index}]`;
                check(con, 'ClaveProdServ', label);
                check(con, 'Cantidad', label);
                check(con, 'ClaveUnidad', label);
                check(con, 'Descripcion', label);
                check(con, 'ValorUnitario', label);
                check(con, 'Importe', label);
                check(con, 'ObjetoImp', label);

                // Si es objeto de impuesto 02, debe tener al menos un traslado o retención
                if (get(con, 'ObjetoImp') === '02') {
                    const imp = get(con, 'Impuestos');
                    if (!imp) {
                        errores.push(`${label}: Si ObjetoImp es "02", el nodo Impuestos es obligatorio.`);
                    } else {
                        const tras = get(imp, 'Traslados');
                        const ret = get(imp, 'Retenciones');
                        if (!tras && !ret) {
                            errores.push(`${label}: Si ObjetoImp es "02", el nodo de Impuestos debe tener Traslados o Retenciones.`);
                        }
                    }
                }
            });
        }

        // 6. Validar Nodo de Impuestos a nivel Comprobante (si hay traslados o retenciones globales)
        // Esto es opcional en la estructura pero obligatorio si hay importes calculados
        const impuestosGlobales = get(c, 'Impuestos');
        if (impuestosGlobales) {
            // Si hay totalImpuestosTrasladados, verificar traslados
            if (get(impuestosGlobales, 'TotalImpuestosTrasladados') && !get(impuestosGlobales, 'Traslados')) {
                errores.push('Impuestos: Si existe TotalImpuestosTrasladados, el nodo Traslados es obligatorio.');
            }
            if (get(impuestosGlobales, 'TotalImpuestosRetenidos') && !get(impuestosGlobales, 'Retenciones')) {
                errores.push('Impuestos: Si existe TotalImpuestosRetenidos, el nodo Retenciones es obligatorio.');
            }
        }

        return {
            valido: errores.length === 0,
            errores
        };
    }
}

module.exports = new ValidationUtils();
