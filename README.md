# Sistema de Gestión de Reincorporación y Licencia de Estudio (SGRL)

**Universidad Andrés Bello — Ingeniería de Software II — PTEC106.7990**

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Tailwind CSS + Vite |
| Backend | Python 3.12 + FastAPI + SQLAlchemy |
| Base de datos | PostgreSQL 16 |
| Auth | JWT + bcrypt + TOTP (2FA) |
| Chatbot | Anthropic Claude API |
| Contenedores | Docker + Docker Compose |

---

## Requisitos previos

- Docker Desktop instalado y corriendo
- Git

---

## Levantamiento rápido (5 pasos)

### 1. Clonar / descomprimir el proyecto

```bash
cd sgrl
```

### 2. Crear el archivo de variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y agrega:
```
ANTHROPIC_API_KEY=tu_api_key_de_anthropic   # para el chatbot
SMTP_USER=tu_correo@gmail.com               # opcional, para emails reales
SMTP_PASSWORD=tu_app_password               # opcional
```

> Si no tienes API key de Anthropic, el chatbot mostrará un mensaje de configuración. Todo lo demás funciona igual.

### 3. Levantar los contenedores

```bash
docker compose up --build
```

Espera a que aparezca:
```
✅ Admin creado: admin@sgrl.cl / Admin123!
INFO:     Application startup complete.
```

### 4. Acceder al sistema

| URL | Descripción |
|-----|-------------|
| http://localhost:5173 | Frontend React |
| http://localhost:8000/docs | API Swagger (FastAPI) |
| http://localhost:8000/health | Health check |

### 5. Credenciales iniciales

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin@sgrl.cl | Admin123! | Admin Sistema |

> Al primer login te pedirá cambiar la contraseña.

---

## Flujo de prueba completo

### Como Estudiante
1. Regístrate en `/register`
2. Verifica tu correo (en modo local, revisa la consola del backend)
3. Inicia sesión
4. Crea una licencia de estudio → paga (modo simulado) → sube documentos
5. Crea una reincorporación → paga → sube documentos

### Como Coordinador
1. Crea coordinador desde Admin Sistema → Usuarios
2. Inicia sesión con las credenciales temporales
3. Revisa la bandeja de licencias y reincorporaciones
4. Emite dictámenes

### Como Admin Académico
1. Crea admin académico desde Admin Sistema
2. Emite resoluciones finales
3. Aprueba reincorporaciones (sincroniza estado automáticamente)

### Como Admin Sistema
1. Gestiona usuarios (crear, deshabilitar, habilitar)
2. Anula o rehabilita trámites
3. Genera reportes CSV
4. Visualiza panel de métricas

---

## Estructura del proyecto

```
sgrl/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   └── app/
│       ├── main.py              # Punto de entrada FastAPI
│       ├── api/v1/endpoints/    # Todos los endpoints REST
│       ├── core/                # Config, seguridad, dependencias
│       ├── db/                  # Sesión y base de modelo
│       ├── models/              # Modelos SQLAlchemy
│       ├── schemas/             # Schemas Pydantic
│       └── services/            # Lógica de negocio
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── App.jsx              # Router principal
        ├── context/             # AuthContext
        ├── services/            # Cliente API
        ├── components/
        │   ├── common/          # Layout, Badge, Modal, etc.
        │   └── chatbot/         # Chatbot flotante Claude
        └── pages/
            ├── auth/            # Login, Register
            ├── student/         # Dashboard, Licencias
            └── ...              # Bandeja, Usuarios, Reportes
```

---

## Roles y permisos

| Acción | Estudiante | Coordinador | Admin Acad. | Admin Sis. |
|--------|-----------|------------|------------|-----------|
| Solicitar licencia/reincorp. | ✅ | — | — | — |
| Seguimiento de trámites | ✅ | — | — | — |
| Pagar trámites | ✅ | — | — | — |
| Subir documentos | ✅ | — | — | — |
| Revisar bandeja y emitir dictamen | — | ✅ | — | — |
| Emitir resolución final | — | — | ✅ | — |
| Gestionar usuarios | — | — | — | ✅ |
| Anular/rehabilitar trámites | — | — | — | ✅ |
| Generar reportes CSV | — | — | — | ✅ |
| Panel de métricas | — | — | — | ✅ |
| Chatbot | ✅ | ✅ | ✅ | ✅ |

---

## Estados de trámites

```
BORRADOR → PENDIENTE_PAGO → PENDIENTE_REVISIÓN → EN_REVISIÓN → APROBADO
                                                              → RECHAZADO
         → CADUCADO (72h sin pago)
                                                  → ANULADO (admin sistema)
```

---

## API Endpoints principales

```
POST   /api/v1/auth/register          # Registro estudiante
POST   /api/v1/auth/login             # Login
GET    /api/v1/auth/me                # Perfil

POST   /api/v1/licencias              # Crear licencia
GET    /api/v1/licencias/mis-licencias
POST   /api/v1/licencias/{id}/documentos
POST   /api/v1/licencias/{id}/dictamen     # Coordinador
POST   /api/v1/licencias/{id}/resolucion   # Admin acad.
POST   /api/v1/licencias/{id}/anular       # Admin sis.

POST   /api/v1/reincorporaciones           # Crear reincorporación
POST   /api/v1/pagos/licencia/{id}/iniciar
POST   /api/v1/pagos/{id}/procesar
GET    /api/v1/pagos/{id}/comprobante      # PDF

GET    /api/v1/reportes/metricas
GET    /api/v1/reportes/exportar-licencias
POST   /api/v1/chatbot/mensaje
```

---

## Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f backend

# Reiniciar solo el backend
docker compose restart backend

# Entrar al contenedor backend
docker compose exec backend bash

# Detener todo
docker compose down

# Limpiar todo (incluyendo base de datos)
docker compose down -v
```

---

## Integrantes

- Alina Mollinedo Dávila — LE90953
- Raquel Osorio Mamani — KE87882
- Juan Pablo Seminario Bernal — 123808255
- Benjamín Teplizky Días — 20.428.789-9
