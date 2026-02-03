class DateUtils {
    /**
     * Obtiene el rango de fechas para el mes actual formateado como YYYY-MM-DD.
     * @returns {Object} { start, end }
     */
    getCurrentMonthRange() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-indexed

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0); // Último día del mes (maneja Febrero, años bisiestos, etc.)

        return {
            start: this.formatDate(startDate),
            end: this.formatDate(now < endDate ? now : endDate) // No pedir fechas futuras
        };
    }

    /**
     * Formatea un objeto Date a YYYY-MM-DD.
     * @param {Date} date 
     * @returns {string}
     */
    formatDate(date) {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();

        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return [year, month, day].join('-');
    }

    /**
     * Valida y ajusta el rango de fechas para que no exceda 31 días (límite del SAT).
     * @param {string} start 
     * @param {string} end 
     * @returns {Object} { start, end }
     */
    sanitizeRange(start, end) {
        if (!start) {
            const range = this.getCurrentMonthRange();
            start = range.start;
            end = end || range.end;
        }

        if (!end) {
            const startDate = new Date(start);
            const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            end = this.formatDate(endDate);
        }

        // Validación de 31 días si es necesario (opcional según el servicio del SAT)
        const s = new Date(start);
        const e = new Date(end);
        const diffDays = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24));

        if (diffDays > 31) {
            // Ajustar el fin a 31 días desde el inicio si excede el límite
            const adjustedEnd = new Date(s);
            adjustedEnd.setDate(s.getDate() + 31);
            end = this.formatDate(adjustedEnd);
        }

        return { start, end };
    }
}

module.exports = new DateUtils();
