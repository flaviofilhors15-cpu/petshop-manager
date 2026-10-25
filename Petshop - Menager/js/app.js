const STORAGE_KEYS = {
    CLIENTS: 'ps_clients',
    PETS: 'ps_pets',
    PRODUCTS: 'ps_products',
    APPOINTMENTS: 'ps_appointments',
    PACKAGES: 'ps_packages',
    SALES: 'ps_sales',
    REVENUES: 'ps_revenues',
    EXPENSES: 'ps_expenses',
    EMPLOYEES: 'ps_employees',
    SETTINGS: 'ps_settings',
    STOCK_MOVEMENTS: 'ps_stock_movements',
    PURCHASE_ORDERS: 'ps_purchase_orders',
    SUPPLIERS: 'ps_suppliers',
    AUDIT_LOGS: 'ps_audit_logs'
};

// === Utilitários Criptográficos Nativos (Web Crypto API & Defesa em Profundidade) ===
const CryptoUtils = {
    async sha256(str) {
        const buffer = new TextEncoder().encode(str);
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    },
    generateSalt(length = 16) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    },
    async hashPassword(password, salt) {
        let hash = password + ':' + salt;
        for (let i = 0; i < 3000; i++) {
            hash = await this.sha256(hash + salt);
        }
        return hash;
    },
    async encryptData(plaintext, password) {
        const enc = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            enc.encode(plaintext)
        );

        return JSON.stringify({
            formato: 'PS_ENCRYPTED_BACKUP_V1',
            salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
            iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
            data: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
        });
    },
    async decryptData(ciphertextJson, password) {
        const enc = new TextEncoder();
        const obj = typeof ciphertextJson === 'string' ? JSON.parse(ciphertextJson) : ciphertextJson;
        if (!obj.salt || !obj.iv || !obj.data) {
            throw new Error('Arquivo de backup criptografado inválido ou corrompido.');
        }

        const salt = new Uint8Array(obj.salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const iv = new Uint8Array(obj.iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const encrypted = new Uint8Array(obj.data.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encrypted
        );

        return new TextDecoder().decode(decrypted);
    },
    maskCpf(cpf) {
        if (!cpf) return '-';
        const cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `***.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-**`;
        }
        return '***.***.***-**';
    },
    maskPhone(phone) {
        if (!phone) return '-';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length >= 10) {
            return `(${cleaned.slice(0, 2)}) *****-${cleaned.slice(-4)}`;
        }
        return phone;
    }
};
window.CryptoUtils = CryptoUtils;

// === Trilha de Auditoria e Logs de Segurança (Audit Trail) ===
function logAudit(action, category, details) {
    try {
        const logs = DB.get(STORAGE_KEYS.AUDIT_LOGS) || [];
        const role = getCurrentUserRole();
        const newEntry = {
            id: 'log_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            timestamp: new Date().toISOString(),
            action,
            category: category || 'Geral',
            details: details || '',
            userRole: role,
            tenantId: getActiveTenantId()
        };
        logs.unshift(newEntry);
        // Manter até 200 eventos mais recentes
        if (logs.length > 200) logs.pop();
        DB.save(STORAGE_KEYS.AUDIT_LOGS, logs);
    } catch (e) {
        console.warn('Falha ao registrar log de auditoria:', e);
    }
}
window.logAudit = logAudit;

function getActiveTenantId() {
    return localStorage.getItem('ps_current_tenant_id') || 'default';
}

function getTenantStorageKey(key) {
    const tenantId = getActiveTenantId();
    if (key === 'ps_tenants' || key === 'ps_current_tenant_id' || key === 'ps_auto_snapshots') {
        return key;
    }
    return `${key}_${tenantId}`;
}

// === Banco de Dados (LocalStorage Multi-Tenant) ===
const DB = {
    get(key) {
        try {
            const tenantKey = getTenantStorageKey(key);
            let data = localStorage.getItem(tenantKey);

            // Migração transparente de dados legados para o tenant padrão
            if (!data && getActiveTenantId() === 'default') {
                const legacyData = localStorage.getItem(key);
                if (legacyData) {
                    localStorage.setItem(tenantKey, legacyData);
                    data = legacyData;
                }
            }

            return data ? JSON.parse(data) : (key === STORAGE_KEYS.SETTINGS ? {} : []);
        } catch {
            return key === STORAGE_KEYS.SETTINGS ? {} : [];
        }
    },
    save(key, data) {
        const tenantKey = getTenantStorageKey(key);
        localStorage.setItem(tenantKey, JSON.stringify(data));
    },
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
};

// === Gerenciamento de Papéis e Permissões (RBAC) ===
const ROLES = {
    ADMIN: { id: 'admin', nome: 'Dono / Administrador', paginasPermitidas: ['dashboard', 'agenda', 'clientes', 'vendas', 'estoque', 'financeiro', 'funcionarios', 'relatorios', 'configuracoes'] },
    GERENTE: { id: 'gerente', nome: 'Gerente da Loja', paginasPermitidas: ['dashboard', 'agenda', 'clientes', 'vendas', 'estoque', 'financeiro', 'funcionarios', 'relatorios'] },
    ATENDENTE: { id: 'atendente', nome: 'Atendente / Caixa', paginasPermitidas: ['dashboard', 'agenda', 'clientes', 'vendas'] },
    TOSADOR: { id: 'tosador', nome: 'Tosador / Banhista', paginasPermitidas: ['dashboard', 'agenda'] }
};
window.ROLES = ROLES;

function getCurrentUserRole() {
    return localStorage.getItem('ps_current_user_role') || 'admin';
}
window.getCurrentUserRole = getCurrentUserRole;

function setCurrentUserRole(roleId) {
    if (Object.values(ROLES).some(r => r.id === roleId)) {
        localStorage.setItem('ps_current_user_role', roleId);
        logAudit('ROLE_CHANGE', 'Segurança', `Papel ativo alterado para: ${roleId}`);
        window.location.reload();
    }
}
window.setCurrentUserRole = setCurrentUserRole;

function validarAutorizacaoPagina(page) {
    if (!page || page === 'login') return true;
    const roleId = getCurrentUserRole();
    const roleConfig = Object.values(ROLES).find(r => r.id === roleId) || ROLES.ADMIN;

    if (!roleConfig.paginasPermitidas.includes(page)) {
        console.warn(`[RBAC] Acesso não autorizado para o perfil "${roleId}" na página "${page}". Redirecionando...`);
        const destino = roleConfig.paginasPermitidas[0] === 'dashboard' ? 'index.html' : `${roleConfig.paginasPermitidas[0]}.html`;
        window.location.href = destino;
        return false;
    }
    return true;
}
window.validarAutorizacaoPagina = validarAutorizacaoPagina;

// === Gerenciamento de Sessão de Pet Shops ===
function verificarSessao() {
    const page = getCurrentPage();
    if (page === 'login' || page === 'admin') return true;

    const activeTenantId = localStorage.getItem('ps_current_tenant_id');
    if (!activeTenantId) {
        let tenants = [];
        try {
            tenants = JSON.parse(localStorage.getItem('ps_tenants') || '[]');
        } catch {
            tenants = [];
        }

        // Se ainda não houver nenhum tenant criado no navegador, cria o demo inicial com hash
        if (tenants.length === 0) {
            const defaultTenant = {
                id: 'default',
                nomePetShop: 'PetShop Manager Demo',
                responsavel: 'Administrador Demo',
                email: 'demo@petshop.com',
                telefone: '(11) 3333-4444',
                passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
                salt: 'e9b21f008892ca3b',
                dataCriacao: new Date().toISOString()
            };
            localStorage.setItem('ps_tenants', JSON.stringify([defaultTenant]));
            localStorage.setItem('ps_current_tenant_id', 'default');
            localStorage.setItem('ps_current_tenant_name', defaultTenant.nomePetShop);
        } else {
            window.location.href = 'login.html';
            return false;
        }
    }

    // Verificar autorização baseada em papéis (RBAC)
    return validarAutorizacaoPagina(page);
}
window.verificarSessao = verificarSessao;

function fazerLogout() {
    logAudit('LOGOUT', 'Sessão', 'Usuário realizou logout da loja.');
    localStorage.removeItem('ps_current_tenant_id');
    localStorage.removeItem('ps_current_tenant_name');
    window.location.href = 'login.html';
}
window.fazerLogout = fazerLogout;

// === Anonimização e Conformidade LGPD (Art. 18 da Lei 13.709/2018) ===
async function anonimizarClienteLGPD(clienteId) {
    const clientes = DB.get(STORAGE_KEYS.CLIENTS);
    const index = clientes.findIndex(c => c.id === clienteId);
    if (index === -1) {
        showToast('Cliente não encontrado.', 'error');
        return false;
    }

    const cliente = clientes[index];
    const nomeOriginal = cliente.nome;

    const confirmado = await confirmDialog(
        `[LGPD - Art. 18] Tem certeza que deseja anonimizar os dados de "${nomeOriginal}"?\n\n` +
        `Esta ação removerá permanentemente CPF, telefone, e-mail e endereço deste tutor.\n` +
        `O histórico de atendimentos e compras será preservado de forma despersonalizada para cumprimento de obrigações contábeis e fiscais (Art. 16 da LGPD).`
    );

    if (!confirmado) return false;

    // Anonimizar mantendo integridade referencial fiscal
    clientes[index] = {
        ...cliente,
        nome: `Tutor Anonimizado #${cliente.id.slice(-4).toUpperCase()}`,
        cpf: '',
        telefone: '',
        email: '',
        endereco: '',
        observacoes: `[LGPD] Dados pessoais excluídos a pedido do titular em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}.`,
        anonimizadoEm: new Date().toISOString()
    };

    DB.save(STORAGE_KEYS.CLIENTS, clientes);
    logAudit('LGPD_ANONYMIZATION', 'Privacidade', `Anonimização executada para o tutor ID ${clienteId} (${nomeOriginal}).`);
    showToast(`Dados de ${nomeOriginal} foram devidamente anonimizados conforme a LGPD.`, 'success');
    return true;
}
window.anonimizarClienteLGPD = anonimizarClienteLGPD;

