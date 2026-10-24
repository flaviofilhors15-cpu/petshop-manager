# 🐾 PetShop Manager — Plataforma SaaS de Gestão para Pet Shops

<p align="center">
  <img src="icons/icon.svg" width="100" height="100" alt="PetShop Manager Logo">
</p>

<p align="center">
  <strong>Solução completa, intuitiva e segura para gestão de Pet Shops, Clínicas Veterinárias e Centros de Banho & Tosa.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Versão-1.3.0-blue.svg" alt="Versão">
  <img src="https://img.shields.io/badge/PWA-Offline--Ready-success.svg" alt="PWA">
  <img src="https://img.shields.io/badge/Segurança-Web_Crypto_API-orange.svg" alt="Segurança">
  <img src="https://img.shields.io/badge/Conformidade-LGPD_Art._18-green.svg" alt="LGPD">
  <img src="https://img.shields.io/badge/Deploy-Netlify-00C7B7.svg" alt="Netlify">
  <img src="https://img.shields.io/badge/Licença-MIT-yellow.svg" alt="Licença">
</p>

---

## 🚀 Sobre o Projeto

O **PetShop Manager** é uma aplicação web moderna (**Progressive Web App - PWA**), responsiva e arquitetada no modelo **Multi-Tenant (SaaS)**. Cada pet shop possui seu próprio ambiente de dados isolado e seguro, permitindo controle operacional de ponta a ponta sem necessidade de servidores complexos na fase inicial.

O sistema foi desenhado para atender às dores reais do dia a dia do lojista brasileiro: filas de banho e tosa, controle de ração a granel, comunicação ágil via WhatsApp, cobranças, controle de comissões e segurança de dados em conformidade com a **LGPD**.

---

## ✨ Funcionalidades Principais

### 1. 🏢 Arquitetura Multi-Tenant (SaaS)
- **Portal de Acesso & Cadastro (`login.html`)**: Permite que múltiplos pet shops criem sua conta de forma independente.
- **Isolamento de Dados por Loja**: Particionamento seguro de registros por identificador exclusivo de loja (`tenant_id`).
- **Acesso Demonstração com 1 Clique**: Ambiente de teste pré-populado para demonstrações rápidas.

### 2. 🚿 Gestão de Banho & Tosa & Fila Operacional
- **Quadro Kanban em Tempo Real**: Fluxo visual com arrastar e soltar (*Agendado ➔ Em Atendimento ➔ Pronto para Retirada ➔ Concluído*).
- **Ficha de Baia / Gaiola para Impressão**: Comprovante térmico/A4 para fixação na baia do pet com nome, raça, serviços, alergias destacadas em vermelho, pertences deixados e autorização do tutor.
- **Visualizações Flexíveis**: Calendário diário com régua horária, visão semanal e calendário mensal.
- **Tabela Dinâmica de Preços**: Cálculo automático de valores por serviço e porte do pet (P, M, G, GG).
- **Pacotes Mensais de Banhos**: Controle de créditos restantes por animal com abatimento automático a cada atendimento.

### 3. 💬 Comunicação via WhatsApp em 1 Clique
- Disparo de mensagens personalizadas diretamente para o WhatsApp do tutor:
  - 📲 **Aviso de Pet Pronto**: Informa que o banho/tosa terminou com endereço e valor.
  - 📅 **Lembrete de Agendamento**: Envia data, horário e profissional escalado.
  - 💳 **Cobrança com Chave Pix**: Notificação transparente com chave Pix da loja.

### 4. 🛒 Ponto de Venda (PDV) & Vendas Balcão
- Frente de caixa visual com busca rápida por nome ou leitor de código de barras.
- Carrinho de compras integrado com cálculo de desconto (percentual ou fixo).
- Múltiplas formas de pagamento (Dinheiro, Pix, Débito, Crédito).
- Impressão de cupom não fiscal/recibo de venda para o cliente.

### 5. 📦 Controle Avançado de Estoque & Ração a Granel
- **Fracionamento de Sacaria**: Transforme sacos fechados de 15kg/20kg em estoque a granel vendido por quilo com precificação e margem automática.
- **Alertas de Estoque Mínimo**: Notificações automáticas na barra de topo e dashboard para produtos em ponto de reposição.
- **Monitor de Validades**: Classificação por cores (Vencido, Atenção < 30 dias, OK) para prevenção de perdas.
- **Impressão de Etiquetas de Gôndola**: Emissão de etiquetas com nome, preço e código de barras.

