class FormatterUtils {
    /**
     * Formatea la respuesta de consulta de CFDI para que sea más legible.
     * @param {Object} data Respuesta cruda del SAT
     * @returns {Array} Lista de facturas procesadas
     */
    processConsultaResponse(data) {
        // El SAT a veces devuelve 'ListadoCfdi' y otras veces 'Respuesta'
        const rawList = data?.ListadoCfdi || data?.Respuesta || [];
        const list = Array.isArray(rawList) ? rawList : [rawList];

        if (list.length === 0) return [];

        return list.map(item => ({
            uuid: item.Uuid || item.uuid,
            rfcEmisor: item.RfcEmisor || item.rfcEmisor,
            nombreEmisor: item.NombreEmisor || item.nombreEmisor,
            rfcReceptor: item.RfcReceptor || item.rfcReceptor,
            nombreReceptor: item.NombreReceptor || item.nombreReceptor,
            fechaEmision: item.FechaEmision || item.fechaEmision,
            fechaCertificacion: item.FechaCertificacion || item.fechaCertificacion,
            total: item.Total || item.total,
            subtotal: item.Subtotal || item.subtotal,
            descuento: item.Descuento || item.descuento,
            moneda: item.Moneda || item.moneda,
            tipoCambio: item.TipoCambio || item.tipoCambio,
            tipoComprobante: item.TipoComprobante || item.tipoComprobante,
            metodoPago: item.MetodoPago || item.metodoPago,
            formaPago: item.FormaPago || item.formaPago,
            estado: item.EstadoComprobante !== undefined ? item.EstadoComprobante : item.Estado,
            efecto: item.EfectoComprobante || item.efectoComprobante,
            usoCfdi: item.UsoCfdi || item.usoCfdi,
            serie: item.Serie || item.serie,
            folio: item.Folio || item.folio,
            blobpath: item.UrlXml || item.BlobPath || item.blobpath
        }));
    }
}

module.exports = new FormatterUtils();