// === Formatação ===
function formatCurrency(value) {
    if (value == null || isNaN(value)) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('pt-BR');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function parseDate(ddmmaaaa) {
    if (!ddmmaaaa) return null;
    const parts = ddmmaaaa.split('/');
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

function formatPhone(phone) {
    if (!phone) return '';
    const nums = phone.replace(/\D/g, '');
    if (nums.length === 11) return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
    if (nums.length === 10) return `(${nums.slice(0,2)}) ${nums.slice(2,6)}-${nums.slice(6)}`;
    return phone;
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

// === Sistema de WhatsApp para Agendamentos ===
function gerarMensagemWhatsApp(appointment, templateTipo) {
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    
    const client = clients.find(c => c.id === appointment.clienteId) || { nome: 'Tutor(a)', telefone: '' };
    const pet = pets.find(p => p.id === appointment.petId) || { nome: 'seu Pet' };
    const petShopNome = settings.nomeFantasia || 'PetShop Manager';
    const servico = appointment.servico || 'Banho e Tosa';
    const valor = formatCurrency(appointment.valor);
    const endereco = settings.endereco || 'nosso endereço';
    const horario = appointment.horario || 'no horário combinado';

    // Determinar texto sobre pagamento
    let textoPagamento = '';
    const statusPag = appointment.statusPagamento || 'pendente';
    if (statusPag.startsWith('pago')) {
        let forma = 'antecipadamente';
        if (statusPag.includes('pix')) forma = 'via Pix';
        else if (statusPag.includes('cartao')) forma = 'no Cartão';
        else if (statusPag.includes('dinheiro')) forma = 'em Dinheiro';
        textoPagamento = `💳 *Pagamento:* Já recebido (${forma}) ✅ Muito obrigado!`;
    } else {
        textoPagamento = `💰 *Valor:* ${valor} _(Pagamento no momento da retirada/entrega)_`;
    }

    if (templateTipo === 'pronto_buscar') {
        return `🐾 *${petShopNome} informa:* Olá, ${client.nome}! Tudo bem? ✨\n\nPassando para avisar que o(a) lindo(a) *${pet.nome}* já terminou o serviço de *${servico}*! 🐶🚿🧼\n\nEle(a) ficou muito cheiroso(a), super calmo(a) e está prontinho(a) esperando você vir buscá-lo(a)! 💕\n\n📍 *Local:* ${endereco}\n${textoPagamento}\n\nQualquer dúvida, estamos à disposição! Até já! 🐾✨`;
    }

    if (templateTipo === 'indo_entregar') {
        return `🚗 *${petShopNome} (Leva & Traz):* Olá, ${client.nome}! Tudo bem? ✨\n\nO(a) fofura do(a) *${pet.nome}* terminou o serviço de *${servico}* com sucesso! Ficou muito cheiroso(a) e feliz! 🐶💖\n\nEstamos nos organizando para levá-lo(a) com todo o carinho e conforto até a sua casa! 🏡🚗💨\n\nPor favor, confirme se haverá alguém no local para recebê-lo(a).\n${textoPagamento}\n\nAté breve! 🐾✨`;
    }

    if (templateTipo === 'lembrete_hoje') {
        return `⏰ *${petShopNome} - Lembrete:* Olá, ${client.nome}! 🐾\n\nLembramos que hoje temos um agendamento especial para o(a) *${pet.nome}*:\n\n✨ *Serviço:* ${servico}\n⏰ *Horário:* às ${horario}\n${textoPagamento}\n\nEstamos prontos para recebê-lo(a) com muito amor e carinho! Se precisar de algo, é só nos avisar. Até logo! 🐶🛁`;
    }

    return `Olá, ${client.nome}! Passando para falar sobre o agendamento de ${servico} do(a) ${pet.nome} no ${petShopNome}! 🐾`;
}

function abrirModalWhatsApp(appointmentId, tipoPadrao = null) {
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const appt = appointments.find(a => a.id === appointmentId);
    if (!appt) {
        showToast('Agendamento não encontrado.', 'error');
        return;
    }

    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const client = clients.find(c => c.id === appt.clienteId);
    const pet = pets.find(p => p.id === appt.petId);

    const destNome = document.getElementById('wpp-destinatario-nome');
    const destTel = document.getElementById('wpp-destinatario-tel');
    const inputApptId = document.getElementById('wpp-appointment-id');
    const selectTemplate = document.getElementById('wpp-template-select');

    if (destNome) destNome.textContent = `${client ? client.nome : 'Cliente'} (Pet: ${pet ? pet.nome : 'Pet'})`;
    if (destTel) destTel.textContent = client && client.telefone ? formatPhone(client.telefone) : 'Telefone não cadastrado';
    if (inputApptId) inputApptId.value = appointmentId;

    // Se não especificado tipo, escolhe baseado no tipoEntrega do agendamento
    if (!tipoPadrao) {
        if (appt.tipoEntrega === 'entregar') {
            tipoPadrao = 'indo_entregar';
        } else {
            tipoPadrao = 'pronto_buscar';
        }
    }

    if (selectTemplate) selectTemplate.value = tipoPadrao;
    atualizarTextoWhatsApp();
    openModal('modal-whatsapp');
}

function atualizarTextoWhatsApp() {
    const inputApptId = document.getElementById('wpp-appointment-id');
    const selectTemplate = document.getElementById('wpp-template-select');
    const textarea = document.getElementById('wpp-mensagem-texto');
    if (!inputApptId || !selectTemplate || !textarea) return;

    const appointmentId = inputApptId.value;
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const appt = appointments.find(a => a.id === appointmentId);
    if (!appt) return;

    const template = selectTemplate.value;
    if (template !== 'personalizado') {
        textarea.value = gerarMensagemWhatsApp(appt, template);
    }
}

function dispararWhatsApp() {
    const inputApptId = document.getElementById('wpp-appointment-id');
    const textarea = document.getElementById('wpp-mensagem-texto');
    if (!inputApptId || !textarea) return;

    const appointmentId = inputApptId.value;
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const appt = appointments.find(a => a.id === appointmentId);
    if (!appt) return;

    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const client = clients.find(c => c.id === appt.clienteId);

    if (!client || !client.telefone) {
        showToast('O cliente não possui telefone cadastrado.', 'warning');
        return;
    }

    // Limpar telefone deixando apenas números
    let cleanPhone = client.telefone.replace(/\D/g, '');
    if (!cleanPhone) {
        showToast('Telefone inválido para envio.', 'warning');
        return;
    }

    // Se não tiver DDI (55), adiciona
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
        cleanPhone = '55' + cleanPhone;
    }

    const mensagemCodificada = encodeURIComponent(textarea.value);
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${mensagemCodificada}`;

    window.open(url, '_blank');
    closeModal('modal-whatsapp');
    showToast('WhatsApp aberto em nova aba!', 'success');
}

// === Emissão e Impressão de Ficha de Baia / Gaiola ===
function abrirFichaBaia(appointmentId) {
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const appt = appointments.find(a => a.id === appointmentId);
    if (!appt) {
        showToast('Agendamento não encontrado.', 'error');
        return;
    }

    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};

    const client = clients.find(c => c.id === appt.clienteId) || { nome: 'Cliente Não Informado', telefone: '' };
    const pet = pets.find(p => p.id === appt.petId) || { nome: 'Pet', especie: 'Cão', raca: '', porte: 'M' };
    const employee = employees.find(e => e.id === appt.funcionarioId) || { nome: 'Equipe de Banho' };
    const petshopNome = settings.nomeFantasia || 'PetShop Manager';
    const petshopTel = settings.telefone || '';

    let modal = document.getElementById('modal-ficha-baia');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-ficha-baia';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    const statusPag = appt.statusPagamento || 'pendente';
    let pagTexto = `⏳ COBRAR: ${formatCurrency(appt.valor)}`;
    let pagBadge = 'background:#fef3c7; color:#b45309; border:1px solid #fde68a;';
    if (statusPag.startsWith('pago')) {
        let forma = 'Pix / Cartão';
        if (statusPag.includes('pix')) forma = 'Pix';
        else if (statusPag.includes('cartao')) forma = 'Cartão';
        else if (statusPag.includes('dinheiro')) forma = 'Dinheiro';
        pagTexto = `✅ JÁ PAGO (${forma})`;
        pagBadge = 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;';
    }

    const temAlerta = (pet.alergias && pet.alergias !== 'Nenhuma') || appt.observacoes;

    modal.innerHTML = `
        <div class="modal modal-md">
            <div class="modal-header">
                <h2><i data-lucide="printer" style="width:20px;height:20px;vertical-align:middle;margin-right:6px;color:var(--primary);"></i> Ficha de Baia / Gaiola</h2>
                <button class="btn-icon modal-close" onclick="closeModal('modal-ficha-baia')">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body" style="padding: 1rem 1.5rem;">
                <div id="printable-ficha-area">
                    <div class="ficha-baia-card">
                        <div class="ficha-baia-header">
                            <div>
                                <span style="font-weight:800; font-size:1.05rem; color:#1E3A5F; text-transform:uppercase;">🐾 ${escapeHtml(petshopNome)}</span>
                                <div style="font-size:0.75rem; color:#64748b;">Ficha Operacional de Banho & Tosa ${petshopTel ? '• ' + petshopTel : ''}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:0.7rem; font-weight:700; color:#64748b; text-transform:uppercase;">Horário</div>
                                <div style="font-size:1.2rem; font-weight:900; color:#1E3A5F;">${appt.horario || '--:--'}</div>
                            </div>
                        </div>

                        <div class="ficha-baia-pet-highlight">
                            <div class="ficha-baia-pet-name">🐾 ${escapeHtml(pet.nome)}</div>
                            <div style="font-size:0.95rem; font-weight:600; color:#334155; margin-top:3px;">
                                ${escapeHtml(pet.especie || 'Pet')} • ${escapeHtml(pet.raca || 'SRD')} • Porte ${escapeHtml(pet.porte || 'M')} ${pet.peso ? '• ' + pet.peso + 'kg' : ''}
                            </div>
                        </div>

                        ${temAlerta ? `
                            <div class="ficha-baia-alert-box">
                                ⚠️ <strong>CUIDADOS & OBSERVAÇÕES:</strong><br>
                                ${pet.alergias && pet.alergias !== 'Nenhuma' ? `• Alergias: ${escapeHtml(pet.alergias)}<br>` : ''}
                                ${appt.observacoes ? `• Obs: ${escapeHtml(appt.observacoes)}` : ''}
                            </div>
                        ` : ''}

                        <div class="ficha-baia-grid">
                            <div class="ficha-baia-grid-item">
                                <div class="label">Serviço Contratado</div>
                                <div class="val" style="color:var(--primary);">${escapeHtml(appt.servico || 'Banho')}</div>
                            </div>
                            <div class="ficha-baia-grid-item">
                                <div class="label">Profissional</div>
                                <div class="val">${escapeHtml(employee.nome || 'Equipe')}</div>
                            </div>
                            <div class="ficha-baia-grid-item">
                                <div class="label">Tutor / Contato</div>
                                <div class="val">${escapeHtml(client.nome)}</div>
                                <div style="font-size:0.75rem; color:#64748b;">${formatPhone(client.telefone)}</div>
                            </div>
                            <div class="ficha-baia-grid-item">
                                <div class="label">Saída / Retirada</div>
                                <div class="val">${appt.tipoEntrega === 'entregar' ? '🚗 Leva & Traz' : '🐾 Tutor Busca'}</div>
                                ${appt.tipoEntrega === 'entregar' && client.endereco ? `<div style="font-size:0.72rem; color:#64748b;">${escapeHtml(client.endereco)}</div>` : ''}
                            </div>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.85rem; border-radius:6px; margin-bottom:1rem; ${pagBadge}">
                            <span style="font-size:0.8rem; font-weight:700;">STATUS DO PAGAMENTO:</span>
                            <span style="font-size:0.95rem; font-weight:900;">${pagTexto}</span>
                        </div>

                        <div class="ficha-baia-footer">
                            <div>Data: <strong>${formatDate(appt.data)}</strong></div>
                            <div class="ficha-baia-signature">
                                Visto do Tosador/Banhista
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display:flex; justify-content:space-between;">
                <button type="button" class="btn btn-secondary" onclick="closeModal('modal-ficha-baia')">Fechar</button>
                <button type="button" class="btn btn-primary" onclick="window.print()">
                    <i data-lucide="printer"></i> Imprimir Ficha de Baia
                </button>
            </div>
        </div>
    `;

    openModal('modal-ficha-baia');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
window.abrirFichaBaia = abrirFichaBaia;

// === Sistema de Pacotes Mensais de Banho & Tosa ===
function getPetActivePackage(petId) {
    if (!petId) return null;
    const packages = DB.get(STORAGE_KEYS.PACKAGES) || [];
    // Retorna pacote ativo com saldo restante
    return packages.find(pkg => pkg.petId === petId && pkg.status === 'ativo' && (pkg.sessoesRestantes > 0));
}

function debitarSessaoPacote(petId, appointmentId = null) {
    const packages = DB.get(STORAGE_KEYS.PACKAGES) || [];
    const index = packages.findIndex(pkg => pkg.petId === petId && pkg.status === 'ativo' && pkg.sessoesRestantes > 0);
    if (index === -1) return false;

    packages[index].sessoesRestantes -= 1;
    if (!packages[index].historicoUso) packages[index].historicoUso = [];
    packages[index].historicoUso.push({
        data: new Date().toISOString(),
        appointmentId: appointmentId
    });

    if (packages[index].sessoesRestantes === 0) {
        packages[index].status = 'concluido';
    }

    DB.save(STORAGE_KEYS.PACKAGES, packages);
    return packages[index];
}

function creditarSessaoPacote(petId, appointmentId = null) {
    const packages = DB.get(STORAGE_KEYS.PACKAGES) || [];
    const index = packages.findIndex(pkg => pkg.petId === petId && pkg.historicoUso && pkg.historicoUso.some(h => h.appointmentId === appointmentId));
    if (index === -1) return false;

    packages[index].sessoesRestantes += 1;
    packages[index].status = 'ativo';
    packages[index].historicoUso = packages[index].historicoUso.filter(h => h.appointmentId !== appointmentId);

    DB.save(STORAGE_KEYS.PACKAGES, packages);
    return true;
}

// === Paginação ===
function paginate(array, page = 1, perPage = 10) {
    const totalPages = Math.ceil(array.length / perPage) || 1;
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * perPage;
    return {
        data: array.slice(start, start + perPage),
        totalPages,
        currentPage,
        total: array.length
    };
}

function renderPagination(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '<div class="pagination">';
    html += `<button class="page-btn" onclick="${onPageChange}(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>&laquo;</button>`;
    
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    
    if (start > 1) html += `<button class="page-btn" onclick="${onPageChange}(1)">1</button>`;
    if (start > 2) html += '<span style="padding:0 0.3rem">...</span>';
    
    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
    }
    
    if (end < totalPages - 1) html += '<span style="padding:0 0.3rem">...</span>';
    if (end < totalPages) html += `<button class="page-btn" onclick="${onPageChange}(${totalPages})">${totalPages}</button>`;
    
    html += `<button class="page-btn" onclick="${onPageChange}(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>&raquo;</button>`;
    html += '</div>';
    container.innerHTML = html;
}

// === Modal System ===
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => lucide.createIcons(), 50);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(m => {
        m.classList.remove('active');
    });
    document.body.style.overflow = '';
}

// Fechar modal ao clicar no overlay
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
});

