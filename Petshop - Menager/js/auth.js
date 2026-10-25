// ==========================================
// PetShop Manager - Módulo de Autenticação (auth.js)
// Gestão de Cadastro de Pet Shops e Multi-Tenancy com Hash Criptográfico
// ==========================================

const BRUTE_FORCE_KEY = 'ps_auth_attempts';
const LOCKOUT_KEY = 'ps_auth_lockout';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutos

document.addEventListener('DOMContentLoaded', async () => {
    await garantirContasIniciais();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

// Garante que a conta do Dono Master (Flávio Filho) e a de demonstração existam
async function garantirContasIniciais() {
    let tenants = [];
    try {
        tenants = JSON.parse(localStorage.getItem('ps_tenants') || '[]');
    } catch {
        tenants = [];
    }

    // 1. Configurar Chave Mestra e Contato Comercial do Desenvolvedor
    localStorage.setItem('ps_master_key', 'Ma15072019$');
    const devInfo = {
        nome: 'Flávio Filho • Desenvolvedor & Criador da Plataforma',
        whatsapp: '(34) 99983-6438',
        email: 'flaviofilhors15@gmail.com',
        horario: 'Segunda a Sexta, das 08h às 18h'
    };
    localStorage.setItem('ps_dev_contact', JSON.stringify(devInfo));

    // 2. Conta do Dono da Plataforma (Flávio Filho)
    const ownerIndex = tenants.findIndex(t => t.email && t.email.toLowerCase() === 'flaviofilhors15@gmail.com');
    const saltDono = CryptoUtils.generateSalt();
    const hashDono = await CryptoUtils.hashPassword('Ma15072019$', saltDono);

    if (ownerIndex === -1) {
        tenants.unshift({
            id: 'dono_flavio',
            nomePetShop: 'PetShop Master • Central do Dono',
            responsavel: 'Flávio Filho (Dono)',
            email: 'flaviofilhors15@gmail.com',
            telefone: '(34) 99983-6438',
            passwordHash: hashDono,
            salt: saltDono,
            isMasterOwner: true,
            dataCriacao: new Date().toISOString()
        });
    } else {
        tenants[ownerIndex].responsavel = 'Flávio Filho (Dono)';
        tenants[ownerIndex].telefone = '(34) 99983-6438';
        tenants[ownerIndex].passwordHash = hashDono;
        tenants[ownerIndex].salt = saltDono;
        tenants[ownerIndex].isMasterOwner = true;
    }

    // 3. Conta de Demonstração
    const demoTenant = tenants.find(t => t.id === 'default' || t.email === 'demo@petshop.com');
    if (!demoTenant) {
        const salt = CryptoUtils.generateSalt();
        const passwordHash = await CryptoUtils.hashPassword('123', salt);
        tenants.push({
            id: 'default',
            nomePetShop: 'PetShop Manager Demo',
            responsavel: 'Administrador Demo',
            email: 'demo@petshop.com',
            telefone: '(11) 3333-4444',
            passwordHash: passwordHash,
            salt: salt,
            dataCriacao: new Date().toISOString()
        });
    }

    localStorage.setItem('ps_tenants', JSON.stringify(tenants));
}
window.garantirContasIniciais = garantirContasIniciais;
window.garantirTenantPadraoDemo = garantirContasIniciais;

// Alternar entre tela de Login e Cadastro
function alternarAbaAuth(aba) {
    const btnLogin = document.getElementById('tab-btn-login');
    const btnCadastro = document.getElementById('tab-btn-cadastro');
    const paneLogin = document.getElementById('auth-pane-login');
    const paneCadastro = document.getElementById('auth-pane-cadastro');

    if (aba === 'login') {
        btnLogin.classList.add('active');
        btnCadastro.classList.remove('active');
        paneLogin.style.display = 'block';
        paneCadastro.style.display = 'none';
    } else {
        btnLogin.classList.remove('active');
        btnCadastro.classList.add('active');
        paneLogin.style.display = 'none';
        paneCadastro.style.display = 'block';
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Formatar telefone visualmente ao digitar
function formatarTelefoneInput(input) {
    let val = input.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);

    if (val.length > 6) {
        input.value = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
    } else if (val.length > 2) {
        input.value = `(${val.slice(0, 2)}) ${val.slice(2)}`;
    } else if (val.length > 0) {
        input.value = `(${val}`;
    } else {
        input.value = '';
    }
}

// Processar formulário de Login com Proteção contra Força Bruta e Hash Seguro
async function handleLoginSubmit(event) {
    event.preventDefault();

    // 1. Checar bloqueio por força bruta (Rate Limiting)
    const lockedUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0', 10);
    const agora = Date.now();
    if (agora < lockedUntil) {
        const segundosRestantes = Math.ceil((lockedUntil - agora) / 1000);
        showToast(`🔒 Acesso bloqueado temporariamente por excesso de tentativas. Aguarde ${segundosRestantes}s para tentar novamente.`, 'error');
        return;
    }

    const email = (document.getElementById('login-email').value || '').trim().toLowerCase();
    const senha = document.getElementById('login-senha').value || '';

    if (!email || !senha) {
        showToast('Preencha seu e-mail e senha.', 'warning');
        return;
    }

    let tenants = [];
    try {
        tenants = JSON.parse(localStorage.getItem('ps_tenants') || '[]');
    } catch {
        tenants = [];
    }

    // Busca tenant por email
    const tenantIndex = tenants.findIndex(t => t.email.toLowerCase() === email);
    const tenant = tenantIndex !== -1 ? tenants[tenantIndex] : null;

    let senhaValida = false;

    if (tenant) {
        if (tenant.passwordHash && tenant.salt) {
            const hashCalculado = await CryptoUtils.hashPassword(senha, tenant.salt);
            senhaValida = (hashCalculado === tenant.passwordHash);
        } else if (tenant.senha) {
            // Migração transparente de conta legada
            if (tenant.senha === senha) {
                senhaValida = true;
                tenant.salt = CryptoUtils.generateSalt();
                tenant.passwordHash = await CryptoUtils.hashPassword(senha, tenant.salt);
                delete tenant.senha;
                tenants[tenantIndex] = tenant;
                localStorage.setItem('ps_tenants', JSON.stringify(tenants));
            }
        }
    }

    if (!tenant || !senhaValida) {
        // Incrementar contador de falhas
        let tentativas = parseInt(localStorage.getItem(BRUTE_FORCE_KEY) || '0', 10) + 1;
        localStorage.setItem(BRUTE_FORCE_KEY, tentativas.toString());

        if (tentativas >= MAX_ATTEMPTS) {
            const novoBloqueio = Date.now() + LOCKOUT_DURATION_MS;
            localStorage.setItem(LOCKOUT_KEY, novoBloqueio.toString());
            logAudit('AUTH_LOCKOUT', 'Segurança', `Conta ${email} bloqueada por 2 minutos devido a ${tentativas} falhas consecutivas.`);
            showToast('🔒 5 tentativas incorretas. Acesso bloqueado por 2 minutos para proteção contra invasão.', 'error');
        } else {
            const restantes = MAX_ATTEMPTS - tentativas;
            logAudit('LOGIN_FAILED', 'Autenticação', `Tentativa de login falha para o e-mail: ${email}`);
            showToast(`E-mail ou senha incorretos. Restam ${restantes} tentativa(s) antes do bloqueio.`, 'error');
        }
        return;
    }

    // Login com sucesso: zerar contadores de falhas
    localStorage.removeItem(BRUTE_FORCE_KEY);
    localStorage.removeItem(LOCKOUT_KEY);

    // Definir sessão ativa para este Pet Shop
    localStorage.setItem('ps_current_tenant_id', tenant.id);
    localStorage.setItem('ps_current_tenant_name', tenant.nomePetShop);

    // Se for o Dono da Plataforma (Flávio Filho)
    if (tenant.isMasterOwner || email === 'flaviofilhors15@gmail.com') {
        localStorage.setItem('ps_is_platform_owner', 'true');
        logAudit('LOGIN_OWNER', 'SuperAdmin', `Login Master efetuado por Flávio Filho (${email})`);
        showToast('👑 Bem-vindo, Flávio Filho! Abrindo o Painel Master do Dono...', 'success');

        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 500);
        return;
    }

    // Verificar se a loja ainda está pendente de aprovação manual pelo Dono
    let statusAtual = tenant.status || 'active';
    try {
        const saasTenants = JSON.parse(localStorage.getItem('ps_saas_tenants') || '[]');
        const st = saasTenants.find(x => x.id === tenant.id);
        if (st) statusAtual = st.status;
    } catch (e) {}

    if (statusAtual === 'pending') {
        localStorage.removeItem('ps_current_tenant_id');
        localStorage.removeItem('ps_current_tenant_name');
        alert(
            `⏳ CONTA AGUARDANDO APROVAÇÃO MANUAL\n\n` +
            `Olá, ${tenant.responsavel}!\n` +
            `O seu cadastro no PetShop Manager foi recebido e está aguardando liberação pelo administrador.\n\n` +
            `Entre em contato com Flávio Filho pelo WhatsApp (34) 99983-6438 para ativação imediata.`
        );
        return;
    }

    if (statusAtual === 'suspended') {
        localStorage.removeItem('ps_current_tenant_id');
        localStorage.removeItem('ps_current_tenant_name');
        alert('🔒 ACESSO SUSPENSO: Esta conta está temporariamente suspensa por pendência de assinatura. Fale com Flávio Filho no WhatsApp (34) 99983-6438.');
        return;
    }

    logAudit('LOGIN_SUCCESS', 'Autenticação', `Login realizado com sucesso por ${tenant.responsavel} (${tenant.email})`);
    showToast(`Bem-vindo(a) ao painel do ${tenant.nomePetShop}!`, 'success');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 700);
}

// Acesso Rápido com Pet Shop de Demonstração
async function entrarComoDemo() {
    await garantirTenantPadraoDemo();

    localStorage.removeItem(BRUTE_FORCE_KEY);
    localStorage.removeItem(LOCKOUT_KEY);

    localStorage.setItem('ps_current_tenant_id', 'default');
    localStorage.setItem('ps_current_tenant_name', 'PetShop Manager Demo');

    logAudit('LOGIN_DEMO', 'Autenticação', 'Acesso realizado via modo Demonstração');
    showToast('Acessando Pet Shop de demonstração com proteção ativa...', 'info');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

// Processar formulário de Cadastro de Novo Pet Shop com Hash Seguro
async function handleCadastroSubmit(event) {
    event.preventDefault();

    const nomePetShop = (document.getElementById('cad-nome-loja').value || '').trim();
    const responsavel = (document.getElementById('cad-responsavel').value || '').trim();
    const telefone = (document.getElementById('cad-telefone').value || '').trim();
    const email = (document.getElementById('cad-email').value || '').trim().toLowerCase();
    const senha = document.getElementById('cad-senha').value || '';
    const confirmaSenha = document.getElementById('cad-confirma-senha').value || '';
    const carregarExemplos = document.getElementById('cad-com-exemplos').checked;

    if (!nomePetShop || !responsavel || !email || !senha) {
        showToast('Por favor, preencha todos os campos obrigatórios.', 'warning');
        return;
    }

    if (senha.length < 6) {
        showToast('Por segurança, a senha deve ter no mínimo 6 caracteres.', 'warning');
        return;
    }

    if (senha !== confirmaSenha) {
        showToast('A confirmação de senha não confere.', 'warning');
        return;
    }

    let tenants = [];
    try {
        tenants = JSON.parse(localStorage.getItem('ps_tenants') || '[]');
    } catch {
        tenants = [];
    }

    // Verificar se já existe pet shop com este e-mail
    const jaExiste = tenants.some(t => t.email.toLowerCase() === email);
    if (jaExiste) {
        showToast('Já existe um Pet Shop cadastrado com este e-mail.', 'warning');
        return;
    }

    // Gerar Salt e Hash criptográfico com Web Crypto API
    const salt = CryptoUtils.generateSalt();
    const passwordHash = await CryptoUtils.hashPassword(senha, salt);

    // Gerar ID exclusivo para o novo Pet Shop (Tenant)
    const novoTenantId = 'shop_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    const novoTenant = {
        id: novoTenantId,
        nomePetShop,
        responsavel,
        telefone,
        email,
        passwordHash,
        salt,
        status: 'pending', // Opção 1: Bloqueado aguardando aprovação manual do Dono
        plano: 'pro',
        dataCriacao: new Date().toISOString()
    };

    tenants.push(novoTenant);
    localStorage.setItem('ps_tenants', JSON.stringify(tenants));

    // Sincronizar com o banco do Super Admin (ps_saas_tenants)
    try {
        let saasTenants = JSON.parse(localStorage.getItem('ps_saas_tenants') || '[]');
        saasTenants.unshift({
            id: novoTenantId,
            nome: nomePetShop,
            responsavel: responsavel,
            telefone: telefone,
            email: email,
            cidade: 'Aguardando Aprovação',
            plano: 'pro',
            status: 'pending', // Fica pendente para você aprovar no admin.html
            criadoEm: new Date().toISOString(),
            ultimoAcesso: new Date().toISOString(),
            tutoresCount: 0,
            petsCount: 0,
            agendamentosCount: 0,
            notas: [
                { autor: 'Sistema', texto: 'Novo cadastro recebido via web. Aguardando conferência e liberação pelo Super Admin.', data: new Date().toLocaleString('pt-BR') }
            ]
        });
        localStorage.setItem('ps_saas_tenants', JSON.stringify(saasTenants));
    } catch (e) {}

    // Inicializar configurações exclusivas deste Pet Shop
    const settings = {
        nomeFantasia: nomePetShop,
        cnpj: '',
        endereco: '',
        telefone: telefone,
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

    if (carregarExemplos) {
        const employees = [
            { id: 'func_' + DB.generateId(), nome: responsavel, cargo: 'Gerente', telefone: telefone, email: email, comissaoTipo: 'percentual', comissaoValor: 0 },
            { id: 'func_' + DB.generateId(), nome: 'Profissional de Tosa', cargo: 'Tosador', telefone: '', email: '', comissaoTipo: 'percentual', comissaoValor: 15 },
            { id: 'func_' + DB.generateId(), nome: 'Profissional de Banho', cargo: 'Banhista', telefone: '', email: '', comissaoTipo: 'percentual', comissaoValor: 10 }
        ];
        DB.save(STORAGE_KEYS.EMPLOYEES, employees);

        const products = [
            { id: 'prod_' + DB.generateId(), nome: 'Ração Premium Adulto 15kg', categoria: 'Rações', sku: 'RAC001', precoCusto: 90.00, precoVenda: 149.90, margem: 39.96, estoque: 10, estoqueMinimo: 3, unidade: 'un', fornecedor: 'Distribuidora Pet' },
            { id: 'prod_' + DB.generateId(), nome: 'Shampoo Neutro 500ml', categoria: 'Higiene', sku: 'HIG001', precoCusto: 12.00, precoVenda: 28.00, margem: 57.14, estoque: 15, estoqueMinimo: 4, unidade: 'un', fornecedor: 'Distribuidora Pet' },
            { id: 'prod_' + DB.generateId(), nome: 'Petisco Bifinho Carne', categoria: 'Petiscos', sku: 'PET001', precoCusto: 5.00, precoVenda: 12.90, margem: 61.24, estoque: 20, estoqueMinimo: 5, unidade: 'pct', fornecedor: 'Distribuidora Pet' }
        ];
        DB.save(STORAGE_KEYS.PRODUCTS, products);

        DB.save(STORAGE_KEYS.CLIENTS, []);
        DB.save(STORAGE_KEYS.PETS, []);
        DB.save(STORAGE_KEYS.APPOINTMENTS, []);
        DB.save(STORAGE_KEYS.PACKAGES, []);
        DB.save(STORAGE_KEYS.SALES, []);
        DB.save(STORAGE_KEYS.REVENUES, []);
        DB.save(STORAGE_KEYS.EXPENSES, []);
        DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    } else {
        DB.save(STORAGE_KEYS.EMPLOYEES, [
            { id: 'func_' + DB.generateId(), nome: responsavel, cargo: 'Gerente', telefone: telefone, email: email, comissaoTipo: 'percentual', comissaoValor: 0 }
        ]);
        DB.save(STORAGE_KEYS.PRODUCTS, []);
        DB.save(STORAGE_KEYS.CLIENTS, []);
        DB.save(STORAGE_KEYS.PETS, []);
        DB.save(STORAGE_KEYS.APPOINTMENTS, []);
        DB.save(STORAGE_KEYS.PACKAGES, []);
        DB.save(STORAGE_KEYS.SALES, []);
        DB.save(STORAGE_KEYS.REVENUES, []);
        DB.save(STORAGE_KEYS.EXPENSES, []);
        DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    }

    logAudit('TENANT_REGISTERED_PENDING', 'Segurança', `Novo Pet Shop cadastrado aguardando aprovação: ${nomePetShop} (${responsavel})`);

    // Feedback visual imediato e botão para WhatsApp do Dono
    alert(
        `✅ CADASTRO REALIZADO COM SUCESSO!\n\n` +
        `Olá, ${responsavel}!\n` +
        `O seu Pet Shop "${nomePetShop}" foi registrado em nossa plataforma.\n\n` +
        `🔒 STATUS: AGUARDANDO LIBERAÇÃO DO ADMINISTRADOR\n` +
        `Para sua segurança e ativação da licença, nossa equipe entrará em contato ou você pode enviar uma mensagem direta para liberação imediata no WhatsApp de Flávio Filho: (34) 99983-6438.`
    );

    // Redireciona para o WhatsApp de Flávio com mensagem pré-pronta
    const msgZap = encodeURIComponent(`Olá Flávio! Acabei de cadastrar o pet shop "${nomePetShop}" (${responsavel} - ${telefone}) no PetShop Manager e aguardo a liberação do meu acesso.`);
    window.location.href = `https://wa.me/5534999836438?text=${msgZap}`;
}