### 6. 💼 Financeiro, Comissões & Relatórios
- DRE Simplificado: Faturamento bruto, total de despesas, lucro líquido e margem operacional (%).
- Gráficos interativos com **Chart.js** (evolução mensal, serviços mais lucrativos, formas de pagamento).
- Módulo de funcionários com cálculo automático de comissões por serviço prestado.

### 7. 🛡️ Segurança Defensiva & Conformidade LGPD
- **Hash Criptográfico de Senhas com Salt**: Senhas protegidas via Web Crypto API nativa (`SHA-256 + Salt`), sem armazenamento de texto puro.
- **Proteção contra Força Bruta**: Bloqueio temporário (lockout de 2 minutos) após 5 tentativas incorretas consecutivas.
- **Controle de Acesso RBAC**: Perfis de usuário estruturados (*Dono/Admin, Gerente, Atendente/Caixa, Tosador*).
- **Conformidade com a LGPD (Art. 18)**:
  - Mascaramento de CPF (`***.456.789-**`) na visualização padrão.
  - Botão de **Anonimização do Titular** com desvinculação permanente de dados pessoais e preservação contábil para conformidade fiscal.
  - Canal oficial do Encarregado de Dados (DPO).
- **Backups Criptografados (AES-GCM 256 bits)**: Exportação com proteção por senha em formato `.psbackup`.
- **Trilha de Auditoria (Audit Trail)**: Registro imutável de eventos críticos (logins, exclusões, alterações cadastrais) com exportação em CSV.

### 8. 👑 Central do Dono do SaaS (Super Admin • `admin.html`)
- **Portal Executivo Isolado**: Acesso exclusivo para o criador da plataforma com tema executivo Dark/Light, sem misturar rotas com as dos petshops.
- **Métricas SaaS em Tempo Real**: MRR (Receita Recorrente), ARR (Anualizado), Churn Rate, ARPU (Ticket Médio por loja), Inadimplência e Telemetria de volume de clientes e pets no país.
- **Gestão 360° de Pet Shops (Tenants)**: Tabela com busca em tempo real, status (*Ativa, Trial, Suspensa, Cancelada*), plano (*Básico, Pro, Premium*) e gaveta lateral de dossiê do cliente.
- **Ações de Comando com Auditoria Obrigatória**: Bloquear loja por inadimplência, liberar acesso, estender período de teste (trial) e registrar justificativa obrigatória.
- **Modo Suporte (Impersonate)**: O Dono entra no sistema da loja com 1 clique para suporte técnico assistido, exibindo tarja fixa de emergência para retorno seguro ao painel.
- **Faturamento & Cobranças**: Acompanhamento de faturas mensais, reenvio de cobrança Pix via WhatsApp e processamento em lote.
- **Comunicação Global**: Publicação de avisos e novidades transmitidos imediatamente para todas as lojas conectadas.
- **Exportação de Relatórios**: Download em CSV das métricas de tenants e do log de auditoria.

### 9. 📱 PWA & Funcionamento Offline
- Instalável como aplicativo nativo no **Windows, macOS, Android e iOS**.
- **Service Worker (`sw.js`)**: Cache estratégico de ativos para funcionamento contínuo mesmo com oscilações de internet.
- **Persistência Blindada**: Ativação automática de `navigator.storage.persist()` para proteção contra limpeza acidental do navegador.

---

## 🛠️ Tecnologias Utilizadas

