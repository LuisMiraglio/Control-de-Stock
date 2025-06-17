const express = require('express');
const router = express.Router();
const { db } = require('../database');

// Obtener todas las entregas
router.get('/', (req, res) => {
    db.all(`
        SELECT d.*, t.name as technician_name, p.name as product_name
        FROM deliveries d
        JOIN technicians t ON d.technician_id = t.id
        JOIN products p ON d.product_id = p.id
        ORDER BY d.delivery_date DESC
    `, [], (err, deliveries) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(deliveries);
    });
});

// Agregar una nueva entrega
router.post('/', (req, res) => {
    const { technician_id, product_id, quantity, comment, delivery_date } = req.body;
    
    if (!technician_id || !product_id || !quantity || !delivery_date) {
        return res.status(400).json({ 
            error: "Se requiere ID de técnico, ID de producto, cantidad y fecha" 
        });
    }

    // Verificar si hay suficiente stock
    db.get('SELECT stock FROM products WHERE id = ?', [product_id], (err, product) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!product) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }
        
        if (product.stock < quantity) {
            return res.status(400).json({ error: "No hay suficiente stock disponible" });
        }
        
        db.serialize(() => {
            // Actualizar el stock del producto
            db.run(
                'UPDATE products SET stock = stock - ? WHERE id = ?',
                [quantity, product_id],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    // Registrar la entrega - Agregamos valor por defecto para reason
                    db.run(
                        `INSERT INTO deliveries 
                        (technician_id, product_id, quantity, reason, comment, delivery_date) 
                        VALUES (?, ?, ?, ?, ?, ?)`,
                        [technician_id, product_id, quantity, "Sin motivo", comment, delivery_date],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }
                            
                            res.status(201).json({
                                id: this.lastID,
                                technician_id,
                                product_id,
                                quantity,
                                comment,
                                delivery_date
                            });
                        }
                    );
                }
            );
        });
    });
});

// Actualizar una entrega
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { technician_id, product_id, quantity, comment, original_product_id, original_quantity } = req.body;
    
    if (!technician_id || !product_id || !quantity) {
        return res.status(400).json({ 
            error: "Se requiere ID de técnico, ID de producto y cantidad" 
        });
    }

    // Función para realizar la actualización final de la entrega
    const updateDelivery = () => {
        db.run(
            `UPDATE deliveries 
             SET technician_id = ?, product_id = ?, quantity = ?, reason = ?, comment = ?
             WHERE id = ?`,
            [technician_id, product_id, quantity, "Sin motivo", comment, id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({
                    id: parseInt(id),
                    technician_id,
                    product_id,
                    quantity,
                    comment,
                    changes: this.changes
                });
            }
        );
    };

    // Si el producto o la cantidad cambian, actualizar stocks
    if (original_product_id && (original_product_id != product_id || original_quantity != quantity)) {
        db.serialize(() => {
            // 1. Devolver stock al producto original
            db.run(
                'UPDATE products SET stock = stock + ? WHERE id = ?',
                [original_quantity, original_product_id]
            );
            
            // 2. Verificar stock del nuevo producto
            db.get('SELECT stock FROM products WHERE id = ?', [product_id], (err, product) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                if (!product) {
                    return res.status(404).json({ error: "Producto nuevo no encontrado" });
                }
                
                // 3. Verificar si hay suficiente stock
                if (product.stock < quantity) {
                    // Si no hay suficiente stock, restaurar el estado anterior y devolver error
                    db.run(
                        'UPDATE products SET stock = stock - ? WHERE id = ?',
                        [original_quantity, original_product_id]
                    );
                    return res.status(400).json({ error: "No hay suficiente stock disponible" });
                }
                
                // 4. Restar stock del nuevo producto
                db.run(
                    'UPDATE products SET stock = stock - ? WHERE id = ?',
                    [quantity, product_id],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        // 5. Ahora actualizar la entrega
                        updateDelivery();
                    }
                );
            });
        });
    } else {
        // Si no cambia producto ni cantidad, solo actualizar la entrega
        updateDelivery();
    }
});

// Eliminar una entrega
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    // Obtener datos de la entrega antes de eliminar
    db.get('SELECT product_id, quantity FROM deliveries WHERE id = ?', [id], (err, delivery) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!delivery) {
            return res.status(404).json({ error: "Entrega no encontrada" });
        }
        
        db.serialize(() => {
            // Devolver el stock al producto
            db.run(
                'UPDATE products SET stock = stock + ? WHERE id = ?',
                [delivery.quantity, delivery.product_id]
            );
            
            // Eliminar la entrega
            db.run('DELETE FROM deliveries WHERE id = ?', [id], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({ 
                    deleted: this.changes > 0,
                    product_id: delivery.product_id,
                    quantity: delivery.quantity
                });
            });
        });
    });
});

module.exports = router;