// === Toast Notifications ===
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
    toast.innerHTML = `
        <i data-lucide="${icons[type] || 'info'}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i data-lucide="x"></i>
        </button>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// === Confirm Dialog ===
function confirmDialog(message) {
    return new Promise((resolve) => {
        // Remover dialog existente
        const existing = document.getElementById('confirm-dialog-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'confirm-dialog-overlay';
        overlay.className = 'confirm-overlay active';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <div class="confirm-icon">
                    <i data-lucide="alert-triangle"></i>
                </div>
                <p>${message}</p>
                <div class="confirm-actions">
                    <button class="btn btn-secondary" id="confirm-cancel">Cancelar</button>
                    <button class="btn btn-danger" id="confirm-ok">Confirmar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        lucide.createIcons();

        document.getElementById('confirm-ok').onclick = () => {
            overlay.remove();
            resolve(true);
        };
        document.getElementById('confirm-cancel').onclick = () => {
            overlay.remove();
            resolve(false);
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
    });
}

// === Sidebar e Header ===
function getCurrentPage() {
    return document.body.getAttribute('data-page') || 'dashboard';
}

function getPageTitle(page) {
    const titles = {
        dashboard: 'Dashboard',
        agenda: 'Agenda',
        clientes: 'Clientes e Pets',
        vendas: 'Vendas (PDV)',
        estoque: 'Estoque',
        financeiro: 'Financeiro',
        funcionarios: 'Funcionários',
        relatorios: 'Relatórios',
        configuracoes: 'Configurações'
    };
    return titles[page] || 'PetShop Manager';
}

// === Suporte Comercial & Fale com o Desenvolvedor ===
function getDevContactInfo() {
    let dev = {
        nome: 'Flávio Filho • Desenvolvedor & Criador da Plataforma',
        whatsapp: '(34) 99983-6438',
        email: 'flaviofilhors15@gmail.com',
        horario: 'Segunda a Sexta, das 08h às 18h'
    };
    try {
        const saved = JSON.parse(localStorage.getItem('ps_dev_contact') || '{}');
        if (saved && (!saved.whatsapp || saved.whatsapp.includes('99999-9999') || !saved.email || saved.email.includes('comercial@petshopmanager'))) {
            localStorage.setItem('ps_dev_contact', JSON.stringify(dev));
            return dev;
        }
        dev = { ...dev, ...saved };
    } catch {}
    return dev;
}

function salvarDevContactInfo(nome, whatsapp, email) {
    const dev = { nome, whatsapp, email, horario: 'Segunda a Sexta, das 08h às 18h' };
    localStorage.setItem('ps_dev_contact', JSON.stringify(dev));
    showToast('Contatos do desenvolvedor atualizados com sucesso!', 'success');
}
window.salvarDevContactInfo = salvarDevContactInfo;

function abrirModalSuporteDesenvolvedor() {
    const dev = getDevContactInfo();
    const rawNumber = dev.whatsapp.replace(/\D/g, '');
    const whatsLink = `https://api.whatsapp.com/send?phone=55${rawNumber}&text=Ol%C3%A1%2C%20gostaria%20de%20falar%20com%20o%20desenvolvedor%20do%20PetShop%20Manager%20sobre%20planos%20e%20suporte!`;

    let modal = document.getElementById('modal-suporte-desenvolvedor');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-suporte-desenvolvedor';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal modal-md">
            <div class="modal-header">
                <h2><i data-lucide="headset" style="width:20px;height:20px;vertical-align:middle;margin-right:6px;color:#2563eb;"></i> Fale com o Desenvolvedor / Suporte</h2>
                <button class="btn-icon modal-close" onclick="closeModal('modal-suporte-desenvolvedor')">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body" style="padding:1.5rem;">
                <div style="text-align:center; margin-bottom:1.25rem;">
                    <div style="width:54px; height:54px; border-radius:50%; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; margin:0 auto 0.75rem; font-size:1.5rem;">
                        👑
                    </div>
                    <h3 style="font-size:1.15rem; color:#1e293b; margin-bottom:0.25rem;">${escapeHtml(dev.nome)}</h3>
                    <p style="font-size:0.85rem; color:#64748b;">Suporte técnico oficial, dúvidas comerciais, contratação de planos e personalizações para o seu Pet Shop.</p>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1.5rem;">
                    <a href="${whatsLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="justify-content:center; background:#16a34a; border-color:#16a34a; padding:0.75rem; text-decoration:none;">
                        <i data-lucide="message-circle"></i> Conversar pelo WhatsApp: ${escapeHtml(dev.whatsapp)}
                    </a>
                    <a href="mailto:${escapeHtml(dev.email)}" class="btn btn-secondary" style="justify-content:center; padding:0.75rem; text-decoration:none;">
                        <i data-lucide="mail"></i> Enviar E-mail: ${escapeHtml(dev.email)}
                    </a>
                </div>

                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem; font-size:0.8rem; color:#475569; display:flex; align-items:center; gap:0.5rem;">
                    <i data-lucide="clock" style="width:16px;height:16px;flex-shrink:0;color:#3b82f6;"></i>
                    <span>Horário de Atendimento Comercial: <strong>${escapeHtml(dev.horario)}</strong></span>
                </div>
            </div>
            <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
                <button type="button" class="btn btn-sm btn-secondary" style="font-size:0.75rem;" onclick="configurarContatosDev()">
                    <i data-lucide="settings"></i> Personalizar Meus Contatos
                </button>
                <button type="button" class="btn btn-secondary" onclick="closeModal('modal-suporte-desenvolvedor')">Fechar</button>
            </div>
        </div>
    `;

    openModal('modal-suporte-desenvolvedor');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
window.abrirModalSuporteDesenvolvedor = abrirModalSuporteDesenvolvedor;

function configurarContatosDev() {
    const dev = getDevContactInfo();
    const novoNome = prompt('Seu Nome ou Nome da sua Empresa Desenvolvedora:', dev.nome);
    if (!novoNome) return;
    const novoWhats = prompt('Seu WhatsApp de Atendimento Comercial (com DDD):', dev.whatsapp);
    if (!novoWhats) return;
    const novoEmail = prompt('Seu E-mail Comercial / Suporte:', dev.email);
    if (!novoEmail) return;

    salvarDevContactInfo(novoNome, novoWhats, novoEmail);
    abrirModalSuporteDesenvolvedor();
}
window.configurarContatosDev = configurarContatosDev;

// === Painel SuperAdmin / Dono da Plataforma (Área Secreta & Protegida) ===
function abrirPainelSuperAdmin(pularSenha = false) {
    if (!pularSenha) {
        let masterKeyCadastrada = localStorage.getItem('ps_master_key') || 'Ma15072019$';
        const senhaDigitada = prompt('🔒 Acesso Restrito do Dono da Plataforma (Flávio Filho)\n\nDigite a Chave Mestra / Senha do SuperAdmin:');
        if (!senhaDigitada) return;
        if (senhaDigitada !== masterKeyCadastrada) {
            showToast('Chave mestra incorreta.', 'error');
            return;
        }
    }

    // Redireciona diretamente para a tela preta executiva do Super Admin
    window.location.href = 'admin.html';
}
window.abrirPainelSuperAdmin = abrirPainelSuperAdmin;
window.abrirPainelSuperAdmin = abrirPainelSuperAdmin;

function fecharPainelSuperAdmin() {
    closeModal('modal-superadmin');
    if (getCurrentPage() === 'login' && localStorage.getItem('ps_current_tenant_id')) {
        window.location.href = 'index.html';
    }
}
window.fecharPainelSuperAdmin = fecharPainelSuperAdmin;

function alterarChaveMestraDono() {
    const atual = localStorage.getItem('ps_master_key') || 'Ma15072019$';
    const confAtual = prompt('Para segurança, digite a Chave Mestra ATUAL:');
    if (!confAtual) return;
    if (confAtual !== atual) {
        showToast('Chave mestra atual incorreta.', 'error');
        return;
    }
    const nova = prompt('Digite a NOVA Chave Mestra secreta:');
    if (!nova || nova.trim().length < 4) {
        showToast('A nova chave deve ter pelo menos 4 caracteres.', 'warning');
        return;
    }
    const confirmaNova = prompt('Confirme a NOVA Chave Mestra:');
    if (nova !== confirmaNova) {
        showToast('As chaves digitadas não coincidem.', 'error');
        return;
    }
    localStorage.setItem('ps_master_key', nova.trim());
    showToast('Chave Mestra atualizada com sucesso!', 'success');
}
window.alterarChaveMestraDono = alterarChaveMestraDono;

// === Ativação Secreta do Painel do Dono (Totalmente Invisível para Clientes) ===
let _contadorCliquesLogo = 0;
let _timerResetCliquesLogo = null;

function registrarCliqueSecretoLogo() {
    _contadorCliquesLogo++;
    if (_timerResetCliquesLogo) clearTimeout(_timerResetCliquesLogo);

    // Se o dono clicar 5 vezes rapidamente no ícone da pata 🐾
    if (_contadorCliquesLogo >= 5) {
        _contadorCliquesLogo = 0;
        abrirPainelSuperAdmin();
        return;
    }

    _timerResetCliquesLogo = setTimeout(() => {
        _contadorCliquesLogo = 0;
    }, 2500);
}
window.registrarCliqueSecretoLogo = registrarCliqueSecretoLogo;

// Atalho Secreto no Teclado: Ctrl + Shift + M ou Ctrl + Alt + D
document.addEventListener('keydown', (e) => {
    const isCtrlShiftM = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'M' || e.key === 'm');
    const isCtrlAltD = (e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'D' || e.key === 'd');

    if (isCtrlShiftM || isCtrlAltD) {
        e.preventDefault();
        abrirPainelSuperAdmin();
    }
});

function acessarTenantComoDono(tenantId) {
    let tenants = [];
    try {
        tenants = JSON.parse(localStorage.getItem('ps_tenants') || '[]');
    } catch {}
    const t = tenants.find(x => x.id === tenantId);
    if (!t) return;

    localStorage.setItem('ps_current_tenant_id', t.id);
    localStorage.setItem('ps_current_tenant_name', t.nomePetShop);
    showToast(`Alternando para o painel de: ${t.nomePetShop}...`, 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 600);
}
window.acessarTenantComoDono = acessarTenantComoDono;

async function excluirTenantComoDono(tenantId, nomePetShop) {
    const ok = await confirmDialog(`Tem certeza que deseja excluir o Pet Shop "${nomePetShop}" da plataforma? Todos os dados isolados desta loja serão permanentemente apagados.`);
    if (!ok) return;

    let tenants = [];
    try {
        tenants = JSON.parse(localStorage.getItem('ps_tenants') || '[]');
    } catch {}

    const novos = tenants.filter(t => t.id !== tenantId);
    localStorage.setItem('ps_tenants', JSON.stringify(novos));

    // Limpar dados deste tenant
    Object.values(STORAGE_KEYS).forEach(k => {
        localStorage.removeItem(`ps_${k}_${tenantId}`);
    });

    logAudit('TENANT_DELETED', 'SuperAdmin', `Pet Shop "${nomePetShop}" excluído pelo Dono da Plataforma.`);
    showToast(`Pet Shop "${nomePetShop}" excluído com sucesso.`, 'success');

    if (getActiveTenantId() === tenantId) {
        localStorage.removeItem('ps_current_tenant_id');
        localStorage.removeItem('ps_current_tenant_name');
        window.location.href = 'login.html';
    } else {
        abrirPainelSuperAdmin();
    }
}
window.excluirTenantComoDono = excluirTenantComoDono;

function initSidebar() {
    const currentPage = getCurrentPage();
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const currentRole = getCurrentUserRole();
    const roleConfig = Object.values(ROLES).find(r => r.id === currentRole) || ROLES.ADMIN;

    const menuItems = [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard', href: 'index.html' },
        { id: 'agenda', icon: 'calendar', label: 'Agenda', href: 'agenda.html' },
        { id: 'clientes', icon: 'heart', label: 'Clientes e Pets', href: 'clientes.html' },
        { id: 'vendas', icon: 'shopping-cart', label: 'Vendas (PDV)', href: 'vendas.html' },
        { id: 'estoque', icon: 'package', label: 'Estoque', href: 'estoque.html' },
        { id: 'financeiro', icon: 'wallet', label: 'Financeiro', href: 'financeiro.html' },
        { id: 'funcionarios', icon: 'users', label: 'Funcionários', href: 'funcionarios.html' },
        { id: 'relatorios', icon: 'bar-chart-2', label: 'Relatórios', href: 'relatorios.html' },
        { id: 'configuracoes', icon: 'settings', label: 'Configurações', href: 'configuracoes.html' }
    ];

    // Filtrar apenas menus autorizados para o perfil ativo (RBAC)
    const allowedItems = menuItems.filter(item => roleConfig.paginasPermitidas.includes(item.id));

    const navHtml = allowedItems.map(item => `
        <a href="${item.href}" class="nav-item ${item.id === currentPage ? 'active' : ''}">
            <i data-lucide="${item.icon}"></i>
            <span>${item.label}</span>
        </a>
    `).join('');

    const tenantName = localStorage.getItem('ps_current_tenant_name') || 'PetShop Manager';

    sidebar.innerHTML = `
        <div class="sidebar-header">
            <span class="logo-icon" onclick="registrarCliqueSecretoLogo()" style="cursor:pointer;" title="PetShop Manager">🐾</span>
            <div>
                <h2 style="font-size:1.1rem; line-height:1.2;">${escapeHtml(tenantName)}</h2>
                <span class="logo-sub"><span class="badge badge-primary" style="font-size:0.68rem; padding:2px 6px;">${escapeHtml(roleConfig.nome)}</span></span>
            </div>
        </div>
        <nav class="sidebar-nav">${navHtml}</nav>
        <div class="sidebar-footer" style="display:flex; flex-direction:column; gap:0.45rem; padding: 1rem 1.25rem;">
            ${(localStorage.getItem('ps_is_platform_owner') === 'true' || localStorage.getItem('ps_saas_is_owner') === 'true') ? `
            <button class="btn btn-primary btn-sm" style="width:100%; justify-content:center; background:linear-gradient(135deg, #f59e0b, #d97706); border:none; font-weight:700; font-size:0.8rem; box-shadow:0 2px 8px rgba(245,158,11,0.3);" onclick="window.location.href='admin.html'" title="Acessar Central do Dono do SaaS">
                <i data-lucide="crown" style="width:14px;height:14px;"></i> Painel Super Admin
            </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" style="width:100%; justify-content:center; color:#f87171; border-color:rgba(255,255,255,0.15); background:rgba(255,255,255,0.05);" onclick="fazerLogout()" title="Sair do Pet Shop atual">
                <i data-lucide="log-out" style="width:14px;height:14px;"></i> Sair / Trocar Loja
            </button>
            <button class="btn btn-secondary btn-sm" style="width:100%; justify-content:center; color:#60a5fa; border-color:rgba(255,255,255,0.15); background:rgba(255,255,255,0.05); font-size:0.75rem;" onclick="abrirModalSuporteDesenvolvedor()" title="Fale com o Desenvolvedor / Suporte Comercial">
                <i data-lucide="headset" style="width:13px;height:13px;"></i> Suporte / Desenvolvedor
            </button>
            <div style="font-size:0.7rem; color:rgba(255,255,255,0.4); text-align:center; margin-top:0.25rem;">© 2026 PetShop Manager</div>
        </div>
    `;
}

function initHeader() {
    const header = document.getElementById('header');
    if (!header) return;

    const currentPage = getCurrentPage();
    const settings = DB.get(STORAGE_KEYS.SETTINGS);
    const nomeFantasia = settings.nomeFantasia || localStorage.getItem('ps_current_tenant_name') || 'PetShop Manager';
    const currentRole = getCurrentUserRole();

    header.innerHTML = `
        <div class="header-left">
            <h1 class="header-title">${getPageTitle(currentPage)}</h1>
        </div>
        <div class="header-right" style="position:relative;">
            <!-- 1. Botão de Ação Rápida no Topo (F2 / Criar) -->
            <button class="btn-quick-action" onclick="toggleQuickActionMenu()" title="Atalho rápido: Pressione F2">
                <i data-lucide="plus-circle" style="width:14px;height:14px;"></i>
                <span>+ Criar Rápido</span>
            </button>

            <!-- Dropdown de Ações Rápidas -->
            <div id="quick-action-dropdown" class="quick-action-dropdown">
                <button class="quick-action-item" onclick="window.location.href='agenda.html'">
                    <i data-lucide="calendar-plus"></i> Novo Agendamento
                </button>
                <button class="quick-action-item" onclick="window.location.href='vendas.html'">
                    <i data-lucide="shopping-cart"></i> Nova Venda (PDV)
                </button>
                <button class="quick-action-item" onclick="window.location.href='clientes.html'">
                    <i data-lucide="user-plus"></i> Novo Cliente / Pet
                </button>
                <button class="quick-action-item" onclick="window.location.href='financeiro.html?acao=nova-receita'">
                    <i data-lucide="trending-up"></i> Nova Receita
                </button>
                <button class="quick-action-item" onclick="window.location.href='financeiro.html'">
                    <i data-lucide="plus-circle"></i> Nova Despesa
                </button>
            </div>

            <div class="tenant-badge-header" title="Pet Shop em atendimento: ${escapeHtml(nomeFantasia)}" onclick="window.location.href='configuracoes.html'">
                <i data-lucide="store" style="width:14px;height:14px;"></i>
                <span>${escapeHtml(nomeFantasia)}</span>
            </div>

            <!-- Botão Alternador Modo Demonstração / Loja Real Zerada -->
            ${(localStorage.getItem('ps_data_state') === 'clean') ? `
            <button class="btn btn-sm" onclick="carregarDemonstracaoPositiva()" style="display:inline-flex; align-items:center; gap:5px; background:linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; border-radius:20px; padding:4px 12px; font-weight:700; font-size:0.75rem; box-shadow:0 2px 8px rgba(16,185,129,0.3); cursor:pointer;" title="Clique para ver uma demonstração completa de uma empresa positiva e com alto lucro">
                <i data-lucide="sparkles" style="width:13px; height:13px;"></i>
                <span>Ver Demonstração</span>
            </button>
            ` : `
            <button class="btn btn-sm" onclick="zerarPainelLojaReal()" style="display:inline-flex; align-items:center; gap:5px; background:#fff1f2; color:#be123c; border:1px solid #fecdd3; border-radius:20px; padding:4px 10px; font-weight:700; font-size:0.75rem; cursor:pointer;" title="Zerar todos os números para começar sua loja real do zero">
                <i data-lucide="rotate-ccw" style="width:13px; height:13px;"></i>
                <span>Zerar Painel</span>
            </button>
            `}
            ${localStorage.getItem('ps_is_platform_owner') === 'true' ? `
            <button class="btn btn-sm" style="display:inline-flex; align-items:center; gap:5px; background:linear-gradient(135deg, #f59e0b, #d97706); color:#fff; border:none; border-radius:20px; padding:4px 10px; font-weight:700; font-size:0.75rem; box-shadow:0 2px 8px rgba(245,158,11,0.3); cursor:pointer;" onclick="window.location.href='admin.html'" title="Retornar à Central do Dono da Plataforma (Super Admin)">
                <i data-lucide="crown" style="width:13px; height:13px;"></i>
                <span>Central do Dono</span>
            </button>
            ` : ''}
            <!-- Seletor Rápido de Perfil (RBAC) -->
            <div style="display:flex; align-items:center; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:20px; padding:2px 8px;" title="Perfil Operacional da Sessão (Controle de Acesso RBAC)">
                <i data-lucide="shield" style="width:13px; height:13px; color:#475569; margin-right:4px;"></i>
                <select onchange="setCurrentUserRole(this.value)" style="border:none; background:transparent; font-size:0.78rem; font-weight:600; color:#334155; cursor:pointer; outline:none;">
                    <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>👑 Dono (Admin)</option>
                    <option value="gerente" ${currentRole === 'gerente' ? 'selected' : ''}>👔 Gerente</option>
                    <option value="atendente" ${currentRole === 'atendente' ? 'selected' : ''}>💼 Atendente</option>
                    <option value="tosador" ${currentRole === 'tosador' ? 'selected' : ''}>✂️ Tosador</option>
                </select>
            </div>
            <button class="btn btn-sm btn-secondary" id="btn-pwa-install" style="display:none; gap:6px; background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;" onclick="instalarAplicativoPWA()">
                <i data-lucide="download"></i>
                <span>Instalar App</span>
            </button>
            <button class="header-icon" onclick="baixarBackupRapido()" title="Baixar Cópia de Segurança / Backup Seguro (.json ou .psbackup)">
                <i data-lucide="hard-drive-download"></i>
            </button>
            <div class="header-search" onclick="abrirSpotlightBusca()" style="cursor:pointer;" title="Busca Global Rápida (Pressione Ctrl + K)">
                <i data-lucide="search"></i>
                <input type="text" placeholder="Buscar pets, clientes... (Ctrl + K)" id="global-search" readonly style="cursor:pointer;">
            </div>
            <button class="header-icon" id="btn-notifications" title="Notificações">
                <i data-lucide="bell"></i>
                <span class="badge-dot" id="notification-dot" style="display:none"></span>
            </button>
            <button class="header-icon" onclick="fazerLogout()" title="Sair da conta do Pet Shop">
                <i data-lucide="log-out"></i>
            </button>
            <div class="header-avatar" title="${escapeHtml(nomeFantasia)}">${nomeFantasia.charAt(0).toUpperCase()}</div>
        </div>
    `;

    // Fechar dropdown de ações rápidas ao clicar fora
    document.addEventListener('click', (e) => {
        const drop = document.getElementById('quick-action-dropdown');
        if (drop && !e.target.closest('.btn-quick-action') && !e.target.closest('#quick-action-dropdown')) {
            drop.classList.remove('active');
        }
    });

    // Injetar Spotlight no body se não existir
    injetarSpotlightBusca();

    // Verificar alertas de estoque
    checkStockAlerts();
}

