const express = require('express');
const cors = require('cors');
const path = require('path');
const productRoutes = require('./routes/products');
const technicianRoutes = require('./routes/technicians');
const deliveryRoutes = require('./routes/deliveries');
const db = require('./database');

// Crear la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Permitir peticiones desde cualquier origen (para desarrollo)
app.use(express.json()); // Parsear body de las peticiones como JSON
app.use(express.static(path.join(__dirname, '../'))); // Servir archivos estáticos

// Rutas de la API
app.use('/api/products', productRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/deliveries', deliveryRoutes);

// Ruta principal - sirve la aplicación frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Inicializar base de datos
db.initDB().then(() => {
    console.log('Base de datos inicializada correctamente');
    
    // Iniciar servidor
    app.listen(PORT, () => {
        console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Error al inicializar la base de datos:', err);
});
