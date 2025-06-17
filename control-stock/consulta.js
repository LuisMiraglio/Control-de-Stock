const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'db', 'stock.db');

// Abrir conexión
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar:', err.message);
        return;
    }
    console.log('Conectado a la base de datos');
    
    // Ejemplo: listar todos los productos
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) {
            console.error('Error en consulta:', err);
            return;
        }
        console.log("PRODUCTOS ENCONTRADOS:", rows.length);
        console.table(rows);
        
        // Cerrar conexión
        db.close();
    });
});