// === Download de Backup em 1 Clique (Segurança & Criptografia Opcional) ===
async function baixarBackupRapido() {
    const backupData = {
        meta: {
            app: 'PetShop Manager',
            versao: '1.2',
            dataExportacao: new Date().toISOString(),
            tenantId: getActiveTenantId(),
            tenantName: localStorage.getItem('ps_current_tenant_name') || 'PetShop'
        },
        dados: {
            clientes: DB.get(STORAGE_KEYS.CLIENTS),
            pets: DB.get(STORAGE_KEYS.PETS),
            produtos: DB.get(STORAGE_KEYS.PRODUCTS),
            agendamentos: DB.get(STORAGE_KEYS.APPOINTMENTS),
            vendas: DB.get(STORAGE_KEYS.SALES),
            receitas: DB.get(STORAGE_KEYS.REVENUES),
            despesas: DB.get(STORAGE_KEYS.EXPENSES),
            funcionarios: DB.get(STORAGE_KEYS.EMPLOYEES),
            configuracoes: DB.get(STORAGE_KEYS.SETTINGS),
            movimentacoesEstoque: DB.get(STORAGE_KEYS.STOCK_MOVEMENTS),
            pacotes: DB.get(STORAGE_KEYS.PACKAGES),
            auditLogs: DB.get(STORAGE_KEYS.AUDIT_LOGS)
        }
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];

    // Pergunta se deseja proteger com senha de criptografia AES-GCM (Conformidade LGPD)
    const senha = prompt('Deseja criptografar o backup com senha (AES-GCM - Recomendado pela LGPD)?\n\nDigite uma senha para proteger o arquivo ou deixe em branco para salvar em JSON normal:');

    if (senha && senha.trim().length > 0) {
        try {
            showToast('Criptografando arquivo de backup com AES-GCM 256 bits...', 'info');
            const encryptedPayload = await CryptoUtils.encryptData(jsonString, senha.trim());
            const blob = new Blob([encryptedPayload], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `backup_petshop_protegido_${dateStr}.psbackup`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            logAudit('BACKUP_EXPORT_ENCRYPTED', 'Segurança', 'Exportação de backup criptografado com senha.');
            showToast('Backup criptografado com sucesso! Guarde sua senha para poder restaurar.', 'success');
        } catch (err) {
            console.error(err);
            showToast('Falha na criptografia do backup.', 'error');
        }
    } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_petshop_${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        logAudit('BACKUP_EXPORT_PLAIN', 'Segurança', 'Exportação de backup aberto em formato JSON.');
        showToast('Cópia de segurança baixada com sucesso! Guarde este arquivo em segurança.', 'success');
    }
}

// === Persistência Blindada e Snapshots Diários ===
function initDataPersistenceAndSafety() {
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(granted => {
            if (granted) {
                console.log('Armazenamento do PetShop Manager protegido com persistência garantida.');
            }
        });
    }

    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const lastSnapshotDate = localStorage.getItem('ps_last_snapshot_date');

        if (lastSnapshotDate !== todayStr && DB.get(STORAGE_KEYS.CLIENTS).length > 0) {
            const snapshotData = {
                data: todayStr,
                timestamp: Date.now(),
                clientes: DB.get(STORAGE_KEYS.CLIENTS),
                pets: DB.get(STORAGE_KEYS.PETS),
                produtos: DB.get(STORAGE_KEYS.PRODUCTS),
                agendamentos: DB.get(STORAGE_KEYS.APPOINTMENTS),
                vendas: DB.get(STORAGE_KEYS.SALES),
                receitas: DB.get(STORAGE_KEYS.REVENUES),
                despesas: DB.get(STORAGE_KEYS.EXPENSES),
                pacotes: DB.get(STORAGE_KEYS.PACKAGES)
            };

            let snapshots = [];
            try {
                snapshots = JSON.parse(localStorage.getItem('ps_auto_snapshots') || '[]');
            } catch {
                snapshots = [];
            }

            snapshots.unshift(snapshotData);
            if (snapshots.length > 7) snapshots = snapshots.slice(0, 7);

            localStorage.setItem('ps_auto_snapshots', JSON.stringify(snapshots));
            localStorage.setItem('ps_last_snapshot_date', todayStr);
        }
    } catch (e) {
        console.warn('Snapshot automático:', e);
    }
}

// === Suporte a PWA (Instalação e Service Worker) ===
let deferredPwaPrompt = null;

function initPwaSupport() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker do PetShop registrado com sucesso:', reg.scope))
                .catch(err => console.log('Falha ao registrar Service Worker:', err));
        });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPwaPrompt = e;
        const btnInstall = document.getElementById('btn-pwa-install');
        if (btnInstall) {
            btnInstall.style.display = 'inline-flex';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredPwaPrompt = null;
        const btnInstall = document.getElementById('btn-pwa-install');
        if (btnInstall) btnInstall.style.display = 'none';
        showToast('PetShop Manager instalado com sucesso como aplicativo!', 'success');
    });
}

function instalarAplicativoPWA() {
    if (deferredPwaPrompt) {
        deferredPwaPrompt.prompt();
        deferredPwaPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showToast('Instalando aplicativo...', 'info');
            }
            deferredPwaPrompt = null;
        });
    } else {
        showToast('Para instalar, clique no ícone de instalar na barra de endereços do seu navegador.', 'info');
    }
}

function checkStockAlerts() {
    const products = DB.get(STORAGE_KEYS.PRODUCTS);
    const lowStock = products.filter(p => p.estoque <= p.estoqueMinimo);
    const dot = document.getElementById('notification-dot');
    if (dot && lowStock.length > 0) {
        dot.style.display = 'block';
    }
}

// === Menu Mobile ===
function initMobileMenu() {
    // Criar botão hambúrguer
    const toggle = document.createElement('button');
    toggle.className = 'menu-toggle';
    toggle.id = 'menu-toggle';
    toggle.innerHTML = '<i data-lucide="menu"></i>';
    document.body.appendChild(toggle);

    // Criar overlay
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);

    toggle.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('open');
        overlay.classList.remove('active');
    });
}

