# SBK Portal Documental

Portal de gestao de dossies de RH com analise de documentos por IA (Claude).

## Requisitos

- Node.js 18+
- Chave de API Anthropic

## Configuracao

```bash
cp .env.example .env
# Edite .env e insira sua ANTHROPIC_API_KEY
npm install
npm start
```

Acesse em: `http://localhost:3000`

## Estrutura

```
├── server.js            # Servidor Express
├── routes/
│   ├── analyze.js       # Proxy para a API Claude (analise de documentos)
│   └── dossies.js       # CRUD de dossies (armazenamento em arquivo JSON)
├── public/
│   ├── index.html       # Interface principal
│   ├── css/style.css    # Estilos
│   └── js/app.js        # Logica do frontend
└── data/                # Criado automaticamente; ignorado pelo git
    └── dossies.json
```

## Variaveis de ambiente

| Variavel            | Descricao                    | Padrao |
|---------------------|------------------------------|--------|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic       | -      |
| `PORT`              | Porta do servidor HTTP       | 3000   |
