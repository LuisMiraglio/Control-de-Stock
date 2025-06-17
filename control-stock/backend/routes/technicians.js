const express = require('express');
const router = express.Router();
const { db } = require('../database');

// Obtener todos los técnicos
router.get('/', (req, res) => {
    db.all(`
        SELECT t.*, COALESCE(SUM(d.quantity), 0) as total_delivered
        FROM technicians t
        LEFT JOIN deliveries d ON t.id = d.technician_id
        GROUP BY t.id, t.name
        ORDER BY t.name
    `, [], (err, technicians) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(technicians);
    });
});

// Obtener un técnico por ID con sus entregas
router.get('/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM technicians WHERE id = ?', [id], (err, technician) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!technician) {
            return res.status(404).json({ error: "Técnico no encontrado" });
        }
        
        // Obtener las entregas del técnico
        db.all(`
            SELECT d.id, d.delivery_date, d.product_id, p.name as product_name, d.quantity, d.comment
            FROM deliveries d
            JOIN products p ON d.product_id = p.id
            WHERE d.technician_id = ?
            ORDER BY d.delivery_date DESC
        `, [id], (err, deliveries) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            res.json({
                ...technician,
                deliveries
            });
        });
    });
});

// Agregar un nuevo técnico
router.post('/', (req, res) => {
    const { name, created_date } = req.body;
    
    if (!name || !created_date) {
        return res.status(400).json({ error: "Se requiere nombre y fecha" });
    }

    db.run(
        'INSERT INTO technicians (name, created_date) VALUES (?, ?)',
        [name, created_date],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: "Ya existe un técnico con ese nombre" });
                }
                return res.status(500).json({ error: err.message });
            }
            
            res.status(201).json({
                id: this.lastID,
                name,
                created_date,
                total_delivered: 0
            });
        }
    );
});

// Actualizar un técnico
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: "Se requiere nombre" });
    }

    db.run(
        'UPDATE technicians SET name = ? WHERE id = ?',
        [name, id],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: "Ya existe un técnico con ese nombre" });
                }
                return res.status(500).json({ error: err.message });
            }
            
            res.json({
                id: parseInt(id),
                name,
                changes: this.changes
            });
        }
    );
});

// Eliminar un técnico - VERSIÓN CORREGIDA
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    // Verificar si el técnico existe primero
    db.get('SELECT id FROM technicians WHERE id = ?', [id], (err, technician) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!technician) {
            return res.status(404).json({ error: "Técnico no encontrado" });
        }
        
        // Verificar si el técnico tiene entregas
        db.get('SELECT COUNT(*) as count FROM deliveries WHERE technician_id = ?', [id], (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            if (result.count > 0) {
                return res.status(400).json({ 
                    error: "No se puede eliminar el técnico porque tiene entregas asociadas",
                    hasDeliveries: true,
                    count: result.count
                });
            }
            
            // Si no tiene entregas, eliminarlo
            db.run('DELETE FROM technicians WHERE id = ?', [id], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: "Técnico no encontrado o ya eliminado" });
                }
                
                res.json({ 
                    deleted: true,
                    message: "Técnico eliminado exitosamente" 
                });
            });
        });
    });
});

module.exports = router;