// === Dados de Demonstração ===
function initDemoData() {
    // Se o usuário optou por manter o painel zerado para a loja real, não carregar demo
    if (localStorage.getItem('ps_data_state') === 'clean') return;

    // Verificar se já existe dados
    if (DB.get(STORAGE_KEYS.CLIENTS).length > 0) return;

    // Configurações padrão
    const settings = {
        nomeFantasia: 'PetShop Manager',
        cnpj: '12.345.678/0001-90',
        endereco: 'Av. Principal, 456 - Centro',
        telefone: '(11) 3333-4444',
        logo: '',
        servicoPrecos: {
            'Banho': { P: 35, M: 45, G: 55, GG: 65 },
            'Tosa': { P: 40, M: 50, G: 60, GG: 70 },
            'Banho+Tosa': { P: 65, M: 80, G: 95, GG: 110 },
            'Tosa Higiênica': { P: 25, M: 30, G: 35, GG: 40 }
        },
        horarioFuncionamento: {
            'segunda': { aberto: true, inicio: '08:00', fim: '18:00' },
            'terca': { aberto: true, inicio: '08:00', fim: '18:00' },
            'quarta': { aberto: true, inicio: '08:00', fim: '18:00' },
            'quinta': { aberto: true, inicio: '08:00', fim: '18:00' },
            'sexta': { aberto: true, inicio: '08:00', fim: '18:00' },
            'sabado': { aberto: true, inicio: '08:00', fim: '13:00' },
            'domingo': { aberto: false, inicio: '', fim: '' }
        },
        categoriasProdutos: ['Rações', 'Petiscos', 'Brinquedos', 'Higiene', 'Acessórios', 'Medicamentos'],
        categoriasDespesas: ['Aluguel', 'Salários', 'Fornecedores', 'Água/Luz', 'Limpeza', 'Outros']
    };
    DB.save(STORAGE_KEYS.SETTINGS, settings);

    // Funcionários
    const employees = [
        { id: 'func_001', nome: 'João Santos', cargo: 'Tosador', telefone: '(11) 98888-1111', email: 'joao@petshop.com', comissaoTipo: 'percentual', comissaoValor: 15 },
        { id: 'func_002', nome: 'Ana Oliveira', cargo: 'Banhista', telefone: '(11) 98888-2222', email: 'ana@petshop.com', comissaoTipo: 'percentual', comissaoValor: 12 },
        { id: 'func_003', nome: 'Carlos Lima', cargo: 'Atendente', telefone: '(11) 98888-3333', email: 'carlos@petshop.com', comissaoTipo: 'fixo', comissaoValor: 20 },
        { id: 'func_004', nome: 'Mariana Costa', cargo: 'Gerente', telefone: '(11) 98888-4444', email: 'mariana@petshop.com', comissaoTipo: 'percentual', comissaoValor: 10 }
    ];
    DB.save(STORAGE_KEYS.EMPLOYEES, employees);

    // Clientes
    const clients = [
        { id: 'cli_001', nome: 'Maria Silva', telefone: '(11) 99999-1234', email: 'maria@email.com', endereco: 'Rua das Flores, 123', cpf: '123.456.789-00', observacoes: 'Cliente VIP', dataCadastro: '2026-01-15' },
        { id: 'cli_002', nome: 'Pedro Souza', telefone: '(11) 99999-5678', email: 'pedro@email.com', endereco: 'Av. Brasil, 456', cpf: '', observacoes: '', dataCadastro: '2026-02-20' },
        { id: 'cli_003', nome: 'Juliana Mendes', telefone: '(11) 99999-9012', email: 'juliana@email.com', endereco: 'Rua Primavera, 78', cpf: '987.654.321-00', observacoes: 'Prefere horário da manhã', dataCadastro: '2026-03-10' },
        { id: 'cli_004', nome: 'Roberto Alves', telefone: '(11) 99999-3456', email: 'roberto@email.com', endereco: 'Rua dos Lírios, 200', cpf: '', observacoes: '', dataCadastro: '2026-04-05' },
        { id: 'cli_005', nome: 'Fernanda Costa', telefone: '(11) 99999-7890', email: 'fernanda@email.com', endereco: 'Av. Paulista, 1500', cpf: '456.789.123-00', observacoes: 'Tem 3 gatos', dataCadastro: '2026-05-12' }
    ];
    DB.save(STORAGE_KEYS.CLIENTS, clients);

    // Pets
    const pets = [
        { id: 'pet_001', clienteId: 'cli_001', nome: 'Rex', especie: 'Cão', raca: 'Golden Retriever', porte: 'G', dataNascimento: '2021-03-10', peso: 32, alergias: 'Nenhuma', observacoes: '', foto: '' },
        { id: 'pet_002', clienteId: 'cli_001', nome: 'Mimi', especie: 'Gato', raca: 'Persa', porte: 'P', dataNascimento: '2022-06-15', peso: 4, alergias: 'Sensível a perfumes', observacoes: '', foto: '' },
        { id: 'pet_003', clienteId: 'cli_002', nome: 'Thor', especie: 'Cão', raca: 'Rottweiler', porte: 'GG', dataNascimento: '2020-11-20', peso: 45, alergias: '', observacoes: 'Cão forte, precisa de cuidado na tosa', foto: '' },
        { id: 'pet_004', clienteId: 'cli_002', nome: 'Pipoca', especie: 'Cão', raca: 'Poodle', porte: 'P', dataNascimento: '2023-01-05', peso: 5, alergias: '', observacoes: '', foto: '' },
        { id: 'pet_005', clienteId: 'cli_003', nome: 'Luna', especie: 'Cão', raca: 'Labrador', porte: 'G', dataNascimento: '2021-08-12', peso: 28, alergias: '', observacoes: '', foto: '' },
        { id: 'pet_006', clienteId: 'cli_003', nome: 'Simba', especie: 'Gato', raca: 'Siamês', porte: 'P', dataNascimento: '2022-04-20', peso: 3.5, alergias: '', observacoes: '', foto: '' },
        { id: 'pet_007', clienteId: 'cli_004', nome: 'Bob', especie: 'Cão', raca: 'Bulldog Francês', porte: 'M', dataNascimento: '2022-09-01', peso: 12, alergias: 'Alergia a shampoo comum', observacoes: 'Usar shampoo hipoalergênico', foto: '' },
        { id: 'pet_008', clienteId: 'cli_004', nome: 'Mel', especie: 'Cão', raca: 'Shih Tzu', porte: 'P', dataNascimento: '2023-02-14', peso: 6, alergias: '', observacoes: '', foto: '' },
        { id: 'pet_009', clienteId: 'cli_005', nome: 'Mingau', especie: 'Gato', raca: 'Maine Coon', porte: 'M', dataNascimento: '2021-12-25', peso: 8, alergias: '', observacoes: '', foto: '' },
        { id: 'pet_010', clienteId: 'cli_005', nome: 'Frajola', especie: 'Gato', raca: 'Vira-lata', porte: 'P', dataNascimento: '2023-05-10', peso: 3, alergias: '', observacoes: 'Resgatado da rua', foto: '' }
    ];
    DB.save(STORAGE_KEYS.PETS, pets);

    // Gerar datas para agendamentos e validades (ao redor da data atual)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const daysAgo = (n) => { const d = new Date(today); d.setDate(today.getDate() - n); return d.toISOString().split('T')[0]; };
    const daysLater = (n) => { const d = new Date(today); d.setDate(today.getDate() + n); return d.toISOString().split('T')[0]; };

    // Produtos
    const products = [
        { id: 'prod_001', nome: 'Ração Premium Adulto 15kg', descricao: 'Ração premium para cães adultos', categoria: 'Rações', sku: 'RAC001', precoCusto: 89.90, precoVenda: 149.90, margem: 40.03, estoque: 25, estoqueMinimo: 5, unidade: 'un', validade: daysLater(150), fornecedor: 'PetFood Dist.', foto: '' },
        { id: 'prod_002', nome: 'Ração Gatos Castrados 3kg', descricao: 'Ração para gatos castrados', categoria: 'Rações', sku: 'RAC002', precoCusto: 45.00, precoVenda: 79.90, margem: 43.68, estoque: 18, estoqueMinimo: 5, unidade: 'un', validade: daysLater(120), fornecedor: 'PetFood Dist.', foto: '' },
        { id: 'prod_003', nome: 'Ração Filhotes 8kg', descricao: 'Ração para filhotes', categoria: 'Rações', sku: 'RAC003', precoCusto: 62.00, precoVenda: 109.90, margem: 43.59, estoque: 12, estoqueMinimo: 4, unidade: 'un', validade: daysLater(180), fornecedor: 'PetFood Dist.', foto: '' },
        { id: 'prod_004', nome: 'Petisco Bifinho 500g', descricao: 'Petiscos de carne para cães', categoria: 'Petiscos', sku: 'PET001', precoCusto: 8.50, precoVenda: 18.90, margem: 55.03, estoque: 40, estoqueMinimo: 10, unidade: 'pct', validade: daysLater(90), fornecedor: 'Snacks Pet', foto: '' },
        { id: 'prod_005', nome: 'Petisco Dental Stick', descricao: 'Petisco dental para cães', categoria: 'Petiscos', sku: 'PET002', precoCusto: 12.00, precoVenda: 24.90, margem: 51.81, estoque: 30, estoqueMinimo: 8, unidade: 'un', validade: daysLater(60), fornecedor: 'Snacks Pet', foto: '' },
        { id: 'prod_006', nome: 'Brinquedo Bola de Corda', descricao: 'Bola com corda para cães', categoria: 'Brinquedos', sku: 'BRI001', precoCusto: 9.00, precoVenda: 22.90, margem: 60.70, estoque: 15, estoqueMinimo: 5, unidade: 'un', validade: '', fornecedor: 'PetToys', foto: '' },
        { id: 'prod_007', nome: 'Arranhador para Gatos', descricao: 'Arranhador vertical com bolinha', categoria: 'Brinquedos', sku: 'BRI002', precoCusto: 35.00, precoVenda: 69.90, margem: 49.93, estoque: 8, estoqueMinimo: 3, unidade: 'un', validade: '', fornecedor: 'PetToys', foto: '' },
        { id: 'prod_008', nome: 'Shampoo Neutro 500ml', descricao: 'Shampoo neutro para cães e gatos', categoria: 'Higiene', sku: 'HIG001', precoCusto: 11.00, precoVenda: 28.90, margem: 61.94, estoque: 22, estoqueMinimo: 8, unidade: 'un', validade: daysLater(240), fornecedor: 'PetClean', foto: '' },
        { id: 'prod_009', nome: 'Shampoo Antipulgas 500ml', descricao: 'Shampoo antipulgas e carrapatos', categoria: 'Higiene', sku: 'HIG002', precoCusto: 15.00, precoVenda: 34.90, margem: 57.02, estoque: 3, estoqueMinimo: 5, unidade: 'un', validade: daysLater(15), fornecedor: 'PetClean', foto: '' },
        { id: 'prod_010', nome: 'Coleira Ajustável M', descricao: 'Coleira de nylon ajustável', categoria: 'Acessórios', sku: 'ACE001', precoCusto: 7.50, precoVenda: 19.90, margem: 62.31, estoque: 20, estoqueMinimo: 5, unidade: 'un', validade: '', fornecedor: 'PetStyle', foto: '' },
        { id: 'prod_011', nome: 'Guia Retrátil 5m', descricao: 'Guia retrátil para passeio', categoria: 'Acessórios', sku: 'ACE002', precoCusto: 25.00, precoVenda: 54.90, margem: 54.46, estoque: 10, estoqueMinimo: 3, unidade: 'un', validade: '', fornecedor: 'PetStyle', foto: '' },
        { id: 'prod_012', nome: 'Cama Pet Tamanho G', descricao: 'Cama confortável para cães grandes', categoria: 'Acessórios', sku: 'ACE003', precoCusto: 45.00, precoVenda: 89.90, margem: 49.94, estoque: 6, estoqueMinimo: 2, unidade: 'un', validade: '', fornecedor: 'PetComfort', foto: '' },
        { id: 'prod_013', nome: 'Antipulgas Comprimido', descricao: 'Antipulgas oral para cães', categoria: 'Medicamentos', sku: 'MED001', precoCusto: 22.00, precoVenda: 45.90, margem: 52.07, estoque: 2, estoqueMinimo: 5, unidade: 'cx', validade: daysAgo(5), fornecedor: 'VetFarma', foto: '' },
        { id: 'prod_014', nome: 'Vermífugo Oral', descricao: 'Vermífugo em comprimido', categoria: 'Medicamentos', sku: 'MED002', precoCusto: 8.00, precoVenda: 19.90, margem: 59.80, estoque: 15, estoqueMinimo: 5, unidade: 'cx', validade: daysLater(22), fornecedor: 'VetFarma', foto: '' },
        { id: 'prod_015', nome: 'Condicionador Pet 300ml', descricao: 'Condicionador para pelos macios', categoria: 'Higiene', sku: 'HIG003', precoCusto: 13.00, precoVenda: 32.90, margem: 60.49, estoque: 14, estoqueMinimo: 5, unidade: 'un', validade: daysLater(300), fornecedor: 'PetClean', foto: '' },
        { id: 'prod_016', nome: 'Comedouro Inox M', descricao: 'Comedouro de aço inox tamanho M', categoria: 'Acessórios', sku: 'ACE004', precoCusto: 12.00, precoVenda: 29.90, margem: 59.87, estoque: 18, estoqueMinimo: 5, unidade: 'un', validade: '', fornecedor: 'PetStyle', foto: '' },
        { id: 'prod_017', nome: 'Bebedouro Fonte para Gatos', descricao: 'Bebedouro fonte elétrico', categoria: 'Acessórios', sku: 'ACE005', precoCusto: 55.00, precoVenda: 119.90, margem: 54.13, estoque: 4, estoqueMinimo: 2, unidade: 'un', validade: '', fornecedor: 'PetComfort', foto: '' },
        { id: 'prod_018', nome: 'Areia Higiênica 4kg', descricao: 'Areia higiênica para gatos', categoria: 'Higiene', sku: 'HIG004', precoCusto: 10.00, precoVenda: 24.90, margem: 59.84, estoque: 30, estoqueMinimo: 10, unidade: 'pct', validade: '', fornecedor: 'PetClean', foto: '' },
        { id: 'prod_019', nome: 'Brinquedo Ratinho Pelúcia', descricao: 'Ratinho de pelúcia com catnip', categoria: 'Brinquedos', sku: 'BRI003', precoCusto: 5.00, precoVenda: 14.90, margem: 66.44, estoque: 25, estoqueMinimo: 8, unidade: 'un', validade: '', fornecedor: 'PetToys', foto: '' },
        { id: 'prod_020', nome: 'Ração Úmida Sachê 85g', descricao: 'Sachê de ração úmida para gatos', categoria: 'Rações', sku: 'RAC004', precoCusto: 2.50, precoVenda: 5.90, margem: 57.63, estoque: 50, estoqueMinimo: 15, unidade: 'un', validade: daysLater(200), fornecedor: 'PetFood Dist.', foto: '' },
        { id: 'prod_granel_001', nome: 'Ração Premium Adulto (A Granel kg)', descricao: 'Ração premium a granel vendida por quilo', categoria: 'Rações', sku: 'RAC-GRA01', precoCusto: 6.00, precoVenda: 12.90, margem: 53.49, estoque: 12.5, estoqueMinimo: 5, unidade: 'kg', validade: daysLater(150), fornecedor: 'PetFood Dist.', foto: '' }
    ];
    DB.save(STORAGE_KEYS.PRODUCTS, products);

    // Agendamentos
    const appointments = [
        { id: 'agd_001', clienteId: 'cli_001', petId: 'pet_001', servico: 'Banho+Tosa', data: todayStr, horario: '09:00', funcionarioId: 'func_001', observacoes: '', valor: 95, status: 'agendado' },
        { id: 'agd_002', clienteId: 'cli_002', petId: 'pet_003', servico: 'Tosa', data: todayStr, horario: '10:30', funcionarioId: 'func_001', observacoes: 'Cuidado, cão nervoso', valor: 70, status: 'agendado' },
        { id: 'agd_003', clienteId: 'cli_003', petId: 'pet_005', servico: 'Banho', data: todayStr, horario: '14:00', funcionarioId: 'func_002', observacoes: '', valor: 55, status: 'agendado' },
        { id: 'agd_004', clienteId: 'cli_001', petId: 'pet_002', servico: 'Banho', data: todayStr, horario: '15:30', funcionarioId: 'func_002', observacoes: 'Gata sensível', valor: 35, status: 'agendado' },
        { id: 'agd_005', clienteId: 'cli_004', petId: 'pet_007', servico: 'Banho+Tosa', data: daysLater(1), horario: '09:00', funcionarioId: 'func_001', observacoes: 'Usar shampoo hipoalergênico', valor: 80, status: 'agendado' },
        { id: 'agd_006', clienteId: 'cli_005', petId: 'pet_009', servico: 'Banho', data: daysLater(1), horario: '11:00', funcionarioId: 'func_002', observacoes: '', valor: 45, status: 'agendado' },
        { id: 'agd_007', clienteId: 'cli_002', petId: 'pet_004', servico: 'Tosa Higiênica', data: daysLater(2), horario: '10:00', funcionarioId: 'func_001', observacoes: '', valor: 25, status: 'agendado' },
        { id: 'agd_008', clienteId: 'cli_003', petId: 'pet_006', servico: 'Banho', data: daysLater(2), horario: '14:00', funcionarioId: 'func_002', observacoes: '', valor: 35, status: 'agendado' },
        { id: 'agd_009', clienteId: 'cli_001', petId: 'pet_001', servico: 'Banho', data: daysAgo(3), horario: '09:00', funcionarioId: 'func_002', observacoes: '', valor: 55, status: 'concluido' },
        { id: 'agd_010', clienteId: 'cli_002', petId: 'pet_003', servico: 'Banho+Tosa', data: daysAgo(5), horario: '10:00', funcionarioId: 'func_001', observacoes: '', valor: 110, status: 'concluido' },
        { id: 'agd_011', clienteId: 'cli_004', petId: 'pet_008', servico: 'Tosa', data: daysAgo(7), horario: '11:00', funcionarioId: 'func_001', observacoes: '', valor: 40, status: 'concluido' },
        { id: 'agd_012', clienteId: 'cli_005', petId: 'pet_010', servico: 'Banho', data: daysAgo(10), horario: '14:00', funcionarioId: 'func_002', observacoes: '', valor: 35, status: 'concluido' },
        { id: 'agd_013', clienteId: 'cli_003', petId: 'pet_005', servico: 'Banho+Tosa', data: daysAgo(14), horario: '09:30', funcionarioId: 'func_001', observacoes: '', valor: 95, status: 'concluido' },
        { id: 'agd_014', clienteId: 'cli_001', petId: 'pet_002', servico: 'Tosa Higiênica', data: daysAgo(20), horario: '15:00', funcionarioId: 'func_001', observacoes: '', valor: 25, status: 'concluido' },
        { id: 'agd_015', clienteId: 'cli_004', petId: 'pet_007', servico: 'Banho', data: daysAgo(2), horario: '10:00', funcionarioId: 'func_002', observacoes: '', valor: 45, status: 'cancelado' }
    ];
    DB.save(STORAGE_KEYS.APPOINTMENTS, appointments);

    // Vendas
    const sales = [
        { id: 'venda_001', data: daysAgo(2), clienteId: 'cli_001', itens: [{ produtoId: 'prod_001', nome: 'Ração Premium Adulto 15kg', quantidade: 1, precoUnitario: 149.90, subtotal: 149.90 }, { produtoId: 'prod_004', nome: 'Petisco Bifinho 500g', quantidade: 2, precoUnitario: 18.90, subtotal: 37.80 }], desconto: 0, descontoTipo: 'percentual', total: 187.70, formaPagamento: 'Pix' },
        { id: 'venda_002', data: daysAgo(5), clienteId: 'cli_003', itens: [{ produtoId: 'prod_002', nome: 'Ração Gatos Castrados 3kg', quantidade: 2, precoUnitario: 79.90, subtotal: 159.80 }], desconto: 5, descontoTipo: 'percentual', total: 151.81, formaPagamento: 'Cartão Crédito' },
        { id: 'venda_003', data: daysAgo(8), clienteId: 'cli_002', itens: [{ produtoId: 'prod_008', nome: 'Shampoo Neutro 500ml', quantidade: 1, precoUnitario: 28.90, subtotal: 28.90 }, { produtoId: 'prod_010', nome: 'Coleira Ajustável M', quantidade: 1, precoUnitario: 19.90, subtotal: 19.90 }], desconto: 0, descontoTipo: 'percentual', total: 48.80, formaPagamento: 'Dinheiro' },
        { id: 'venda_004', data: daysAgo(12), clienteId: 'cli_005', itens: [{ produtoId: 'prod_018', nome: 'Areia Higiênica 4kg', quantidade: 3, precoUnitario: 24.90, subtotal: 74.70 }, { produtoId: 'prod_019', nome: 'Brinquedo Ratinho Pelúcia', quantidade: 2, precoUnitario: 14.90, subtotal: 29.80 }], desconto: 10, descontoTipo: 'valor', total: 94.50, formaPagamento: 'Pix' },
        { id: 'venda_005', data: daysAgo(15), clienteId: 'cli_004', itens: [{ produtoId: 'prod_006', nome: 'Brinquedo Bola de Corda', quantidade: 1, precoUnitario: 22.90, subtotal: 22.90 }, { produtoId: 'prod_005', nome: 'Petisco Dental Stick', quantidade: 1, precoUnitario: 24.90, subtotal: 24.90 }], desconto: 0, descontoTipo: 'percentual', total: 47.80, formaPagamento: 'Cartão Débito' }
    ];
    DB.save(STORAGE_KEYS.SALES, sales);

    // Receitas (serviços concluídos + vendas)
    const revenues = [
        // Vendas
        { id: 'rec_001', data: daysAgo(2), descricao: 'Venda - Maria Silva', categoria: 'Produto', valor: 187.70, formaPagamento: 'Pix', referencia: 'venda_001' },
        { id: 'rec_002', data: daysAgo(5), descricao: 'Venda - Juliana Mendes', categoria: 'Produto', valor: 151.81, formaPagamento: 'Cartão Crédito', referencia: 'venda_002' },
        { id: 'rec_003', data: daysAgo(8), descricao: 'Venda - Pedro Souza', categoria: 'Produto', valor: 48.80, formaPagamento: 'Dinheiro', referencia: 'venda_003' },
        { id: 'rec_004', data: daysAgo(12), descricao: 'Venda - Fernanda Costa', categoria: 'Produto', valor: 94.50, formaPagamento: 'Pix', referencia: 'venda_004' },
        { id: 'rec_005', data: daysAgo(15), descricao: 'Venda - Roberto Alves', categoria: 'Produto', valor: 47.80, formaPagamento: 'Cartão Débito', referencia: 'venda_005' },
        // Serviços concluídos
        { id: 'rec_006', data: daysAgo(3), descricao: 'Banho - Rex (Maria Silva)', categoria: 'Serviço', valor: 55, formaPagamento: 'Dinheiro', referencia: 'agd_009' },
        { id: 'rec_007', data: daysAgo(5), descricao: 'Banho+Tosa - Thor (Pedro Souza)', categoria: 'Serviço', valor: 110, formaPagamento: 'Pix', referencia: 'agd_010' },
        { id: 'rec_008', data: daysAgo(7), descricao: 'Tosa - Mel (Roberto Alves)', categoria: 'Serviço', valor: 40, formaPagamento: 'Dinheiro', referencia: 'agd_011' },
        { id: 'rec_009', data: daysAgo(10), descricao: 'Banho - Frajola (Fernanda Costa)', categoria: 'Serviço', valor: 35, formaPagamento: 'Pix', referencia: 'agd_012' },
        { id: 'rec_010', data: daysAgo(14), descricao: 'Banho+Tosa - Luna (Juliana Mendes)', categoria: 'Serviço', valor: 95, formaPagamento: 'Cartão Crédito', referencia: 'agd_013' },
        { id: 'rec_011', data: daysAgo(20), descricao: 'Tosa Higiênica - Mimi (Maria Silva)', categoria: 'Serviço', valor: 25, formaPagamento: 'Dinheiro', referencia: 'agd_014' }
    ];
    DB.save(STORAGE_KEYS.REVENUES, revenues);

    // Despesas
    const expenses = [
        { id: 'desp_001', data: daysAgo(1), descricao: 'Aluguel do mês', categoria: 'Aluguel', valor: 3500, recorrente: true },
        { id: 'desp_002', data: daysAgo(1), descricao: 'Salário - João Santos', categoria: 'Salários', valor: 2200, recorrente: true },
        { id: 'desp_003', data: daysAgo(1), descricao: 'Salário - Ana Oliveira', categoria: 'Salários', valor: 2000, recorrente: true },
        { id: 'desp_004', data: daysAgo(1), descricao: 'Salário - Carlos Lima', categoria: 'Salários', valor: 1800, recorrente: true },
        { id: 'desp_005', data: daysAgo(5), descricao: 'Conta de água', categoria: 'Água/Luz', valor: 280, recorrente: true },
        { id: 'desp_006', data: daysAgo(5), descricao: 'Conta de luz', categoria: 'Água/Luz', valor: 450, recorrente: true },
        { id: 'desp_007', data: daysAgo(8), descricao: 'Produtos de limpeza', categoria: 'Limpeza', valor: 180, recorrente: false },
        { id: 'desp_008', data: daysAgo(10), descricao: 'Reposição de estoque - PetFood', categoria: 'Fornecedores', valor: 2500, recorrente: false },
        { id: 'desp_009', data: daysAgo(15), descricao: 'Reposição de estoque - PetClean', categoria: 'Fornecedores', valor: 800, recorrente: false },
        { id: 'desp_010', data: daysAgo(20), descricao: 'Manutenção equipamentos', categoria: 'Outros', valor: 350, recorrente: false }
    ];
    DB.save(STORAGE_KEYS.EXPENSES, expenses);

    // Movimentações de estoque
    DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, []);

    // Pacotes Mensais de Demonstração
    const packages = [
        { id: 'pkg_001', clienteId: 'cli_001', petId: 'pet_001', tipo: '4_banhos', sessoesTotal: 4, sessoesRestantes: 3, valorTotal: 180, formaPagamento: 'Pix', dataInicio: daysAgo(5), status: 'ativo', historicoUso: [{ data: daysAgo(3), appointmentId: 'agd_009' }] },
        { id: 'pkg_002', clienteId: 'cli_003', petId: 'pet_005', tipo: '4_banhos_1_tosa', sessoesTotal: 5, sessoesRestantes: 4, valorTotal: 250, formaPagamento: 'Cartão Crédito', dataInicio: daysAgo(10), status: 'ativo', historicoUso: [{ data: daysAgo(5), appointmentId: null }] }
    ];
    DB.save(STORAGE_KEYS.PACKAGES, packages);

    console.log('✅ Dados de demonstração carregados com sucesso!');
}

