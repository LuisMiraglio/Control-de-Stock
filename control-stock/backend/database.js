const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'db', 'stock.db');
const fs = require('fs');

// Asegurar que el directorio para la base de datos existe
if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

// Crear conexión a la base de datos
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.message);
        throw err;
    }
    console.log('Conectado a la base de datos SQLite');
});

// Inicializar base de datos con tablas
function initDB() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Habilitar claves foráneas
            db.run('PRAGMA foreign_keys = ON;');
            
            // Tabla de productos
            db.run(`
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    stock INTEGER NOT NULL DEFAULT 0,
                    created_date TEXT NOT NULL
                );
            `);
            
            // Tabla de técnicos
            db.run(`
                CREATE TABLE IF NOT EXISTS technicians (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_date TEXT NOT NULL
                );
            `);
            
            // Tabla de entradas de stock
            db.run(`
                CREATE TABLE IF NOT EXISTS stock_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER,
                    quantity INTEGER NOT NULL,
                    entry_date TEXT NOT NULL,
                    FOREIGN KEY (product_id) REFERENCES products (id)
                );
            `);
            
            // Tabla de entregas
            db.run(`
                CREATE TABLE IF NOT EXISTS deliveries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    technician_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL,
                    reason TEXT, -- Eliminada la restricción NOT NULL
                    comment TEXT,
                    delivery_date TEXT NOT NULL,
                    FOREIGN KEY (technician_id) REFERENCES technicians (id),
                    FOREIGN KEY (product_id) REFERENCES products (id)
                );
            `, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
}

module.exports = {
    db,
    initDB
};
