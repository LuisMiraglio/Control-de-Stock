// Configuración de la API
const API_URL = 'http://localhost:3000/api';

// Authentication
function login(username, password) {
    // Simple authentication - in a real app, use proper authentication
    return username === 'admin' && password === 'admin123';
}

// Event listeners
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar si ya hay una sesión activa
    checkSession();
    
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (login(username, password)) {
            // Guardar sesión en localStorage
            localStorage.setItem('stockControlSession', JSON.stringify({
                isLoggedIn: true,
                username: username,
                timestamp: new Date().getTime()
            }));
            
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            loadDashboard();
        } else {
            document.getElementById('loginError').classList.remove('hidden');
        }
    });

    document.getElementById('addProductForm').addEventListener('submit', addProduct);
    document.getElementById('addTechnicianForm').addEventListener('submit', addTechnician);
    document.getElementById('deliveryForm').addEventListener('submit', addDelivery);
    
    // Registrar los event listeners para los formularios de edición
    document.getElementById('editProductForm').addEventListener('submit', editProduct);
    document.getElementById('editTechnicianForm').addEventListener('submit', editTechnician);
    document.getElementById('editDeliveryForm').addEventListener('submit', editDelivery);
});

// Función para verificar si existe una sesión activa
function checkSession() {
    const sessionData = localStorage.getItem('stockControlSession');
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            
            // Opcional: verificar si la sesión no ha expirado (ejemplo: 8 horas)
            const currentTime = new Date().getTime();
            const sessionTime = session.timestamp || 0;
            const sessionDuration = 8 * 60 * 60 * 1000; // 8 horas en milisegundos
            
            if (session.isLoggedIn && (currentTime - sessionTime < sessionDuration)) {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('mainApp').classList.remove('hidden');
                loadDashboard();
            }
        } catch (error) {
            console.error("Error al procesar datos de sesión:", error);
            // Si hay un error, limpiar datos corrupos
            localStorage.removeItem('stockControlSession');
        }
    }
}

function logout() {
    // Eliminar la sesión del localStorage
    localStorage.removeItem('stockControlSession');
    
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginError').classList.add('hidden');
}

function showSection(sectionName) {
    const sections = ['dashboard', 'products', 'technicians', 'deliveries', 'technicianDetail']; // Se eliminó 'dataBackup'
    sections.forEach(section => {
        document.getElementById(section + 'Section').classList.add('hidden');
    });
    
    document.getElementById(sectionName + 'Section').classList.remove('hidden');
    
    switch(sectionName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'products':
            loadProducts();
            break;
        case 'technicians':
            loadTechnicians();
            break;
        case 'deliveries':
            loadDeliveries();
            loadDeliveryOptions();
            break;
        // Se eliminó el case 'dataBackup'
    }
}

function loadDashboard() {
    loadTechniciansGrid();
}