// === Inicialização Global ===
document.addEventListener('DOMContentLoaded', () => {
    // 1. Suporte Master / Impersonação: se o Dono estiver acessando como a loja, exibir barra fixa de suporte
    checarBannerImpersonacaoGlobal();

    // 2. Validar autenticação e status da licença do tenant (dunning/bloqueio automático)
    if (typeof verificarSessao === 'function') {
        const authed = verificarSessao();
        if (!authed) return;
    }

    // 3. Checar status da assinatura e tolerância de inadimplência
    if (typeof verificarStatusAssinaturaTenant === 'function') {
        const acessoLiberado = verificarStatusAssinaturaTenant();
        if (!acessoLiberado) return;
    }

    // 4. Blindagem de persistência de dados e auto-snapshot diário
    initDataPersistenceAndSafety();

    // 5. Suporte ao aplicativo PWA e Service Worker
    initPwaSupport();

    // 5.1 Garantir painel zerado por padrão para operação de loja real
    if (!localStorage.getItem('ps_painel_zerado_v1')) {
        localStorage.setItem('ps_painel_zerado_v1', 'true');
        localStorage.setItem('ps_data_state', 'clean');
        DB.save(STORAGE_KEYS.REVENUES, []);
        DB.save(STORAGE_KEYS.EXPENSES, []);
        DB.save(STORAGE_KEYS.SALES, []);
        DB.save(STORAGE_KEYS.APPOINTMENTS, []);
        DB.save(STORAGE_KEYS.CLIENTS, []);
        DB.save(STORAGE_KEYS.PETS, []);
        const s = DB.get(STORAGE_KEYS.SETTINGS) || {};
        s.caixa = { gaveta: 0, pixBanco: 0, cartoesCompensar: 0, reserva: 0 };
        DB.save(STORAGE_KEYS.SETTINGS, s);
    }

    // 6. Carregar dados demo (apenas se vazio)
    initDemoData();
    
    // 7. Inicializar sidebar e header
    initSidebar();
    initHeader();
    initMobileMenu();

    // 8. Exibir Avisos e Comunicados Globais publicados pelo Super Admin
    exibirAvisosGlobaisPlataforma();
    
    // 8.1 Exibir Banner de Modo (Demonstração vs Loja Real)
    exibirBannerModoPainel();
    
    // 9. Renderizar ícones Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

// Checagem de tarja de suporte quando o Dono entra via Impersonate
function checarBannerImpersonacaoGlobal() {
    try {
        const impData = localStorage.getItem('ps_impersonating_tenant');
        if (impData) {
            const parsed = JSON.parse(impData);
            let banner = document.getElementById('ps-global-impersonate-bar');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'ps-global-impersonate-bar';
                banner.style.cssText = 'position:fixed; top:0; left:0; right:0; z-index:99999; background:linear-gradient(90deg, #dc2626, #991b1b); color:#fff; padding:6px 16px; font-size:0.84rem; font-weight:600; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 10px rgba(0,0,0,0.3);';
                banner.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span>👑 <strong>MODO DE SUPORTE MASTER:</strong> Você está conectado no pet shop: <u>${parsed.tenantNome}</u></span>
                    </div>
                    <button onclick="encerrarImpersonacaoGlobal()" style="background:#fff; color:#991b1b; border:none; padding:4px 12px; border-radius:4px; font-weight:700; cursor:pointer; font-size:0.78rem;">
                        Encerrar Suporte e Voltar ao Admin
                    </button>
                `;
                document.body.prepend(banner);
                document.body.style.paddingTop = '34px';
            }
        }
    } catch (e) {}
}

window.encerrarImpersonacaoGlobal = function() {
    localStorage.removeItem('ps_impersonating_tenant');
    window.location.href = 'admin.html';
};

// Verificação de Licença, Trial e Bloqueio Automático por Inadimplência (Dunning)
function verificarStatusAssinaturaTenant() {
    const page = getCurrentPage();
    if (page === 'login' || page === 'admin') return true;

    // Se estiver em modo de suporte pelo dono, permite navegar para diagnosticar
    if (localStorage.getItem('ps_impersonating_tenant')) return true;

    const currentTenantId = getActiveTenantId();
    if (currentTenantId === 'default' || currentTenantId === 'dono_flavio') return true;

    try {
        const tenants = JSON.parse(localStorage.getItem('ps_saas_tenants') || '[]');
        const tenant = tenants.find(t => t.id === currentTenantId);

        if (tenant) {
            // Caso 1: Loja Suspensa ou Bloqueada
            if (tenant.status === 'suspended') {
                bloquearTelaInadimplencia(tenant, 'Esta conta está temporariamente suspensa por pendência financeira.');
                return false;
            }
            // Caso 2: Loja Cancelada
            if (tenant.status === 'cancelled') {
                bloquearTelaInadimplencia(tenant, 'A assinatura deste Pet Shop foi cancelada.');
                return false;
            }
            // Caso 3: Trial Expirado
            if (tenant.status === 'trial' && tenant.trialExpiraEm) {
                if (new Date() > new Date(tenant.trialExpiraEm)) {
                    tenant.status = 'suspended';
                    localStorage.setItem('ps_saas_tenants', JSON.stringify(tenants));
                    bloquearTelaInadimplencia(tenant, 'Seu período de teste gratuito de 14 dias expirou. Ative sua assinatura para continuar usando.');
                    return false;
                }
            }
        }
    } catch (e) {}

    return true;
}

function bloquearTelaInadimplencia(tenant, mensagem) {
    document.body.innerHTML = `
        <div style="min-height:100vh; background:#0f172a; color:#f8fafc; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:1.5rem; text-align:center; font-family:'Inter', sans-serif;">
            <div style="background:#1e293b; border:1px solid #334155; padding:2.5rem; border-radius:12px; max-width:520px; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <div style="font-size:3rem; margin-bottom:1rem;">🔒</div>
                <h1 style="font-size:1.5rem; font-weight:700; margin:0 0 0.5rem; color:#ef4444;">Acesso Suspenso</h1>
                <p style="color:#94a3b8; font-size:0.95rem; line-height:1.5; margin-bottom:1.5rem;">${mensagem}</p>
                <div style="background:#0f172a; padding:1rem; border-radius:8px; border:1px solid #334155; margin-bottom:1.5rem; font-size:0.85rem; color:#cbd5e1; text-align:left;">
                    <div>Pet Shop: <strong>${tenant.nome || tenant.nomePetShop}</strong></div>
                    <div>Plano: <strong>${(tenant.plano || 'Pro').toUpperCase()}</strong></div>
                    <div style="margin-top:4px;">Chave Pix Copia e Cola / Link de regularização disponível com nosso suporte.</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    <a href="https://wa.me/5534999836438?text=Olá Flávio, gostaria de regularizar o acesso da loja ${encodeURIComponent(tenant.nome || tenant.nomePetShop)}" target="_blank" style="display:inline-flex; align-items:center; justify-content:center; gap:8px; background:#10b981; color:#fff; text-decoration:none; padding:0.75rem 1.25rem; border-radius:6px; font-weight:700; font-size:0.9rem;">
                        <span>Regularizar via WhatsApp com Flávio Filho</span>
                    </a>
                    <button onclick="localStorage.removeItem('ps_current_tenant_id'); window.location.href='login.html';" style="background:transparent; border:1px solid #475569; color:#94a3b8; padding:0.6rem; border-radius:6px; cursor:pointer; font-size:0.82rem;">
                        Voltar para a Tela de Login
                    </button>
                </div>
            </div>
            <div style="margin-top:1.5rem; font-size:0.78rem; color:#64748b;">PetShop Manager • Gestão de Software Multi-Tenant</div>
        </div>
    `;
}

// Banners de Avisos Globais emitidos pelo Dono
function exibirAvisosGlobaisPlataforma() {
    try {
        const avisos = JSON.parse(localStorage.getItem('ps_saas_announcements') || '[]');
        const avisosAtivos = avisos.filter(a => a.status === 'ativo');
        if (avisosAtivos.length === 0) return;

        const mainContent = document.querySelector('.main-content') || document.querySelector('main') || document.body;
        const bannerContainer = document.createElement('div');
        bannerContainer.style.cssText = 'margin-bottom:1.25rem; display:flex; flex-direction:column; gap:8px;';

        avisosAtivos.forEach(av => {
            const el = document.createElement('div');
            el.style.cssText = 'background:linear-gradient(135deg, #1e3a8a, #2563eb); color:#fff; padding:10px 16px; border-radius:8px; font-size:0.86rem; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 12px rgba(37,99,235,0.2);';
            el.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.2rem;">📢</span>
                    <div>
                        <strong style="text-transform:uppercase; font-size:0.72rem; letter-spacing:0.5px; opacity:0.85;">COMUNICADO DA PLATAFORMA</strong>
                        <div style="font-weight:600;">${av.titulo}</div>
                    </div>
                </div>
                <button onclick="this.parentElement.remove()" style="background:transparent; border:none; color:rgba(255,255,255,0.7); cursor:pointer; font-size:1.1rem; line-height:1;">&times;</button>
            `;
            bannerContainer.appendChild(el);
        });

        if (mainContent.firstChild) {
            mainContent.insertBefore(bannerContainer, mainContent.firstChild);
        } else {
            mainContent.appendChild(bannerContainer);
        }
    } catch (e) {}
}

// ==========================================
// FUNÇÕES DE PRODUTIVIDADE & USABILIDADE (1, 3, 4)
// ==========================================

// 1. Toggle do Menu de Ações Rápidas
function toggleQuickActionMenu() {
    const dropdown = document.getElementById('quick-action-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
window.toggleQuickActionMenu = toggleQuickActionMenu;

// Atalho F2 para Ações Rápidas em qualquer tela
window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
        e.preventDefault();
        toggleQuickActionMenu();
    }
});

