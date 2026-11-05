# Matriz de cumplimiento

## Criterio de revisión

Autor: Gobbo Facundo, legajo 52288. Alcance de referencia: dos integrantes; ejecución individual autorizada según lo informado por el alumno.

Esta matriz registra una inspección estática del código. **Implementado** significa que se localizaron pantallas y operaciones; no implica ejecución satisfactoria ni aceptación docente. **Parcial** señala una brecha conocida. **Pendiente** identifica evidencia o trabajo faltante.

## Alcance funcional

Los endpoints de esta tabla están bajo `/api`. Los nombres de pantallas remiten a las rutas definidas en [App.tsx](../frontend-dsw/src/App.tsx); los prefijos de API se montan en [app.ts](../backend-dsw/src/app.ts).

| ID | Función / requisito | Pantalla | API principal | Estado y observaciones |
| --- | --- | --- | --- | --- |
| F-01 | CRUD simple: Especialidad | `/admin/carga`, `/admin/modificar` | `/especialidades` | Implementado; comprobar altas, cambios y restricciones de eliminación con relaciones. |
| F-02 | CRUD simple: ObraSocial | `/admin/carga`, `/admin/modificar` | `/obras-sociales` | Implementado; comprobar manejo de referencias desde turnos. |
| F-03 | CRUD dependiente: Agenda | `/mi-agenda`, administración | `/agendas` | Parcial: operaciones presentes; validar el intervalo completo al editar un solo extremo horario. |
| F-04 | Profesionales con filtro y detalle | `/doctores` → `/doctores/:matricula` | `GET /doctores`, `GET /doctores/:matricula`, `GET /turnos/disponibilidad` | Implementado: búsqueda, ficha consultada al backend y disponibilidad. Pendiente de prueba manual de extremo a extremo. |
| F-05 | CU-01: reservar | Ficha de médico o `/especialidades/:id/turnos` | `POST /turnos` | Parcial: flujo presente; riesgo de doble reserva concurrente. |
| F-06 | CU-02: registrar asistencia | `/mis-turnos/atender` | `GET /turnos/atiendo`, `PATCH /turnos/:id/asistio`, `PATCH /turnos/:id/no-asistio` | Implementado; consume el turno de F-05. Verificar permisos y transiciones con resultados de pruebas. |
| F-07 | CRUD adicional: MotivoCancelacion | Administración | `/motivos-cancelacion` | Implementado. |
| F-08 | Gestión de Doctor | Administración | `/doctores` | Implementado para alta, consulta, cambios de especialidades y baja lógica; revisar edición de datos personales asociados a Usuario. |
| F-09 | Gestión de Usuario | `/registro`, `/perfil`, `/admin/usuarios` | `/usuarios`, `/usuarios/:id`, `/usuarios/listado` | Parcial: no se localizó operación de baja en la interfaz, aunque existe en la API. |
| F-10 | Ciclo de vida de Turno | Reserva, `/mis-turnos`, atención médica | `/turnos`, `/turnos/mios`, `/turnos/:id`, acciones de estado | Parcial frente a un CRUD genérico: se propone cancelación como baja funcional. Confirmar alcance aceptado; no se ofrece reprogramación. |
| F-11 | Listado adicional de usuarios | `/admin/usuarios` | `GET /usuarios/listado` | Filtros presentes; sin navegación a detalle. No se usa para acreditar F-04. |

La selección de F-04 como listado mínimo no exime de revisar con el docente la exigencia de detalle en los listados adicionales.

## Evidencia funcional y pendientes

| Punto | Código de referencia | Verificación necesaria |
| --- | --- | --- |
| Administración de catálogos | [Alta](../frontend-dsw/src/Paginas/AdminCargaDatos.tsx), [modificación](../frontend-dsw/src/Paginas/AdminModificarDatos.tsx) | Ejecutar C/R/U/D por entidad y registrar errores esperados. |
| Detalle del profesional | [DoctorDetalle](../frontend-dsw/src/Paginas/DoctorDetalle.tsx) | Confirmar consulta al backend e información ampliada. |
| Reserva y asistencia | [Rutas](../backend-dsw/src/recursos/turno/turno.rutas.ts), [controlador](../backend-dsw/src/recursos/turno/turno.controlador.ts) | Completar CU-01 → CU-02 con cuentas diferentes; verificar concurrencia. |
| Edición de agenda | [Controlador](../backend-dsw/src/recursos/agenda/agenda.controlador.ts) | Rechazar un inicio posterior al fin al modificar un solo campo. |
| Usuarios | [Listado](../frontend-dsw/src/Paginas/AdminUsuarios.tsx), [rutas](../backend-dsw/src/recursos/usuarios/usuario.rutas.ts) | Definir y completar la baja desde la aplicación y sus restricciones. |

## Requisitos técnicos

| Aspecto | Evidencia localizada | Estado |
| --- | --- | --- |
| Separación frontend/API y dependencias | Carpetas frontend/backend, servicios HTTP y respectivos `package.json` | Implementado. |
| Persistencia y organización | MySQL, entidades MikroORM, rutas, controladores y middleware | Implementado; lógica de negocio concentrada en controladores. |
| Validación y errores | Validadores y manejador de errores backend | Parcial: pendiente de agenda señalado en F-03. |
| Acceso por roles | Better Auth, middleware de sesión y roles; rutas privadas React | Implementado; ejecución de pruebas pendiente de documentar. |
| Configuración de entornos | `.env.example` de cada aplicación | Presente; despliegue y configuración de autenticación por verificar. |
| Interfaz adaptable, estado, eventos, propiedades y servicios | Componentes React, Material UI, contextos y servicios tipados | Presente en código; verificar visualmente SM, MD y LG. |
| Pruebas backend | Suites en `src/shared` y `src/recursos`, incluidas integraciones | Existentes. Para el alcance adoptado, acreditar al menos dos pruebas automatizadas y una integración. |
| Pruebas frontend | Pruebas de componentes en `src/Componentes`; Playwright en `e2e` | Existentes; resultados actuales pendientes. |

No se asignan pruebas a integrantes ficticios: el autor es único y adopta el volumen equivalente a dos integrantes.

## Entregables

| Entregable | Estado |
| --- | --- |
| Propuesta y modelo actualizados | Redactados en [proposal.md](proposal.md); pendientes de revisión docente. |
| Índice de documentación | Creado y enlazado desde el README principal. |
| Instalación desde cero | Pendiente de redactar y ejecutar en un entorno limpio. |
| Documentación de API | Pendiente. Las rutas de esta matriz no sustituyen una referencia de API. |
| Evidencia de pruebas | Pendiente de ejecución y registro reproducible. |
| Seguimiento y avances | Pendiente de incorporar registros reales y enlaces; no reconstruir reuniones inexistentes. |
| PR/MR, video, despliegue y acceso de evaluación | Pendientes de incorporar o verificar. |

Fuentes: [enunciado](https://github.com/utnfrrodsw/tp), [aclaraciones funcionales](https://github.com/utnfrrodsw/tp/blob/main/FAQ.md) y [documentación](https://github.com/utnfrrodsw/tp/blob/main/docs.md). El documento de documentación figura en revisión; cualquier diferencia con las instrucciones de entrega debe confirmarse con la cátedra.