- **Front-end**: HTML5 semântico, CSS3 moderno (Custom Properties, Flexbox, Grid), JavaScript (ES6+ Vanilla).
- **Criptografia & Segurança**: Web Crypto API (`SubtleCrypto` nativa dos navegadores).
- **Ícones & Gráficos**: [Lucide Icons](https://lucide.dev/) e [Chart.js](https://www.chartjs.org/).
- **PWA**: Web App Manifest (`manifest.json`) e Service Worker com estratégia Cache-First/Stale-While-Revalidate.
- **Hospedagem & Infra**: Pronto para publicação estática no [Netlify](https://www.netlify.com/) com cabeçalhos de segurança HTTP configurados (`netlify.toml`).

---

## 📂 Estrutura de Arquivos

```text
├── index.html              # Dashboard principal e indicadores KPI
├── login.html              # Portal de autenticação e cadastro de pet shops
├── admin.html              # Central Executiva do Dono do SaaS (Super Admin)
├── agenda.html             # Agenda diária, semanal, mensal e Kanban de banho & tosa
├── clientes.html           # Gestão de tutores, prontuário dos pets e anonimização LGPD
├── vendas.html             # Frente de caixa (PDV) e histórico de vendas
├── estoque.html            # Estoque, fracionamento de ração e controle de validades
├── financeiro.html         # Fluxo de caixa, receitas, despesas e DRE
├── funcionarios.html       # Equipe, cargos e apuração de comissões
├── relatorios.html         # Relatórios analíticos e gráficos de performance
├── configuracoes.html      # Dados da loja, preços, auditoria, backups e LGPD
│
├── css/
│   └── styles.css          # Design system completo, variáveis e responsividade
│
├── js/
│   ├── app.js              # Núcleo multi-tenant, persistência, RBAC, auditoria e crypto
│   ├── auth.js             # Gestão de cadastro de lojas, login e rate limiting
│   ├── admin.js            # Engine Super Admin (MRR, Tenants, Billing, Impersonate)
│   ├── dashboard.js        # Indicadores e gráficos do painel principal
│   ├── agenda.js           # Lógica do calendário, fila Kanban e fichas de baia
│   ├── clientes.js         # CRUD de tutores, compressão de fotos e LGPD
│   ├── vendas.js           # Lógica do PDV, carrinho e cupons
│   ├── estoque.js          # Movimentações, fracionamento e etiquetas
│   ├── financeiro.js       # Controle financeiro e lançamentos
│   ├── funcionarios.js     # Gestão da equipe e comissões
│   ├── relatorios.js       # Métricas avançadas e exportações
│   └── configuracoes.js    # Parâmetros, backup criptografado e logs
│
├── icons/
│   └── icon.svg            # Ícone vetorial da marca para o PWA
│
├── sw.js                   # Service worker para cache offline (v1.9)
├── manifest.json           # Manifesto PWA para instalação no celular e desktop
├── netlify.toml            # Configuração de deploy e cabeçalhos de segurança HTTP
├── .gitignore              # Arquivos e diretórios ignorados pelo Git
├── LICENSE                 # Licença de uso MIT
└── README.md               # Documentação técnica e visão geral
```

---

## 💻 Como Executar Localmente

Como o sistema foi construído em arquitetura estática pura, você não precisa de Node.js, compiladores ou bancos de dados locais para testar:

1. **Clone este repositório**:
   ```bash
   git clone https://github.com/SEU_USUARIO/petshop-manager.git
   ```
2. **Abra a pasta do projeto**:
   ```bash
   cd petshop-manager
   ```
3. **Execute no navegador**:
   - Basta abrir o arquivo `login.html` ou `index.html` com dois cliques no seu navegador favorito.
   - Ou utilize extensões como o **Live Server** (VS Code) para recarregamento em tempo real.

---

## ☁️ Como Publicar no Netlify

1. Faça o envio do código para seu repositório no **GitHub**.
2. Acesse [netlify.com](https://www.netlify.com/) e faça login.
3. Clique em **"Add new site" ➔ "Import an existing project"**.
4. Conecte com o GitHub e selecione o repositório do PetShop Manager.
5. Deixe os campos de *Build Command* vazios e o diretório de publicação como `.` (raiz).
6. O arquivo `netlify.toml` já aplicará automaticamente todas as regras de cache e cabeçalhos de segurança (HSTS, CSP, X-Frame-Options, etc.).
7. Seu sistema estará no ar com HTTPS gratuito em menos de 1 minuto!

---

## 🔒 Boas Práticas de Segurança e LGPD

- **Dados Sensíveis**: Todos os CPFs são ofuscados por padrão na interface para operadores sem privilégio administrativo.
- **Direito do Titular**: A anonimização limpa dados cadastrais do titular mantendo os vínculos contábeis com tags anônimas conforme exigido pela legislação brasileira.
- **Criptografia Nativa**: Seus backups podem ser protegidos por senha com cifra AES-GCM de 256 bits antes do download.

---

## 📄 Licença

Este projeto está sob a licença **MIT** — consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<p align="center">
  Desenvolvido com carinho para impulsionar pet shops de todo o Brasil. 🐶🐱
</p>