// 4. Spotlight / Busca Global Instantânea (Ctrl + K)
function injetarSpotlightBusca() {
    if (document.getElementById('spotlight-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'spotlight-overlay';
    overlay.className = 'spotlight-overlay';
    overlay.innerHTML = `
        <div class="spotlight-box" onclick="event.stopPropagation()">
            <div class="spotlight-header">
                <i data-lucide="search" style="width:20px;height:20px;color:#3b82f6;"></i>
                <input type="text" id="spotlight-input" placeholder="Digite para buscar pets, tutores, telefones ou produtos..." autocomplete="off">
                <kbd style="background:#f1f5f9; padding:2px 8px; border-radius:4px; font-size:0.75rem; border:1px solid #cbd5e1; color:#64748b;">ESC</kbd>
            </div>
            <div class="spotlight-results" id="spotlight-results">
                <div style="padding:1.5rem; text-align:center; color:#94a3b8; font-size:0.85rem;">
                    Digite o nome de um pet, tutor ou produto...
                </div>
            </div>
            <div class="spotlight-footer">
                <div><span>Navegue com o mouse ou clique no resultado</span></div>
                <div><strong style="color:#2563eb;">PetShop Manager</strong> • Busca Rápida</div>
            </div>
        </div>
    `;

    overlay.onclick = fecharSpotlightBusca;
    document.body.appendChild(overlay);

    const input = document.getElementById('spotlight-input');
    if (input) {
        input.addEventListener('input', (e) => processarBuscaSpotlight(e.target.value));
    }
}

function abrirSpotlightBusca() {
    injetarSpotlightBusca();
    const overlay = document.getElementById('spotlight-overlay');
    const input = document.getElementById('spotlight-input');
    if (overlay && input) {
        overlay.classList.add('active');
        input.value = '';
        input.focus();
        processarBuscaSpotlight('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
window.abrirSpotlightBusca = abrirSpotlightBusca;

function fecharSpotlightBusca() {
    const overlay = document.getElementById('spotlight-overlay');
    if (overlay) overlay.classList.remove('active');
}
window.fecharSpotlightBusca = fecharSpotlightBusca;

// Atalho de Teclado Ctrl + K ou Cmd + K
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        abrirSpotlightBusca();
    }
    if (e.key === 'Escape') {
        fecharSpotlightBusca();
    }
});

function processarBuscaSpotlight(termo) {
    const resultsContainer = document.getElementById('spotlight-results');
    if (!resultsContainer) return;

    termo = (termo || '').toLowerCase().trim();
    if (!termo) {
        resultsContainer.innerHTML = `
            <div style="padding:1.5rem; text-align:center; color:#94a3b8; font-size:0.85rem;">
                💡 Digite o nome de um pet, tutor, telefone ou produto para localizar imediatamente.
            </div>
        `;
        return;
    }

    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const products = DB.get(STORAGE_KEYS.PRODUCTS) || [];

    // Filtrar Pets
    const petsMatch = pets.filter(p => p.nome.toLowerCase().includes(termo) || (p.raca && p.raca.toLowerCase().includes(termo))).slice(0, 4);
    // Filtrar Clientes
    const clientsMatch = clients.filter(c => c.nome.toLowerCase().includes(termo) || (c.telefone && c.telefone.includes(termo))).slice(0, 4);
    // Filtrar Produtos
    const productsMatch = products.filter(p => p.nome.toLowerCase().includes(termo) || (p.sku && p.sku.toLowerCase().includes(termo))).slice(0, 4);

    if (petsMatch.length === 0 && clientsMatch.length === 0 && productsMatch.length === 0) {
        resultsContainer.innerHTML = `
            <div style="padding:1.5rem; text-align:center; color:#94a3b8; font-size:0.85rem;">
                Nenhum resultado encontrado para "<strong>${escapeHtml(termo)}</strong>".
            </div>
        `;
        return;
    }

    let html = '';

    if (petsMatch.length > 0) {
        html += `<div class="spotlight-group-title">🐾 Pets Encontrados</div>`;
        petsMatch.forEach(p => {
            const tutor = clients.find(c => c.id === p.clienteId);
            html += `
                <a href="clientes.html" class="spotlight-result-item" onclick="fecharSpotlightBusca()">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.1rem;">🐶</span>
                        <div>
                            <div style="font-weight:600; font-size:0.9rem; color:#1e293b;">${escapeHtml(p.nome)}</div>
                            <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(p.raca || 'SRD')} • Tutor: ${escapeHtml(tutor ? tutor.nome : 'Não informado')}</div>
                        </div>
                    </div>
                    <span class="badge badge-primary" style="font-size:0.72rem;">Porte ${p.porte || 'M'}</span>
                </a>
            `;
        });
    }

    if (clientsMatch.length > 0) {
        html += `<div class="spotlight-group-title">👤 Tutores / Clientes</div>`;
        clientsMatch.forEach(c => {
            html += `
                <a href="clientes.html" class="spotlight-result-item" onclick="fecharSpotlightBusca()">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.1rem;">👤</span>
                        <div>
                            <div style="font-weight:600; font-size:0.9rem; color:#1e293b;">${escapeHtml(c.nome)}</div>
                            <div style="font-size:0.75rem; color:#64748b;">WhatsApp: ${c.telefone || 'Não informado'}</div>
                        </div>
                    </div>
                    <span class="badge badge-secondary" style="font-size:0.72rem;">Ver Perfil</span>
                </a>
            `;
        });
    }

    if (productsMatch.length > 0) {
        html += `<div class="spotlight-group-title">📦 Produtos no Estoque</div>`;
        productsMatch.forEach(pr => {
            html += `
                <a href="estoque.html" class="spotlight-result-item" onclick="fecharSpotlightBusca()">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.1rem;">🏷️</span>
                        <div>
                            <div style="font-weight:600; font-size:0.9rem; color:#1e293b;">${escapeHtml(pr.nome)}</div>
                            <div style="font-size:0.75rem; color:#64748b;">Estoque: <strong>${pr.estoque}</strong> ${pr.unidade || 'un'} • Preço: ${formatCurrency(pr.precoVenda)}</div>
                        </div>
                    </div>
                    <span class="badge ${pr.estoque <= pr.estoqueMinimo ? 'badge-danger' : 'badge-success'}" style="font-size:0.72rem;">
                        ${formatCurrency(pr.precoVenda)}
                    </span>
                </a>
            `;
        });
    }

    resultsContainer.innerHTML = html;
}

// 3. Fechamento de Caixa do Dia (Visualização e Impressão de Sangria / Fechamento)
function abrirModalFechamentoCaixa() {
    const revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
    const sales = DB.get(STORAGE_KEYS.SALES) || [];
    const expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};

    const hojeStr = new Date().toISOString().split('T')[0];

    // Receitas de Hoje
    const receitasHoje = revenues.filter(r => r.data === hojeStr);
    const despesasHoje = expenses.filter(e => e.data === hojeStr);

    let totalPix = 0;
    let totalDinheiro = 0;
    let totalDebito = 0;
    let totalCredito = 0;
    let totalOutros = 0;

    receitasHoje.forEach(r => {
        const f = (r.formaPagamento || '').toLowerCase();
        const v = parseFloat(r.valor) || 0;
        if (f.includes('pix')) totalPix += v;
        else if (f.includes('dinheiro')) totalDinheiro += v;
        else if (f.includes('débito') || f.includes('debito')) totalDebito += v;
        else if (f.includes('crédito') || f.includes('credito') || f.includes('cartao') || f.includes('cartão')) totalCredito += v;
        else totalOutros += v;
    });

    const totalEntradas = totalPix + totalDinheiro + totalDebito + totalCredito + totalOutros;
    const totalSaidas = despesasHoje.reduce((acc, cur) => acc + (parseFloat(cur.valor) || 0), 0);
    const saldoLiquidoCaixa = totalEntradas - totalSaidas;

    let modal = document.getElementById('modal-fechamento-caixa');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-fechamento-caixa';
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal modal-md">
            <div class="modal-header">
                <h2><i data-lucide="calculator" style="color:var(--primary); margin-right:6px;"></i> Fechamento e Resumo do Caixa do Dia</h2>
                <button class="btn-icon modal-close" onclick="closeModal('modal-fechamento-caixa')">
                    <i data-lucide="x"></i>
                </button>
            </div>
            <div class="modal-body">
                <div id="printable-caixa-area" style="background:#fff; border:1px dashed #cbd5e1; border-radius:8px; padding:1.25rem; font-family:'Courier New', monospace; font-size:0.88rem; color:#1e293b;">
                    <div style="text-align:center; border-bottom:1px dashed #cbd5e1; padding-bottom:0.75rem; margin-bottom:0.75rem;">
                        <h3 style="font-size:1.15rem; font-weight:700; margin:0;">${escapeHtml(settings.nomeFantasia || 'PetShop Manager')}</h3>
                        <div style="font-size:0.75rem; color:#64748b;">RELATÓRIO DE FECHAMENTO DIÁRIO DE CAIXA</div>
                        <div style="font-size:0.8rem; margin-top:4px;">Data: <strong>${new Date().toLocaleDateString('pt-BR')}</strong> às ${new Date().toLocaleTimeString('pt-BR')}</div>
                    </div>

                    <div style="margin-bottom:1rem;">
                        <strong style="text-transform:uppercase; font-size:0.78rem; color:#64748b;">Entradas por Forma de Pagamento:</strong>
                        <div style="display:flex; justify-content:space-between; margin-top:4px;"><span>💵 Dinheiro em Espécie:</span> <strong>${formatCurrency(totalDinheiro)}</strong></div>
                        <div style="display:flex; justify-content:space-between; margin-top:4px;"><span>⚡ Pix Recebido:</span> <strong>${formatCurrency(totalPix)}</strong></div>
                        <div style="display:flex; justify-content:space-between; margin-top:4px;"><span>💳 Cartão de Débito:</span> <strong>${formatCurrency(totalDebito)}</strong></div>
                        <div style="display:flex; justify-content:space-between; margin-top:4px;"><span>💳 Cartão de Crédito:</span> <strong>${formatCurrency(totalCredito)}</strong></div>
                        ${totalOutros > 0 ? `<div style="display:flex; justify-content:space-between; margin-top:4px;"><span>Outros:</span> <strong>${formatCurrency(totalOutros)}</strong></div>` : ''}
                    </div>

                    <div style="border-top:1px dashed #cbd5e1; padding-top:0.6rem; margin-bottom:0.6rem;">
                        <div style="display:flex; justify-content:space-between; font-size:1rem; color:#10b981;"><span>(+) TOTAL ENTRADAS:</span> <strong>${formatCurrency(totalEntradas)}</strong></div>
                        <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:#ef4444; margin-top:4px;"><span>(-) TOTAL SAÍDAS/DESPESAS:</span> <strong>${formatCurrency(totalSaidas)}</strong></div>
                    </div>

                    <div style="border-top:2px solid #1e293b; padding-top:0.6rem; display:flex; justify-content:space-between; font-size:1.15rem; font-weight:700; color:#1e3a5f;">
                        <span>(=) SALDO LÍQUIDO DO DIA:</span>
                        <span>${formatCurrency(saldoLiquidoCaixa)}</span>
                    </div>

                    <div style="text-align:center; margin-top:1.5rem; font-size:0.75rem; color:#94a3b8; border-top:1px dashed #cbd5e1; padding-top:0.75rem;">
                        Total de ${receitasHoje.length} transações processadas hoje.<br>
                        Fechamento conferido pelo operador da loja.
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display:flex; justify-content:space-between;">
                <button type="button" class="btn btn-secondary" onclick="closeModal('modal-fechamento-caixa')">Fechar</button>
                <button type="button" class="btn btn-primary" onclick="window.print()">
                    <i data-lucide="printer"></i> Imprimir Fechamento de Caixa
                </button>
            </div>
        </div>
    `;

    openModal('modal-fechamento-caixa');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
window.abrirModalFechamentoCaixa = abrirModalFechamentoCaixa;

// ==========================================
// MÓDULO: ALTERNADOR PAINEL ZERADO vs DEMONSTRAÇÃO LUCRATIVA
// ==========================================

function exibirBannerModoPainel() {
    const containerDash = document.getElementById('container-banner-modo');
    const containerFin = document.getElementById('container-banner-modo-financeiro');
    const target = containerDash || containerFin;
    if (!target) return;

    const isClean = localStorage.getItem('ps_data_state') === 'clean';

    if (isClean) {
        target.innerHTML = `
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 42px; height: 42px; border-radius: 10px; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
                        🏪
                    </div>
                    <div>
                        <strong style="color: #1e293b; font-size: 0.95rem;">Painel Zerado &amp; Pronto para sua Loja Real</strong>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
                            Todos os indicadores começam em R$ 0,00. Conforme você lançar seus clientes, agendamentos e vendas, o painel será preenchido em tempo real.
                        </div>
                    </div>
                </div>
                <div>
                    <button class="btn btn-primary btn-sm" onclick="carregarDemonstracaoPositiva()" style="background: linear-gradient(135deg, #10b981, #059669); border: none; font-weight: 700; box-shadow: 0 2px 8px rgba(16,185,129,0.3); display: inline-flex; align-items: center; gap: 5px;">
                        <i data-lucide="sparkles"></i> Ver Demonstração de Sucesso (Lucro Alto)
                    </button>
                </div>
            </div>
        `;
    } else {
        target.innerHTML = `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #16a34a; border-radius: 12px; padding: 0.85rem 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 1.35rem;">🌟</span>
                    <div>
                        <strong style="color: #15803d; font-size: 0.95rem;">Modo Demonstração: Empresa Modelo com Faturamento Positivo Ativo</strong>
                        <div style="font-size: 0.8rem; color: #166534; margin-top: 2px;">
                            Visualizando uma empresa saudável: <strong>R$ 28.450</strong> em faturamento, <strong>+ R$ 12.250</strong> de lucro líquido (+43,1% de margem) e gráficos em alta.
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary btn-sm" onclick="zerarPainelLojaReal()" style="background: #ffffff; color: #be123c; border-color: #fecdd3; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">
                        <i data-lucide="rotate-ccw"></i> Zerar Painel (Começar Loja Real)
                    </button>
                </div>
            </div>
        `;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}
window.exibirBannerModoPainel = exibirBannerModoPainel;

async function zerarPainelLojaReal(confirmar = true) {
    if (confirmar) {
        const proceed = await confirmDialog(
            'Deseja realmente zerar todos os números do painel para começar sua loja real do zero?\n\n' +
            'Todos os faturamentos, despesas, agendamentos e clientes serão resetados para R$ 0,00.\n' +
            '(Você poderá clicar em "Ver Demonstração" a qualquer momento para ver o modelo de exemplo novamente).'
        );
        if (!proceed) return;
    }

    localStorage.setItem('ps_data_state', 'clean');

    // Zerar movimentações financeiras e operacionais
    DB.save(STORAGE_KEYS.REVENUES, []);
    DB.save(STORAGE_KEYS.EXPENSES, []);
    DB.save(STORAGE_KEYS.SALES, []);
    DB.save(STORAGE_KEYS.APPOINTMENTS, []);
    DB.save(STORAGE_KEYS.CLIENTS, []);
    DB.save(STORAGE_KEYS.PETS, []);
    DB.save(STORAGE_KEYS.PACKAGES, []);
    DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    DB.save(STORAGE_KEYS.PURCHASE_ORDERS, []);

    // Zerar saldos do caixa e calibragens financeiras
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    settings.caixa = {
        gaveta: 0,
        pixBanco: 0,
        cartoesCompensar: 0,
        reserva: 0
    };
    DB.save(STORAGE_KEYS.SETTINGS, settings);

    localStorage.removeItem('ps_saldo_giro_calibrado');
    localStorage.setItem('ps_reserva_emergencia', '0.00');
    localStorage.setItem('ps_meta_faturamento', '0.00');
    localStorage.setItem('ps_historico_reserva', '[]');

    logAudit('RESET_CLEAN', 'Administração', 'Painel zerado para operação de loja real.');
    showToast('Painel zerado com sucesso! Todos os números agora estão em R$ 0,00.', 'success');

    setTimeout(() => {
        window.location.reload();
    }, 400);
}
window.zerarPainelLojaReal = zerarPainelLojaReal;

async function carregarDemonstracaoPositiva() {
    showToast('Carregando dados de demonstração de uma empresa lucrativa...', 'info');

    localStorage.setItem('ps_data_state', 'demo');

    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth();

    const dIso = (ano, mes, dia) => {
        const m = String(mes + 1).padStart(2, '0');
        const d = String(dia).padStart(2, '0');
        return `${ano}-${m}-${d}`;
    };

    const daysAgo = (n) => {
        const d = new Date(today);
        d.setDate(today.getDate() - n);
        return d.toISOString().split('T')[0];
    };
    const daysLater = (n) => {
        const d = new Date(today);
        d.setDate(today.getDate() + n);
        return d.toISOString().split('T')[0];
    };

    // 1. Configurações & Caixa
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    settings.nomeFantasia = settings.nomeFantasia || 'PetShop Modelo & Spa Animal';
    settings.caixa = {
        gaveta: 2450.00,
        pixBanco: 21000.00,
        cartoesCompensar: 5000.00,
        reserva: 10000.00
    };
    settings.servicoPrecos = {
        'Banho': { P: 45, M: 55, G: 70, GG: 85 },
        'Tosa': { P: 50, M: 65, G: 80, GG: 95 },
        'Banho+Tosa': { P: 85, M: 105, G: 130, GG: 155 },
        'Tosa Higiênica': { P: 30, M: 35, G: 45, GG: 55 }
    };
    DB.save(STORAGE_KEYS.SETTINGS, settings);

    // 2. Clientes e Pets de Demonstração
    const clients = [
        { id: 'cli_001', nome: 'Mariana Duarte', telefone: '(11) 99123-4567', email: 'mariana.duarte@email.com', endereco: 'Rua das Palmeiras, 142', cpf: '123.456.789-01', observacoes: 'Cliente VIP - Banho semanal', dataCadastro: daysAgo(90) },
        { id: 'cli_002', nome: 'Ricardo Albuquerque', telefone: '(11) 98234-5678', email: 'ricardo@email.com', endereco: 'Av. Paulista, 1500', cpf: '234.567.890-12', observacoes: 'Tem 2 cães grandes', dataCadastro: daysAgo(75) },
        { id: 'cli_003', nome: 'Camila Peixoto', telefone: '(11) 97345-6789', email: 'camila.p@email.com', endereco: 'Rua Bela Cintra, 89', cpf: '', observacoes: '', dataCadastro: daysAgo(60) },
        { id: 'cli_004', nome: 'Felipe Santana', telefone: '(11) 96456-7890', email: 'felipe.s@email.com', endereco: 'Rua Oscar Freire, 320', cpf: '', observacoes: 'Compra ração premium a cada 20 dias', dataCadastro: daysAgo(45) },
        { id: 'cli_005', nome: 'Beatriz Lima', telefone: '(11) 95567-8901', email: 'beatriz@email.com', endereco: 'Alameda Santos, 450', cpf: '', observacoes: '', dataCadastro: daysAgo(30) }
    ];
    DB.save(STORAGE_KEYS.CLIENTS, clients);

    const pets = [
        { id: 'pet_001', clienteId: 'cli_001', nome: 'Thor', especie: 'Cão', raca: 'Golden Retriever', porte: 'G', dataNascimento: '2022-04-10', peso: 34, alergias: 'Nenhuma', observacoes: 'Muito dócil, adora secador', foto: '' },
        { id: 'pet_002', clienteId: 'cli_001', nome: 'Mimi', especie: 'Gato', raca: 'Persa', porte: 'P', dataNascimento: '2023-01-15', peso: 4.2, alergias: 'Pele sensível', observacoes: 'Usar shampoo hipoalergênico', foto: '' },
        { id: 'pet_003', clienteId: 'cli_002', nome: 'Bob', especie: 'Cão', raca: 'Labrador', porte: 'G', dataNascimento: '2021-08-20', peso: 36, alergias: 'Nenhuma', observacoes: '', foto: '' },
        { id: 'pet_004', clienteId: 'cli_002', nome: 'Luna', especie: 'Cão', raca: 'Border Collie', porte: 'M', dataNascimento: '2022-11-05', peso: 19, alergias: 'Nenhuma', observacoes: '', foto: '' },
        { id: 'pet_005', clienteId: 'cli_003', nome: 'Mel', especie: 'Cão', raca: 'Shih Tzu', porte: 'P', dataNascimento: '2023-05-12', peso: 5.8, alergias: 'Nenhuma', observacoes: 'Tosa bebê na tesoura', foto: '' },
        { id: 'pet_006', clienteId: 'cli_004', nome: 'Zeus', especie: 'Cão', raca: 'Pastor Alemão', porte: 'G', dataNascimento: '2020-09-18', peso: 38, alergias: 'Nenhuma', observacoes: '', foto: '' },
        { id: 'pet_007', clienteId: 'cli_005', nome: 'Chico', especie: 'Cão', raca: 'Spitz Alemão', porte: 'P', dataNascimento: '2023-03-25', peso: 3.5, alergias: 'Nenhuma', observacoes: 'Cuidado ao desembaraçar', foto: '' }
    ];
    DB.save(STORAGE_KEYS.PETS, pets);

    // 3. Equipe
    const employees = [
        { id: 'func_001', nome: 'João Santos', cargo: 'Tosador Sênior', telefone: '(11) 98888-1111', email: 'joao@petshop.com', comissaoTipo: 'percentual', comissaoValor: 15 },
        { id: 'func_002', nome: 'Ana Oliveira', cargo: 'Banhista Especialista', telefone: '(11) 98888-2222', email: 'ana@petshop.com', comissaoTipo: 'percentual', comissaoValor: 12 },
        { id: 'func_003', nome: 'Juliana Mendes', cargo: 'Gerente / Atendimento', telefone: '(11) 98888-3333', email: 'juliana@petshop.com', comissaoTipo: 'percentual', comissaoValor: 0 }
    ];
    DB.save(STORAGE_KEYS.EMPLOYEES, employees);

    // 4. Receitas Positivas (Faturamento do Mês = R$ 28.450,00)
    const revenues = [];

    const servicosDemo = [
        { desc: 'Banho + Tosa Bebê - Mel (Shih Tzu)', valor: 105.00, cat: 'Serviços', forma: 'Pix' },
        { desc: 'Banho & Hidratação - Thor (Golden)', valor: 130.00, cat: 'Serviços', forma: 'Cartão de Crédito' },
        { desc: 'Tosa Higiênica + Banho - Mimi (Persa)', valor: 85.00, cat: 'Serviços', forma: 'Pix' },
        { desc: 'Banho Completo - Bob (Labrador)', valor: 85.00, cat: 'Serviços', forma: 'Cartão de Débito' },
        { desc: 'Banho & Tosa - Luna (Border Collie)', valor: 115.00, cat: 'Serviços', forma: 'Pix' },
        { desc: 'Banho & Desembolo - Chico (Spitz)', valor: 95.00, cat: 'Serviços', forma: 'Cartão de Crédito' },
        { desc: 'Banho Porte G - Zeus (Pastor)', valor: 95.00, cat: 'Serviços', forma: 'Dinheiro' }
    ];

    const vendasDemo = [
        { desc: 'Venda PDV: 2x Ração Golden Adulto 15kg', valor: 379.80, cat: 'Vendas de Produtos', forma: 'Cartão de Crédito' },
        { desc: 'Venda PDV: 3x Antipulgas Simparic + Petiscos', valor: 289.50, cat: 'Vendas de Produtos', forma: 'Pix' },
        { desc: 'Venda PDV: Areia Higiênica 4kg + Arranhador', valor: 94.80, cat: 'Vendas de Produtos', forma: 'Pix' },
        { desc: 'Venda PDV: Ração Royal Canin Gatos 3kg', valor: 189.90, cat: 'Vendas de Produtos', forma: 'Cartão de Crédito' },
        { desc: 'Venda PDV: Caminha Luxo G + Brinquedos', valor: 169.70, cat: 'Vendas de Produtos', forma: 'Cartão de Crédito' },
        { desc: 'Venda PDV: 5x Sachês Úmidos + Bifinho', valor: 59.50, cat: 'Vendas de Produtos', forma: 'Dinheiro' }
    ];

    let acumuladoMes = 0;
    const alvoMes = 28450.00;
    const maxDia = Math.min(today.getDate(), 25);

    for (let dia = 1; dia <= maxDia; dia++) {
        const itemS = servicosDemo[(dia * 3) % servicosDemo.length];
        const dt = dIso(curYear, curMonth, dia);
        revenues.push({
            id: 'rec_cur_' + dia + '_1',
            descricao: itemS.desc,
            categoria: itemS.cat,
            valor: itemS.valor,
            data: dt,
            formaPagamento: itemS.forma,
            status: 'recebido'
        });
        acumuladoMes += itemS.valor;

        if (dia % 2 === 0) {
            const itemV = vendasDemo[(dia * 2) % vendasDemo.length];
            revenues.push({
                id: 'rec_cur_' + dia + '_2',
                descricao: itemV.desc,
                categoria: itemV.cat,
                valor: itemV.valor,
                data: dt,
                formaPagamento: itemV.forma,
                status: 'recebido'
            });
            acumuladoMes += itemV.valor;
        }
    }

    const restante = alvoMes - acumuladoMes;
    if (restante > 0) {
        revenues.push({
            id: 'rec_cur_lote_pacotes',
            descricao: 'Pacotes Mensais de Banho & Tosa (18 pacotes fechados)',
            categoria: 'Planos & Pacotes',
            valor: Math.round(restante * 0.65 * 100) / 100,
            data: dIso(curYear, curMonth, Math.max(1, Math.min(10, maxDia))),
            formaPagamento: 'Cartão de Crédito',
            status: 'recebido'
        });
        revenues.push({
            id: 'rec_cur_lote_balcao',
            descricao: 'Vendas Balcão & Rações (Movimento Consolidado)',
            categoria: 'Vendas de Produtos',
            valor: Math.round((restante - (Math.round(restante * 0.65 * 100) / 100)) * 100) / 100,
            data: dIso(curYear, curMonth, Math.max(1, Math.min(18, maxDia))),
            formaPagamento: 'Pix',
            status: 'recebido'
        });
    }

    // Histórico de 5 Meses Anteriores
    const historicoMeses = [
        { mesOffset: 5, valor: 19800.00 },
        { mesOffset: 4, valor: 22300.00 },
        { mesOffset: 3, valor: 24100.00 },
        { mesOffset: 2, valor: 25900.00 },
        { mesOffset: 1, valor: 27200.00 }
    ];

    historicoMeses.forEach(hm => {
        const d = new Date(today);
        d.setMonth(today.getMonth() - hm.mesOffset);
        const y = d.getFullYear();
        const m = d.getMonth();

        revenues.push({
            id: 'rec_hist_' + hm.mesOffset + '_serv',
            descricao: 'Faturamento de Serviços Banho e Tosa (Mensal)',
            categoria: 'Serviços',
            valor: Math.round(hm.valor * 0.58 * 100) / 100,
            data: dIso(y, m, 15),
            formaPagamento: 'Pix',
            status: 'recebido'
        });
        revenues.push({
            id: 'rec_hist_' + hm.mesOffset + '_prod',
            descricao: 'Vendas de Produtos e Rações (Mensal)',
            categoria: 'Vendas de Produtos',
            valor: Math.round((hm.valor - (Math.round(hm.valor * 0.58 * 100) / 100)) * 100) / 100,
            data: dIso(y, m, 20),
            formaPagamento: 'Cartão de Crédito',
            status: 'recebido'
        });
    });

    DB.save(STORAGE_KEYS.REVENUES, revenues);

    // 5. Despesas do Mês = R$ 16.200,00 (Lucro Líquido = + R$ 12.250,00 | Margem = 43,1%)
    const expenses = [
        { id: 'desp_001', descricao: 'Aluguel do Ponto Comercial & IPTU', categoria: 'Aluguel', valor: 3500.00, data: dIso(curYear, curMonth, 5), status: 'pago', formaPagamento: 'Pix' },
        { id: 'desp_002', descricao: 'Folha de Salários da Equipe (3 colaboradores)', categoria: 'Salários', valor: 7200.00, data: dIso(curYear, curMonth, 5), status: 'pago', formaPagamento: 'Pix' },
        { id: 'desp_003', descricao: 'Comissões de Serviços (Tosador e Banhista)', categoria: 'Salários', valor: 1850.00, data: dIso(curYear, curMonth, 10), status: 'pago', formaPagamento: 'Pix' },
        { id: 'desp_004', descricao: 'Energia Elétrica Comercial & Água', categoria: 'Água/Luz', valor: 850.00, data: dIso(curYear, curMonth, 15), status: 'pago', formaPagamento: 'Boleto' },
        { id: 'desp_005', descricao: 'Distribuidora PetFood (Reposição Rações)', categoria: 'Fornecedores', valor: 1600.00, data: dIso(curYear, curMonth, 18), status: 'pago', formaPagamento: 'Boleto' },
        { id: 'desp_006', descricao: 'Distribuidora VetFarma (Medicamentos e Higiene)', categoria: 'Fornecedores', valor: 800.00, data: dIso(curYear, curMonth, 20), status: 'pago', formaPagamento: 'Boleto' },
        { id: 'desp_007', descricao: 'Sistema Gestão PetShop + Internet Fibra', categoria: 'Outros', valor: 400.00, data: dIso(curYear, curMonth, 22), status: 'pago', formaPagamento: 'Cartão de Crédito' }
    ];

    historicoMeses.forEach(hm => {
        const d = new Date(today);
        d.setMonth(today.getMonth() - hm.mesOffset);
        const y = d.getFullYear();
        const m = d.getMonth();
        const custoMes = Math.round(hm.valor * 0.58);

        expenses.push({
            id: 'desp_hist_' + hm.mesOffset,
            descricao: 'Custos Operacionais e Folha Consolidada',
            categoria: 'Salários',
            valor: custoMes,
            data: dIso(y, m, 10),
            status: 'pago',
            formaPagamento: 'Pix'
        });
    });

    DB.save(STORAGE_KEYS.EXPENSES, expenses);

    // 6. Agendamentos de Hoje (8 agendamentos com movimento bonito)
    const todayStr = today.toISOString().split('T')[0];
    const appointments = [
        { id: 'agd_001', clienteId: 'cli_001', petId: 'pet_001', servico: 'Banho+Tosa', data: todayStr, horario: '08:30', funcionarioId: 'func_001', observacoes: '', valor: 130, status: 'concluido' },
        { id: 'agd_002', clienteId: 'cli_003', petId: 'pet_005', servico: 'Banho+Tosa', data: todayStr, horario: '09:30', funcionarioId: 'func_001', observacoes: 'Tosa bebê', valor: 105, status: 'concluido' },
        { id: 'agd_003', clienteId: 'cli_002', petId: 'pet_003', servico: 'Banho', data: todayStr, horario: '10:30', funcionarioId: 'func_002', observacoes: '', valor: 85, status: 'concluido' },
        { id: 'agd_004', clienteId: 'cli_001', petId: 'pet_002', servico: 'Tosa Higiênica', data: todayStr, horario: '11:30', funcionarioId: 'func_001', observacoes: 'Pele sensível', valor: 45, status: 'concluido' },
        { id: 'agd_005', clienteId: 'cli_002', petId: 'pet_004', servico: 'Banho', data: todayStr, horario: '13:30', funcionarioId: 'func_002', observacoes: '', valor: 70, status: 'concluido' },
        { id: 'agd_006', clienteId: 'cli_005', petId: 'pet_007', servico: 'Banho', data: todayStr, horario: '14:30', funcionarioId: 'func_002', observacoes: 'Desembolo', valor: 95, status: 'concluido' },
        { id: 'agd_007', clienteId: 'cli_004', petId: 'pet_006', servico: 'Banho', data: todayStr, horario: '15:30', funcionarioId: 'func_002', observacoes: 'Porte G', valor: 95, status: 'agendado' },
        { id: 'agd_008', clienteId: 'cli_003', petId: 'pet_005', servico: 'Tosa', data: todayStr, horario: '16:30', funcionarioId: 'func_001', observacoes: '', valor: 65, status: 'agendado' }
    ];
    DB.save(STORAGE_KEYS.APPOINTMENTS, appointments);

    showToast('✨ Demonstração lucrativa carregada! Faturamento: R$ 28.450 | Lucro: + R$ 12.250 (+43,1%).', 'success');

    setTimeout(() => {
        window.location.reload();
    }, 400);
}
window.carregarDemonstracaoPositiva = carregarDemonstracaoPositiva;