async function loadTechniciansGrid() {
    try {
        const response = await fetch(`${API_URL}/technicians`);
        const technicians = await response.json();

        const grid = document.getElementById('techniciansGrid');
        grid.innerHTML = '';

        technicians.forEach(tech => {
            const card = document.createElement('div');
            card.className = 'tech-card';
            card.onclick = () => showTechnicianDetail(tech.id, tech.name);
            card.innerHTML = `
                <h3>${tech.name}</h3>
                <p>${tech.total_delivered} productos entregados</p>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading technicians:', error);
        showAlert('Error al cargar técnicos', 'danger');
    }
}

async function showTechnicianDetail(techId, techName) {
    try {
        document.getElementById('technicianDetailName').textContent = `Detalle: ${techName}`;
        
        const response = await fetch(`${API_URL}/technicians/${techId}`);
        const data = await response.json();
        
        const table = document.getElementById('technicianDetailTable');
        table.innerHTML = '';

        data.deliveries.forEach(delivery => {
            const row = table.insertRow();
            row.innerHTML = `
                <td>${new Date(delivery.delivery_date).toLocaleDateString()}</td>
                <td>${delivery.product_name}</td>
                <td>${delivery.quantity}</td>
                <td>${delivery.comment || '-'}</td>
                <td>
                    <button onclick="confirmDeleteDeliveryFromTechnician(${delivery.id}, ${delivery.product_id}, ${delivery.quantity}, ${techId}, '${techName}')" class="btn btn-danger action-button">Eliminar</button>
                </td>
            `;
        });

        showSection('technicianDetail');
    } catch (error) {
        console.error('Error loading technician details:', error);
        showAlert('Error al cargar detalles del técnico', 'danger');
    }
}

// Nueva función para confirmar eliminación desde la vista de detalle del técnico
function confirmDeleteDeliveryFromTechnician(deliveryId, productId, quantity, techId, techName) {
    if (confirm('¿Está seguro que desea eliminar esta entrega? Los productos se devolverán al stock.')) {
        deleteDeliveryFromTechnician(deliveryId, productId, quantity, techId, techName);
    }
}

// Nueva función para eliminar entrega desde la vista de detalle del técnico
async function deleteDeliveryFromTechnician(deliveryId, productId, quantity, techId, techName) {
    try {
        const response = await fetch(`${API_URL}/deliveries/${deliveryId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Error al eliminar la entrega');
        }
        
        showAlert('Entrega eliminada exitosamente y productos devueltos al stock', 'success');
        
        // Recargar los datos del técnico para refrescar la tabla de detalle
        showTechnicianDetail(techId, techName);
        
        // Actualizar otras vistas que puedan mostrar información de stock
        loadProducts();
        loadDashboard();
    } catch (error) {
        console.error('Error al eliminar entrega:', error);
        showAlert(error.message, 'danger');
    }
}

async function loadProducts() {
    try {
        // Obtener entradas de stock con información del producto
        const response = await fetch(`${API_URL}/products/entries`);
        const entries = await response.json();

        const table = document.getElementById('productsTable');
        table.innerHTML = '';

        entries.forEach(entry => {
            const row = table.insertRow();
            row.innerHTML = `
                <td>${new Date(entry.entry_date).toLocaleDateString()}</td>
                <td>${entry.name}</td>
                <td>+${entry.quantity}</td>
                <td>${entry.stock}</td>
                <td>
                    <button onclick="openEditProductModal(${entry.product_id}, '${entry.name}', ${entry.entry_id}, ${entry.quantity})" class="btn btn-info" style="padding: 8px 16px; font-size: 14px;">Editar</button>
                    <button onclick="confirmDeleteProduct(${entry.product_id}, ${entry.entry_id}, '${entry.name}')" class="btn btn-danger" style="padding: 8px 16px; font-size: 14px;">Eliminar</button>
                </td>
            `;
        });
    } catch (error) {
        console.error('Error loading products:', error);
        showAlert('Error al cargar productos', 'danger');
    }
}

async function loadTechnicians() {
    try {
        const response = await fetch(`${API_URL}/technicians`);
        const technicians = await response.json();

        const table = document.getElementById('techniciansTable');
        table.innerHTML = '';

        technicians.forEach(tech => {
            const row = table.insertRow();
            row.innerHTML = `
                <td>${tech.name}</td>
                <td>${tech.total_delivered}</td>
                <td>
                    <button onclick="showTechnicianDetail(${tech.id}, '${tech.name}')" class="btn btn-info" style="padding: 8px 16px; font-size: 14px;">Ver Detalle</button>
                    <button onclick="openEditTechnicianModal(${tech.id}, '${tech.name}')" class="btn btn-secondary" style="padding: 8px 16px; font-size: 14px;">Editar</button>
                    <button onclick="confirmDeleteTechnician(${tech.id}, '${tech.name}')" class="btn btn-danger" style="padding: 8px 16px; font-size: 14px;">Eliminar</button>
                </td>
            `;
        });
    } catch (error) {
        console.error('Error loading technicians:', error);
        showAlert('Error al cargar técnicos', 'danger');
    }
}

async function loadDeliveries() {
    try {
        const response = await fetch(`${API_URL}/deliveries`);
        const deliveries = await response.json();

        const table = document.getElementById('deliveriesTable');
        table.innerHTML = '';

        deliveries.forEach(delivery => {
            const row = table.insertRow();
            row.innerHTML = `
                <td>${new Date(delivery.delivery_date).toLocaleDateString()}</td>
                <td>${delivery.technician_name}</td>
                <td>${delivery.product_name}</td>
                <td>${delivery.quantity}</td>
                <td>${delivery.comment || '-'}</td>
                <td>
                    <button onclick="openEditDeliveryModal(${delivery.id}, ${delivery.technician_id}, ${delivery.product_id}, ${delivery.quantity}, '${delivery.comment || ''}')" class="btn btn-info" style="padding: 8px 16px; font-size: 14px;">Editar</button>
                    <button onclick="confirmDeleteDelivery(${delivery.id}, ${delivery.product_id}, ${delivery.quantity})" class="btn btn-danger" style="padding: 8px 16px; font-size: 14px;">Eliminar</button>
                </td>
            `;
        });
    } catch (error) {
        console.error('Error loading deliveries:', error);
        showAlert('Error al cargar entregas', 'danger');
    }
}

async function loadDeliveryOptions() {
    try {
        // Cargar técnicos
        const techResponse = await fetch(`${API_URL}/technicians`);
        const technicians = await techResponse.json();
        
        const techSelect = document.getElementById('deliveryTechnician');
        techSelect.innerHTML = '<option value="">Seleccionar técnico</option>';
        
        technicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech.id;
            option.textContent = tech.name;
            techSelect.appendChild(option);
        });
        
        // Cargar productos con stock
        const prodResponse = await fetch(`${API_URL}/products`);
        const products = await prodResponse.json();
        
        const prodSelect = document.getElementById('deliveryProduct');
        prodSelect.innerHTML = '<option value="">Seleccionar producto</option>';
        
        products.filter(prod => prod.stock > 0).forEach(prod => {
            const option = document.createElement('option');
            option.value = prod.id;
            option.textContent = `${prod.name} (Stock: ${prod.stock})`;
            prodSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading delivery options:', error);
        showAlert('Error al cargar opciones de entrega', 'danger');
    }
}

async function addProduct(e) {
    e.preventDefault();
    const name = document.getElementById('productName').value;
    const quantity = parseInt(document.getElementById('productQuantity').value);
    const date = new Date().toISOString();
    
    try {
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                quantity,
                created_date: date
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Error al agregar producto');
        }
        
        closeModal('addProductModal');
        document.getElementById('addProductForm').reset();
        showAlert('Producto agregado exitosamente', 'success');
        loadProducts();
        loadDashboard();
    } catch (error) {
        console.error('Error adding product:', error);
        showAlert(error.message, 'danger');
    }
}

async function addTechnician(e) {
    e.preventDefault();
    const name = document.getElementById('technicianName').value;
    const date = new Date().toISOString();
    
    try {
        const response = await fetch(`${API_URL}/technicians`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                created_date: date
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Error al agregar técnico');
        }
        
        closeModal('addTechnicianModal');
        document.getElementById('addTechnicianForm').reset();
        showAlert('Técnico agregado exitosamente', 'success');
        loadTechnicians();
        loadDashboard();
    } catch (error) {
        console.error('Error adding technician:', error);
        showAlert(error.message, 'danger');
    }
}

async function addDelivery(e) {
    e.preventDefault();
    const technicianId = document.getElementById('deliveryTechnician').value;
    const productId = document.getElementById('deliveryProduct').value;
    const quantity = parseInt(document.getElementById('deliveryQuantity').value);
    const comment = document.getElementById('deliveryComment').value;
    const date = new Date().toISOString();
    
    console.log('Enviando entrega:', { 
        technician_id: technicianId,
        product_id: productId,
        quantity,
        comment,
        delivery_date: date
    });
    
    try {
        const response = await fetch(`${API_URL}/deliveries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                technician_id: technicianId,
                product_id: productId,
                quantity,
                comment,
                delivery_date: date
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            console.error('Error response:', data);  // Para depurar la respuesta completa
            throw new Error(data.error || 'Error al registrar entrega');
        }
        
        document.getElementById('deliveryForm').reset();
        showAlert('Entrega registrada exitosamente', 'success');
        loadDeliveries();
        loadDeliveryOptions();
        loadDashboard();
    } catch (error) {
        console.error('Error adding delivery:', error);
        showAlert(error.message, 'danger');
    }
}

async function editProduct(e) {
    e.preventDefault();
    const productId = document.getElementById('editProductId').value;
    const entryId = document.getElementById('editEntryId').value;
    const name = document.getElementById('editProductName').value;
    const newQuantity = parseInt(document.getElementById('editProductQuantity').value);
    
    try {
        const response = await fetch(`${API_URL}/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                stock: newQuantity,
                entryId,
                quantity: newQuantity
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Error al actualizar el producto');
        }
        
        closeModal('editProductModal');
        showAlert('Producto actualizado exitosamente', 'success');
        loadProducts();
        loadDashboard();
    } catch (error) {
        console.error('Error updating product:', error);
        showAlert(error.message, 'danger');
    }
}

async function editTechnician(e) {
    e.preventDefault();
    const techId = document.getElementById('editTechnicianId').value;
    const name = document.getElementById('editTechnicianName').value;
    
    try {
        const response = await fetch(`${API_URL}/technicians/${techId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Error al actualizar el técnico');
        }
        
        closeModal('editTechnicianModal');
        showAlert('Técnico actualizado exitosamente', 'success');
        loadTechnicians();
        loadDashboard();
    } catch (error) {
        console.error('Error updating technician:', error);
        showAlert(error.message, 'danger');
    }
}

async function editDelivery(e) {
    e.preventDefault();
    const deliveryId = document.getElementById('editDeliveryId').value;
    const technicianId = document.getElementById('editDeliveryTechnician').value;
    const productId = document.getElementById('editDeliveryProduct').value;
    const newQuantity = parseInt(document.getElementById('editDeliveryQuantity').value);
    // Eliminamos la referencia a reason
    const comment = document.getElementById('editDeliveryComment').value;
    
    try {
        // Necesitamos conocer los valores originales
        const origData = {
            original_product_id: document.getElementById('editDeliveryProduct').dataset.origProductId,
            original_quantity: document.getElementById('editDeliveryQuantity').dataset.origQuantity
        };
        
        const response = await fetch(`${API_URL}/deliveries/${deliveryId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                technician_id: technicianId,
                product_id: productId,
                quantity: newQuantity,
                comment,
                original_product_id: origData.original_product_id,
                original_quantity: origData.original_quantity
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Error al actualizar la entrega');
        }
        
        closeModal('editDeliveryModal');
        showAlert('Entrega actualizada exitosamente', 'success');
        loadDeliveries();
        loadDashboard();
    } catch (error) {
        console.error('Error updating delivery:', error);
        showAlert(error.message, 'danger');
    }
}

async function deleteProduct(productId, entryId) {
    try {
        const response = await fetch(`${API_URL}/products/entry/${entryId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Error al eliminar el producto');
        }
        
        showAlert('Producto eliminado exitosamente', 'success');
        loadProducts();
        loadDashboard();
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        showAlert(error.message, 'danger');
    }
}

// Función mejorada para eliminar técnicos
async function deleteTechnician(techId) {
    try {
        const response = await fetch(`${API_URL}/technicians/${techId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (data.hasDeliveries) {
                showAlert(`No se puede eliminar el técnico: tiene ${data.count} entregas asociadas`, 'danger');
            } else {
                showAlert(data.error || 'Error al eliminar el técnico', 'danger');
            }
            return false;
        }
        
        showAlert('Técnico eliminado exitosamente', 'success');
        loadTechnicians();
        loadDashboard();
        return true;
    } catch (error) {
        console.error('Error al eliminar técnico:', error);
        showAlert('Error de conexión al eliminar el técnico', 'danger');
        return false;
    }
}

// Funciones para confirmar y eliminar productos
function confirmDeleteProduct(productId, entryId, productName) {
    if (confirm(`¿Está seguro que desea eliminar el producto "${productName}"?`)) {
        deleteProduct(productId, entryId);
    }
}

// Funciones para confirmar y eliminar técnicos
function confirmDeleteTechnician(techId, techName) {
    if (confirm(`¿Está seguro que desea eliminar al técnico "${techName}"?`)) {
        deleteTechnician(techId);
    }
}

// Funciones para confirmar y eliminar entregas
function confirmDeleteDelivery(deliveryId, productId, quantity) {
    if (confirm('¿Está seguro que desea eliminar esta entrega?')) {
        deleteDelivery(deliveryId, productId, quantity);
    }
}

function deleteDelivery(deliveryId, productId, quantity) {
    try {
        // Devolver el stock al producto
        const updateStockStmt = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
        updateStockStmt.run([quantity, productId]);
        updateStockStmt.free();
        
        // Eliminar la entrega
        const deleteStmt = db.prepare("DELETE FROM deliveries WHERE id = ?");
        deleteStmt.run([deliveryId]);
        deleteStmt.free();
        
        saveDB();
        showAlert('Entrega eliminada exitosamente', 'success');
        loadDeliveries();
        loadDeliveryOptions();
        loadDashboard();
    } catch (error) {
        console.error('Error al eliminar entrega:', error);
        showAlert('Error al eliminar la entrega', 'danger');
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
}

function showAlert(message, type) {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert:not(#loginError)');
    existingAlerts.forEach(alert => alert.remove());

    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.zIndex = '9999';
    alert.style.minWidth = '300px';
    alert.style.animation = 'slideInRight 0.3s ease';

    document.body.appendChild(alert);

    // Auto remove after 3 seconds
    setTimeout(() => {
        alert.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => alert.remove(), 300);
    }, 3000);
}

// Funciones para abrir modales
function openAddProductModal() {
    document.getElementById('addProductModal').style.display = 'block';
}

function openAddTechnicianModal() {
    document.getElementById('addTechnicianModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Funciones para abrir modales de edición
function openEditProductModal(productId, productName, entryId, quantity) {
    document.getElementById('editProductId').value = productId;
    document.getElementById('editEntryId').value = entryId;
    document.getElementById('editProductName').value = productName;
    document.getElementById('editProductQuantity').value = quantity;
    document.getElementById('editProductModal').style.display = 'block';
}

function openEditTechnicianModal(techId, techName) {
    document.getElementById('editTechnicianId').value = techId;
    document.getElementById('editTechnicianName').value = techName;
    document.getElementById('editTechnicianModal').style.display = 'block';
}

function openEditDeliveryModal(deliveryId, techId, productId, quantity, comment) {
    document.getElementById('editDeliveryId').value = deliveryId;
    
    // Guardar valores originales para usarlos en la actualización
    document.getElementById('editDeliveryProduct').dataset.origProductId = productId;
    document.getElementById('editDeliveryQuantity').dataset.origQuantity = quantity;
    
    // Cargar técnicos y productos de forma asíncrona
    fetchTechniciansForSelect('editDeliveryTechnician', techId);
    fetchProductsForSelect('editDeliveryProduct', productId);
    
    document.getElementById('editDeliveryQuantity').value = quantity;
    
    // Eliminamos la manipulación del reasonSelect
    
    document.getElementById('editDeliveryComment').value = comment || '';
    document.getElementById('editDeliveryModal').style.display = 'block';
}

// Función auxiliar para cargar técnicos en un select
async function fetchTechniciansForSelect(selectId, selectedId) {
    try {
        const response = await fetch(`${API_URL}/technicians`);
        const technicians = await response.json();
        
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        
        technicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech.id;
            option.textContent = tech.name;
            if (tech.id == selectedId) option.selected = true;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando técnicos:', error);
    }
}

// Función auxiliar para cargar productos en un select
async function fetchProductsForSelect(selectId, selectedId) {
    try {
        const response = await fetch(`${API_URL}/products`);
        const products = await response.json();
        
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        
        products.forEach(prod => {
            const option = document.createElement('option');
            option.value = prod.id;
            option.textContent = `${prod.name} (Stock: ${prod.stock})`;
            if (prod.id == selectedId) option.selected = true;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando productos:', error);
    }
}

// Reemplazar la función deleteDelivery para usar la API en lugar de SQLite directo
async function deleteDelivery(deliveryId, productId, quantity) {
    try {
        const response = await fetch(`${API_URL}/deliveries/${deliveryId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Error al eliminar la entrega');
        }
        
        showAlert('Entrega eliminada exitosamente', 'success');
        loadDeliveries();
        loadDeliveryOptions();
        loadDashboard();
    } catch (error) {
        console.error('Error al eliminar entrega:', error);
        showAlert(error.message, 'danger');
    }
}

// Mantener las funciones de UI sin cambios (openEditProductModal, confirmDeleteTechnician, etc.)
