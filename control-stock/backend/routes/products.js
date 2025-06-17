const express = require('express');
const router = express.Router();
const { db } = require('../database');

// Obtener todos los productos con su stock actual
router.get('/', (req, res) => {
    db.all('SELECT * FROM products ORDER BY name', [], (err, products) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(products);
    });
});

// Obtener entradas de stock
router.get('/entries', (req, res) => {
    db.all(`
        SELECT se.id as entry_id, se.product_id, se.quantity, se.entry_date, p.name, p.stock
        FROM stock_entries se
        JOIN products p ON se.product_id = p.id
        ORDER BY se.entry_date DESC
    `, [], (err, entries) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(entries);
    });
});

// Agregar un nuevo producto con entrada de stock
router.post('/', (req, res) => {
    const { name, quantity, created_date } = req.body;
    
    if (!name || !quantity || !created_date) {
        return res.status(400).json({ error: "Se requieren nombre, cantidad y fecha" });
    }

    db.serialize(() => {
        // Insertar producto
        db.run(
            'INSERT INTO products (name, stock, created_date) VALUES (?, ?, ?)',
            [name, quantity, created_date],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                const productId = this.lastID;
                
                // Insertar entrada de stock
                db.run(
                    'INSERT INTO stock_entries (product_id, quantity, entry_date) VALUES (?, ?, ?)',
                    [productId, quantity, created_date],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        
                        res.status(201).json({
                            id: productId,
                            name,
                            stock: quantity,
                            created_date,
                            entry_id: this.lastID
                        });
                    }
                );
            }
        );
    });
});

// Actualizar un producto
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, stock, entryId, quantity } = req.body;
    
    db.serialize(() => {
        // Actualizar el nombre del producto
        db.run(
            'UPDATE products SET name = ?, stock = ? WHERE id = ?',
            [name, stock, id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                // Actualizar la entrada de stock si se proporciona un ID de entrada
                if (entryId) {
                    db.run(
                        'UPDATE stock_entries SET quantity = ? WHERE id = ?',
                        [quantity, entryId],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }
                            
                            res.json({
                                id: parseInt(id),
                                name,
                                stock,
                                changes: this.changes
                            });
                        }
                    );
                } else {
                    res.json({
                        id: parseInt(id),
                        name,
                        stock,
                        changes: this.changes
                    });
                }
            }
        );
    });
});

// Eliminar un producto
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        res.json({ deleted: this.changes > 0 });
    });
});

// Eliminar una entrada de stock
router.delete('/entry/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT product_id, quantity FROM stock_entries WHERE id = ?', [id], (err, entry) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!entry) {
            return res.status(404).json({ error: "Entrada no encontrada" });
        }
        
        db.serialize(() => {
            // Eliminar la entrada
            db.run('DELETE FROM stock_entries WHERE id = ?', [id], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                // Recalcular el stock total del producto
                db.run(`
                    UPDATE products 
                    SET stock = (SELECT COALESCE(SUM(quantity), 0) FROM stock_entries WHERE product_id = ?)
                    WHERE id = ?
                `, [entry.product_id, entry.product_id], function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    
                    res.json({ 
                        deleted: true,
                        product_id: entry.product_id
                    });
                });
            });
        });
    });
});

module.exports = router;
